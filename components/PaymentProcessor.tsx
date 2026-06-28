import React, { useState, useEffect } from "react";

interface PaymentProcessorProps {
  amount: number;
  serviceName: string;
  onSuccess: () => void;
  onCancel: () => void;
  currentUser?: any;
}

const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  amount,
  serviceName,
  onSuccess,
  onCancel,
  currentUser,
}) => {
  const [provider, setProvider] = useState<"PESAPAL" | null>(null);
  const [step, setStep] = useState<"select" | "processing" | "success">(
    "select",
  );
  const [statusText, setStatusText] = useState("Starting Payment...");
  const [txnId] = useState(
    `TXN-NXT-${Math.floor(Math.random() * 900000 + 100000)}`,
  );

  const [activeRedirectUrl, setActiveRedirectUrl] = useState<string | null>(
    null,
  );
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);

  const handlePesapalPayment = async () => {
    setProvider("PESAPAL");
    setStep("processing");
    setStatusText("Connecting to Pesapal Gateway...");

    try {
      const response = await fetch("/api/pesapal/submit-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          description: `Payment for ${serviceName}`,
          phone: "0712345678",
          email: "customer@example.com",
          firstName: "NXT",
          lastName: "DO Customer",
          reference: txnId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Pesapal setup is missing credentials");
      }

      setStatusText("Redirecting to safe checkout...");
      const redirectUrl = data.redirect_url;
      const trackingId = data.order_tracking_id || data.orderTrackingId;

      if (redirectUrl && trackingId) {
        setActiveRedirectUrl(redirectUrl);
        setActiveTrackingId(trackingId);

        window.open(redirectUrl, "_blank");
        setStatusText("Waiting for payment confirmation...");
      } else {
        throw new Error("No redirect URL or tracking ID received");
      }
    } catch (err: any) {
      console.error("Pesapal payment failed:", err);
      setStatusText(`Error: ${err.message || "Credentials not configured"}`);
      setTimeout(() => {
        setStep("select");
        setProvider(null);
      }, 4000);
    }
  };

  const triggerManualVerify = async () => {
    if (!activeTrackingId) return;
    setStatusText("Verifying with server...");
    try {
      const response = await fetch(`/api/pesapal/status/${activeTrackingId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const isCompleted =
            data.data.payment_status_description === "Completed" ||
            data.data.status_code === 1;
          if (isCompleted) {
            setStatusText("Payment Verified!");
            setStep("success");
            setTimeout(() => {
              onSuccess();
            }, 2000);
          } else {
            setStatusText(
              "Payment is still pending. Complete checkout in the other window.",
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
      setStatusText("Failed to check. Try again in a few seconds.");
    }
  };

  useEffect(() => {
    if (!activeTrackingId || step !== "processing") return;

    let pollCount = 0;
    const maxPolls = 60; // 3 minutes max

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        setStatusText(
          'Payment verification timed out. Click "Verify Payment" to try again.',
        );
        return;
      }

      try {
        const response = await fetch(
          `/api/pesapal/status/${activeTrackingId}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const isCompleted =
              data.data.payment_status_description === "Completed" ||
              data.data.status_code === 1;
            if (isCompleted) {
              clearInterval(interval);
              setStatusText("Payment Verified!");
              setStep("success");
              setTimeout(() => {
                onSuccess();
              }, 2000);
            } else if (
              data.data.payment_status_description === "Failed" ||
              data.data.status_code === 2
            ) {
              clearInterval(interval);
              setStatusText("Payment failed or was cancelled.");
              setTimeout(() => {
                setStep("select");
                setProvider(null);
                setActiveTrackingId(null);
                setActiveRedirectUrl(null);
              }, 3000);
            }
          }
        }
      } catch (e) {
        console.warn("Polling error:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTrackingId, step]);

  return (
    <div className="fixed inset-0 bg-black/98 z-[1000] flex items-center justify-center p-6 backdrop-blur-3xl animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-950 rounded-[56px] border border-zinc-900 overflow-hidden shadow-2xl relative">
        {/* Header Section */}
        <div className="p-10 border-b border-zinc-900 text-center space-y-2">
          <p className="text-[10px] font-black text-[#39FF14] uppercase tracking-[0.4em]">
            Pay Now
          </p>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
            {serviceName}
          </h2>
          <div className="inline-block px-4 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
            <span className="text-white font-black text-sm">
              UGX {amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-10 min-h-[300px] flex flex-col justify-center">
          {step === "select" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <p className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Choose how to pay
              </p>

              <button
                onClick={handlePesapalPayment}
                className="w-full bg-[#009688] text-white font-black py-6 rounded-[28px] flex items-center justify-between px-8 active:scale-95 transition-all shadow-xl shadow-teal-500/10 border border-teal-500/20 group hover:border-teal-400"
              >
                <div className="flex items-center gap-3">
                  <i className="fas fa-credit-card text-[#39FF14]"></i>
                  <span className="text-lg">Pesapal (Card/Mobile)</span>
                </div>
                <i className="fas fa-chevron-right opacity-40"></i>
              </button>

              <button
                onClick={onCancel}
                className="w-full text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] py-4"
              >
                Go Back
              </button>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-300">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-zinc-900 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-4 border-t-transparent rounded-full animate-spin border-[#009688]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-credit-card text-3xl opacity-30 text-teal-500"></i>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-white font-black text-lg uppercase italic tracking-tight">
                  {statusText}
                </p>
                <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">
                  Please wait...
                </p>
              </div>
              {provider === "PESAPAL" && activeRedirectUrl && (
                <div className="w-full space-y-3 pt-2">
                  <a
                    href={activeRedirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block text-center bg-zinc-900 hover:bg-zinc-850 text-white border border-zinc-800 rounded-xl py-3 text-xs font-bold active:scale-95 transition-all"
                  >
                    <i className="fas fa-external-link-alt mr-2 text-teal-400"></i>{" "}
                    Open Gateway Manually
                  </a>
                  <button
                    onClick={triggerManualVerify}
                    className="w-full bg-[#009688] hover:bg-[#00796b] text-white rounded-xl py-3 text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
                  >
                    <i className="fas fa-sync mr-2 animate-spin-slow"></i>{" "}
                    Verify My Payment
                  </button>
                  <button
                    onClick={() => {
                      setStep("select");
                      setProvider(null);
                      setActiveRedirectUrl(null);
                      setActiveTrackingId(null);
                    }}
                    className="w-full text-zinc-500 hover:text-zinc-400 text-[10px] font-black uppercase tracking-widest pt-2"
                  >
                    Cancel Payment
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-[#39FF14] rounded-full flex items-center justify-center text-black shadow-2xl shadow-[#39FF14]/30">
                <i className="fas fa-check text-5xl"></i>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic">
                  Paid Successfully
                </h3>
                <p className="text-[#39FF14] text-[10px] font-black uppercase tracking-widest">
                  {txnId}
                </p>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-[#39FF14] animate-[shimmer_2s_infinite] w-full origin-left"></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Badge */}
        <div className="p-6 bg-black text-center border-t border-zinc-900">
          <div className="flex items-center justify-center gap-2 text-zinc-700">
            <i className="fas fa-shield-halved text-[10px]"></i>
            <span className="text-[8px] font-black uppercase tracking-[0.4em]">
              Safe and Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentProcessor;
