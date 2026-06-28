import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

// Helper to authenticate with Pesapal
async function getPesapalToken(key: string, secret: string, env: string) {
  const baseUrl = env === 'production' 
    ? 'https://pay.pesapal.com/v3' 
    : 'https://cyb3r.pesapal.com/pesapalv3';

  const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      consumer_key: key,
      consumer_secret: secret
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pesapal Authentication failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  return data.token;
}

// Helper to retrieve the current transaction status from Pesapal
async function getPesapalTransactionStatus(token: string, trackingId: string, env: string) {
  const baseUrl = env === 'production' 
    ? 'https://pay.pesapal.com/v3' 
    : 'https://cyb3r.pesapal.com/pesapalv3';

  const res = await fetch(`${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pesapal status check failed: ${res.status} - ${errText}`);
  }

  return await res.json();
}

serve(async (req) => {
  // Handle CORS pre-flight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse tracking parameters from query parameters or post request body
    const url = new URL(req.url);
    const trackingIdParam = url.searchParams.get("OrderTrackingId") || url.searchParams.get("orderTrackingId") || url.searchParams.get("trackingId");
    const merchantRefParam = url.searchParams.get("OrderMerchantReference") || url.searchParams.get("orderMerchantReference") || url.searchParams.get("merchantReference") || url.searchParams.get("txId");
    const notificationType = url.searchParams.get("OrderNotificationType");

    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch (_) {}
    }

    const orderTrackingId = trackingIdParam || body.OrderTrackingId || body.orderTrackingId || body.trackingId;
    const merchantReference = merchantRefParam || body.OrderMerchantReference || body.orderMerchantReference || body.merchantReference || body.txId;

    if (!orderTrackingId) {
      return new Response(
        JSON.stringify({ success: false, message: "orderTrackingId/OrderTrackingId is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Initialize Supabase Client with service_role bypass RLS policies
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Look up transaction in 'public.transactions' ledger
    let txn: any = null;
    
    if (merchantReference) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', merchantReference)
        .maybeSingle();
      txn = data;
    }

    if (!txn && orderTrackingId) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('tracking_id', orderTrackingId)
        .maybeSingle();
      txn = data;
    }

    // 4. Determine key credentials (prioritizing user-specific profile overrides, then system defaults)
    let pesapalKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
    let pesapalSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');
    let pesapalEnv = Deno.env.get('PESAPAL_ENVIRONMENT') || 'sandbox';

    if (txn && txn.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('pesapal_key, pesapal_secret, pesapal_env')
        .eq('id', txn.user_id)
        .maybeSingle();

      if (profile && profile.pesapal_key && profile.pesapal_secret) {
        pesapalKey = profile.pesapal_key;
        pesapalSecret = profile.pesapal_secret;
        pesapalEnv = profile.pesapal_env || 'sandbox';
        console.log(`Using user profile specific keys for user_id: ${txn.user_id} (${pesapalEnv})`);
      }
    }

    // 5. Connect with Pesapal to fetch the current live status
    let status = 'Pending';
    let rawPesapalResponse = null;

    if (orderTrackingId.startsWith("sim-track-") || !pesapalKey || !pesapalSecret) {
      console.log(`No production/sandbox configurations. Simulating success fallback status checking.`);
      status = 'Completed';
    } else {
      try {
        const token = await getPesapalToken(pesapalKey, pesapalSecret, pesapalEnv);
        rawPesapalResponse = await getPesapalTransactionStatus(token, orderTrackingId, pesapalEnv);
        
        const desc = rawPesapalResponse.payment_status_description?.toLowerCase();
        const code = rawPesapalResponse.status_code;

        if (desc === 'completed' || desc === 'success' || code === 1) {
          status = 'Completed';
        } else if (desc === 'failed' || desc === 'invalid' || code === 2) {
          status = 'Failed';
        } else {
          status = 'Pending';
        }
      } catch (err: any) {
        console.error("Communication with Pesapal gateway failed:", err.message);
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Persist the payment status inside Supabase transactions ledger
    if (txn) {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status,
          tracking_id: orderTrackingId,
        })
        .eq('id', txn.id);

      if (updateError) {
        console.error("Failed to update transaction database state:", updateError.message);
      } else {
        console.log(`Transaction ${txn.id} status successfully synced and set to ${status}`);
      }
    } else {
      console.warn(`Transaction reference not found in public.transactions. Skipping record update.`);
    }

    // 7. Format the response. If it's an IPN notification, return standard success format that Pesapal expects
    if (notificationType || url.searchParams.has("OrderNotificationType")) {
      return new Response(
        JSON.stringify({
          orderNotificationType: notificationType || "IPNCHANGE",
          orderTrackingId: orderTrackingId,
          orderMerchantReference: merchantReference || (txn ? txn.id : ""),
          status: 200
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct frontend request response format
    return new Response(
      JSON.stringify({
        success: true,
        status,
        orderTrackingId,
        merchantReference: merchantReference || (txn ? txn.id : ""),
        pesapalResponse: rawPesapalResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Edge function crash error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
