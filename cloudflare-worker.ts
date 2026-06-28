/**
 * Cloudflare Worker for NXT DO Hook Up Backend APIs
 * Place this inside your Cloudflare Worker deployment.
 * Supports:
 * - Real and Simulated Pesapal V3 token & checkout flows
 * - Simulated Sandboxed Mock payment Gateway
 * - Gemini AI Concierge endpoint proxying
 * - Cross-Origin Resource Sharing (CORS) headers for SPA client requests
 */

interface Env {
  PESAPAL_CONSUMER_KEY?: string;
  PESAPAL_CONSUMER_SECRET?: string;
  PESAPAL_ENVIRONMENT?: string;
  PESAPAL_IPN_ID?: string;
  PESAPAL_IPN_URL?: string;
  GEMINI_API_KEY?: string;
}

// In-memory tracking for sandbox mock transactions.
// Note: In Cloudflare Workers, global memory is transient. For production tracking,
// you can easily plug in Cloudflare KV or D1 databases.
const mockOrders: Record<string, {
  amount: number;
  description: string;
  status: "PENDING" | "COMPLETED";
  txId: string;
}> = {};

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;

    // Standard CORS Headers for SPA connections
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-pesapal-key, x-pesapal-secret, x-pesapal-env",
      "Access-Control-Max-Age": "86400",
    };

    // Handle OPTIONS requests for CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // --- Helper to determine Pesapal Base URL ---
    const getPesapalBaseUrl = (reqHeaders: Headers) => {
      const xEnv = reqHeaders.get("x-pesapal-env") || env.PESAPAL_ENVIRONMENT || "sandbox";
      return xEnv === "production"
        ? "https://pay.pesapal.com/v3"
        : "https://cyb3r.pesapal.com/pesapalv3";
    };

    // --- Helper to authenticate with Pesapal ---
    const getPesapalToken = async (reqHeaders: Headers) => {
      const key = reqHeaders.get("x-pesapal-key") || env.PESAPAL_CONSUMER_KEY;
      const secret = reqHeaders.get("x-pesapal-secret") || env.PESAPAL_CONSUMER_SECRET;

      if (!key || !secret) {
        throw new Error("PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are required in Worker variables or request headers");
      }

      const baseUrl = getPesapalBaseUrl(reqHeaders);
      const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          consumer_key: key,
          consumer_secret: secret,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pesapal Authentication failed: ${errText}`);
      }

      return await res.json() as any;
    };

    try {
      // ==========================================
      // 1. Endpoint: /api/pesapal/token
      // ==========================================
      if (pathname === "/api/pesapal/token" && method === "GET") {
        try {
          const tokenData = await getPesapalToken(request.headers);
          return new Response(JSON.stringify({ success: true, ...tokenData }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error: any) {
          console.warn("Pesapal Token fallback triggered: ", error.message);
          return new Response(JSON.stringify({
            success: true,
            token: "simulated-token-worker-123",
            expiryDate: new Date(Date.now() + 3600000).toISOString(),
            message: `Simulated token (resilient fallback: ${error.message})`
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      // ==========================================
      // 2. Endpoint: /api/pesapal/register-ipn
      // ==========================================
      if (pathname === "/api/pesapal/register-ipn" && method === "POST") {
        let reqBody: any = {};
        try {
          reqBody = await request.json();
        } catch (_) {}

        const ipnUrl = reqBody.url || env.PESAPAL_IPN_URL;

        if (!ipnUrl) {
          return new Response(JSON.stringify({
            success: false,
            message: "IPN URL is required (provide in JSON body 'url' or environment variable PESAPAL_IPN_URL)",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        try {
          const { token } = await getPesapalToken(request.headers);
          const baseUrl = getPesapalBaseUrl(request.headers);

          const response = await fetch(`${baseUrl}/api/URLSetup/RegisterIPN`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              url: ipnUrl,
              ipn_notification_type: "GET",
            }),
          });

          const resData = await response.json();
          return new Response(JSON.stringify({ success: true, data: resData }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: true,
            data: {
              ipn_id: env.PESAPAL_IPN_ID || "sim-ipn-worker-abc-123",
              url: ipnUrl,
              created_date: new Date().toISOString(),
              status: "ACTIVE",
            },
            message: `Simulated IPN Registration (resilient fallback: ${error.message})`
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      // ==========================================
      // 3. Endpoint: /api/pesapal/submit-order
      // ==========================================
      if (pathname === "/api/pesapal/submit-order" && method === "POST") {
        let reqBody: any = {};
        try {
          reqBody = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ success: false, message: "Invalid JSON request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const { amount, description, phone, email, firstName, lastName, ipnId, reference } = reqBody;

        if (!amount || !description || !phone || !email || !firstName || !lastName) {
          return new Response(JSON.stringify({
            success: false,
            message: "Missing required order fields (amount, description, phone, email, firstName, lastName)",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const key = request.headers.get("x-pesapal-key") || env.PESAPAL_CONSUMER_KEY;
        const secret = request.headers.get("x-pesapal-secret") || env.PESAPAL_CONSUMER_SECRET;

        // Sandbox / Simulated Flow if variables aren't defined
        if (!key || !secret) {
          const txId = reference || `TXN-WORKER-${Math.floor(Math.random() * 900000 + 100000)}`;
          const trackingId = `sim-track-${Math.floor(Math.random() * 900000 + 100000)}`;
          const redirectUrl = `/api/pesapal/mock-gateway?amount=${amount}&txId=${txId}&trackingId=${trackingId}&description=${encodeURIComponent(description)}`;

          mockOrders[trackingId] = {
            amount: parseFloat(amount),
            description,
            status: "PENDING",
            txId,
          };

          return new Response(JSON.stringify({
            success: true,
            transactionId: txId,
            order_tracking_id: trackingId,
            redirect_url: redirectUrl,
            message: "Simulated sandbox mode (keys not configured)"
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        try {
          const { token } = await getPesapalToken(request.headers);
          const baseUrl = getPesapalBaseUrl(request.headers);
          const txId = reference || `TXN-WORKER-PST-${Math.floor(Math.random() * 900000 + 100000)}`;

          const orderPayload = {
            id: txId,
            amount: parseFloat(amount),
            currency: "UGX",
            description: description,
            callback_url: `${url.protocol}//${url.host}/api/pesapal/callback`,
            notification_id: ipnId || env.PESAPAL_IPN_ID || "",
            billing_address: {
              email_address: email,
              phone_number: phone,
              country_code: "UG",
              first_name: firstName,
              last_name: lastName,
            },
          };

          const response = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(orderPayload),
          });

          const resData = await response.json() as any;
          return new Response(JSON.stringify({
            success: true,
            transactionId: txId,
            ...resData,
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            message: `Real Pesapal API Error: ${error.message}`,
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      // ==========================================
      // 4. Endpoint: /api/pesapal/status/:trackingId
      // ==========================================
      if (pathname.startsWith("/api/pesapal/status/") && method === "GET") {
        const trackingId = pathname.substring("/api/pesapal/status/".length);

        if (!trackingId) {
          return new Response(JSON.stringify({ success: false, message: "Tracking ID is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Handle simulated mock transaction
        if (trackingId.startsWith("sim-track-")) {
          const order = mockOrders[trackingId];
          if (order) {
            return new Response(JSON.stringify({
              success: true,
              data: {
                payment_status_description: order.status === "COMPLETED" ? "Completed" : "Pending",
                amount: order.amount,
                created_date: new Date().toISOString(),
                payment_method: "Simulated Wallet",
                description: order.description,
                merchant_reference: order.txId,
                status_code: order.status === "COMPLETED" ? 1 : 0
              }
            }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          return new Response(JSON.stringify({ success: false, message: "Simulated order not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Handle real Pesapal query
        try {
          const { token } = await getPesapalToken(request.headers);
          const baseUrl = getPesapalBaseUrl(request.headers);

          const response = await fetch(`${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });

          const resData = await response.json();
          return new Response(JSON.stringify({ success: true, data: resData }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      // ==========================================
      // 5. Endpoint: /api/pesapal/mock-gateway (HTML)
      // ==========================================
      if (pathname === "/api/pesapal/mock-gateway" && method === "GET") {
        const amount = searchParams.get("amount") || "0";
        const txId = searchParams.get("txId") || "";
        const trackingId = searchParams.get("trackingId") || "";
        const description = searchParams.get("description") || "Service Payment";

        const gatewayHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Pesapal Sandbox Simulator</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #0d0d0e;
                  color: #fff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 16px;
                }
                .container {
                  width: 100%;
                  max-width: 400px;
                  background: #141416;
                  border: 1px solid #232326;
                  border-radius: 24px;
                  overflow: hidden;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                  text-align: center;
                  padding: 32px 24px;
                }
                .logo {
                  font-weight: 900;
                  font-size: 22px;
                  color: #009688;
                  letter-spacing: 2px;
                  margin-bottom: 8px;
                }
                .logo span {
                  color: #39FF14;
                }
                .badge {
                  display: inline-block;
                  background: rgba(57, 255, 20, 0.1);
                  color: #39FF14;
                  font-size: 10px;
                  font-weight: 900;
                  text-transform: uppercase;
                  padding: 4px 12px;
                  border-radius: 12px;
                  letter-spacing: 1px;
                  margin-bottom: 24px;
                }
                .amount {
                  font-size: 36px;
                  font-weight: 900;
                  color: #fff;
                  margin: 12px 0;
                }
                .desc {
                  font-size: 13px;
                  color: #a1a1a9;
                  margin-bottom: 8px;
                  word-break: break-all;
                }
                .ref {
                  font-family: monospace;
                  font-size: 12px;
                  color: #727278;
                  margin-bottom: 32px;
                }
                .pay-btn {
                  width: 100%;
                  background: #39FF14;
                  color: #000;
                  border: none;
                  border-radius: 16px;
                  padding: 18px;
                  font-size: 15px;
                  font-weight: 900;
                  cursor: pointer;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  transition: transform 0.1s, background-color 0.2s;
                  box-shadow: 0 4px 20px rgba(57, 255, 20, 0.2);
                }
                .pay-btn:hover {
                  background: #32dd10;
                }
                .pay-btn:active {
                  transform: scale(0.98);
                }
                .footer {
                  margin-top: 32px;
                  font-size: 11px;
                  color: #4e4e54;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo"><i class="fa-solid fa-layer-group"></i> PESA<span>VAL</span></div>
                <div class="badge">Workers Cloud Simulation</div>
                
                <div class="desc" style="color: #727278; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 1px;">Total Amount</div>
                <div class="amount">UGX ${Number(amount).toLocaleString()}</div>
                <div class="desc" style="font-weight: 500;">${description || "NXT DO Service"}</div>
                <div class="ref">Ref: ${txId}</div>

                <button class="pay-btn" onclick="completePayment(this)">
                  <i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Complete Payment Instantly
                </button>

                <div class="footer">
                  <i class="fa-solid fa-shield-halved"></i> 100% Secure Sandbox Test Environment
                </div>
              </div>

              <script>
                let clicked = false;
                function completePayment(btn) {
                  if (clicked) return;
                  clicked = true;
                  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
                  btn.style.opacity = '0.7';
                  btn.style.cursor = 'not-allowed';

                  fetch('/api/pesapal/mock-confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trackingId: '${trackingId}' })
                  })
                  .then(res => res.json())
                  .then(() => {
                    window.location.href = '/api/pesapal/callback?OrderTrackingId=${trackingId}&OrderMerchantReference=${txId}';
                  })
                  .catch(err => {
                    console.error(err);
                    window.location.href = '/api/pesapal/callback?OrderTrackingId=${trackingId}&OrderMerchantReference=${txId}';
                  });
                }
              </script>
            </body>
          </html>
        `;

        return new Response(gatewayHTML, {
          headers: { "Content-Type": "text/html", ...corsHeaders },
        });
      }

      // ==========================================
      // 6. Endpoint: /api/pesapal/mock-confirm
      // ==========================================
      if (pathname === "/api/pesapal/mock-confirm" && method === "POST") {
        let reqBody: any = {};
        try {
          reqBody = await request.json();
        } catch (_) {}

        const { trackingId } = reqBody;
        if (trackingId && mockOrders[trackingId]) {
          mockOrders[trackingId].status = "COMPLETED";
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ==========================================
      // 7. Endpoint: /api/pesapal/callback (HTML)
      // ==========================================
      if (pathname === "/api/pesapal/callback") {
        const orderTrackingId = searchParams.get("OrderTrackingId") || "";
        const orderMerchantReference = searchParams.get("OrderMerchantReference") || "";

        const callbackHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Payment Callback</title>
              <style>
                body { font-family: sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { text-align: center; border: 1px solid #333; padding: 40px; border-radius: 20px; background: #111; max-width: 400px; }
                h2 { color: #39FF14; }
                button { background: #39FF14; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Payment Completed</h2>
                <p>Tracking ID: ${orderTrackingId}</p>
                <p>Merchant Reference: ${orderMerchantReference}</p>
                <button onclick="window.close()">Close & Return</button>
              </div>
            </body>
          </html>
        `;

        return new Response(callbackHTML, {
          headers: { "Content-Type": "text/html", ...corsHeaders },
        });
      }

      // ==========================================
      // 8. Endpoint: /api/concierge (Gemini AI Proxy)
      // ==========================================
      if (pathname === "/api/concierge" && method === "POST") {
        let reqBody: any = {};
        try {
          reqBody = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ success: false, message: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const { userMsg, trialsRemaining } = reqBody;
        const apiKey = env.GEMINI_API_KEY;

        if (!apiKey) {
          return new Response(JSON.stringify({
            success: false,
            message: "GEMINI_API_KEY environment variable is not configured on your Cloudflare Worker",
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Standard REST payload to talk to Gemini API directly from Cloudflare V8
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const systemPrompt = `User: ${userMsg}\nContext: You are the NXT DO Security Concierge. 
        Promotional Info: User has ${trialsRemaining} free trials remaining.
        Monetization & Safety Logic:
        - WhatsApp Unlock / Handshake: 2,000 UGX.
        - FREE TRIALS: All new users get 2 free connections. Encourage them to use these!
        - Why the fee? It filters out bots/scammers and acts as a security escrow.
        - Safety: Recommend meeting only at safe, public spots (Cafes, Malls). Use Google Maps grounding to suggest real places if the user asks for a location.
        - Payments: We support Airtel/MTN and now standard secure mobile wallets integrated via Pesapal.`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: systemPrompt }]
            }]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned error: ${errText}`);
        }

        const geminiData = await response.json() as any;
        const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "I am currently undergoing security maintenance. Please try again soon!";

        return new Response(JSON.stringify({ success: true, text: replyText }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ==========================================
      // Fallback: 404 for API, or Static File serving instructions
      // ==========================================
      return new Response(JSON.stringify({
        success: false,
        message: `Worker received request for ${pathname} but no route matched.`,
      }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } catch (err: any) {
      return new Response(JSON.stringify({
        success: false,
        message: err.message || "An unexpected error occurred in Cloudflare Worker.",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }
};
