import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, ChevronLeft, CreditCard, Lock, ShieldCheck, Smartphone, Building2, Wallet } from "lucide-react";
import { api } from "../api/client";
import { labService } from "../services/labService";

type Step = "select" | "processing" | "success";
type Method = "upi" | "card" | "netbanking" | "wallet" | "";

const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda", "Canara Bank", "Union Bank of India", "Yes Bank"];

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctorName, specialty, amount, appointmentData, paymentFor, labBill } = (location.state || {}) as any;
  const isLabPayment = paymentFor === "lab" && labBill?._id;

  const [step, setStep]               = useState<Step>("select");
  const [method, setMethod]           = useState<Method>("");
  const [upiId, setUpiId]             = useState("");
  const [upiError, setUpiError]       = useState("");
  const [cardNum, setCardNum]         = useState("");
  const [cardName, setCardName]       = useState("");
  const [cardExpiry, setCardExpiry]   = useState("");
  const [cardCvv, setCardCvv]         = useState("");
  const [bank, setBank]               = useState("");
  const [error, setError]             = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const fee = Number(amount) > 0 ? Number(amount) : isLabPayment ? Number(labBill?.billAmount) || 0 : 500;
  const merchantName = isLabPayment ? "ChatAid Clinic — Lab" : "ChatAid Clinic";
  const orderDesc    = isLabPayment
    ? (labBill?.tests || []).join(", ") || "Lab Tests"
    : `Appointment with ${doctorName || "Doctor"}`;

  useEffect(() => {
    api.get("/cancellation/wallet")
      .then(d => setWalletBalance(Number(d.wallet?.balance) || 0))
      .catch(() => setWalletBalance(0))
      .finally(() => setLoadingWallet(false));
  }, []);

  const formatCard = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const canPay = () => {
    if (!method) return false;
    if (method === "upi") return upiId.includes("@") && upiId.length > 3;
    if (method === "card") return cardNum.replace(/\s/g, "").length === 16 && cardName && cardExpiry.length === 5 && cardCvv.length >= 3;
    if (method === "netbanking") return !!bank;
    if (method === "wallet") return !loadingWallet && walletBalance >= fee;
    return false;
  };

  const handlePay = async () => {
    if (!canPay()) return;
    if (method === "upi" && !upiId.match(/^[\w.\-_]{3,}@[\w]{3,}$/)) {
      setUpiError("Enter a valid UPI ID (e.g. name@upi)");
      return;
    }
    setUpiError("");
    setStep("processing");
    setError("");

    window.setTimeout(async () => {
      try {
        if (method === "wallet") {
          await api.post("/cancellation/wallet/deduct", {
            amount: fee,
            description: isLabPayment ? `Lab: ${orderDesc}` : `Appointment: ${orderDesc}`,
            appointmentId: null,
          });
        }
        if (isLabPayment) {
          await labService.payBill(labBill._id, "online");
        } else {
          await api.post("/appointments/book", {
            ...appointmentData,
            paymentStatus: "paid",
            paymentMethod: method,
            consultationFee: fee,
          });
        }
        setStep("success");
        window.setTimeout(() => navigate("/dashboard"), 2200);
      } catch (err: any) {
        setError(err?.message || "Payment failed. Please try again.");
        setStep("select");
      }
    }, 2000);
  };

  /* ── Processing screen ─────────────────────────────────────────────────── */
  if (step === "processing") return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mx-auto mb-6 h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock size={28} className="text-blue-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Processing Payment</h2>
        <p className="text-slate-400 text-sm">Please do not close this window</p>
        <p className="text-slate-600 text-xs mt-3">Secured by 256-bit SSL encryption</p>
      </div>
    </div>
  );

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (step === "success") return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 border-2 border-green-500/30">
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-green-400 mb-2">Payment Successful</h2>
        <p className="text-white font-semibold mb-1">{orderDesc}</p>
        <p className="text-slate-400 text-sm mb-4">₹{fee.toLocaleString("en-IN")} paid via {method?.toUpperCase()}</p>
        <div className="bg-slate-800/60 rounded-xl p-4 text-xs text-slate-400 mb-5">
          <div className="flex justify-between mb-1"><span>Transaction ID</span><span className="text-white font-mono">TXN{Date.now().toString().slice(-10)}</span></div>
          <div className="flex justify-between"><span>Status</span><span className="text-green-400 font-bold">SUCCESS</span></div>
        </div>
        <p className="text-slate-500 text-xs">Redirecting to dashboard…</p>
      </div>
    </div>
  );

  /* ── Main payment UI ────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full max-w-3xl flex rounded-2xl overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] border border-slate-800">

        {/* ── Left panel: order summary ────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-72 flex-shrink-0 bg-[#0f1f3d] text-white p-6">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">R</div>
            <span className="text-xs text-blue-300 font-semibold tracking-wide">Secure Checkout</span>
          </div>

          {/* Merchant */}
          <div className="mb-6">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl mb-3">🏥</div>
            <p className="font-bold text-base">{merchantName}</p>
            <p className="text-blue-200 text-xs mt-1">{orderDesc}</p>
          </div>

          {/* Amount */}
          <div className="rounded-xl bg-white/8 border border-white/10 p-4 mb-6">
            <p className="text-blue-300 text-xs mb-1 font-medium uppercase tracking-wide">Amount Payable</p>
            <p className="text-4xl font-black">₹{fee.toLocaleString("en-IN")}</p>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 text-xs text-blue-200 flex-1">
            {isLabPayment ? (
              <>
                {(labBill?.billItems || []).map((item: any) => (
                  <div key={item.testName} className="flex justify-between">
                    <span>{item.testName}</span><span className="text-white">₹{item.price}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-white">
                  <span>Total</span><span>₹{fee.toLocaleString("en-IN")}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span>Doctor</span><span className="text-white">{doctorName || "—"}</span></div>
                {specialty && <div className="flex justify-between"><span>Specialty</span><span className="text-white">{specialty}</span></div>}
                <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-white">
                  <span>Consultation fee</span><span>₹{fee.toLocaleString("en-IN")}</span>
                </div>
              </>
            )}
          </div>

          {/* Trust badges */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2">
            <ShieldCheck size={14} className="text-green-400 flex-shrink-0" />
            <span className="text-[10px] text-blue-300">256-bit SSL · PCI-DSS Compliant · Demo Mode</span>
          </div>
        </div>

        {/* ── Right panel: payment methods ─────────────────────────────── */}
        <div className="flex-1 bg-slate-900 flex flex-col">
          {/* Mobile header */}
          <div className="md:hidden bg-blue-700 px-5 py-4">
            <p className="font-bold text-white text-sm">{merchantName}</p>
            <p className="text-blue-200 text-xs">{orderDesc}</p>
            <p className="text-white font-black text-2xl mt-1">₹{fee.toLocaleString("en-IN")}</p>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <span className="text-white font-bold text-sm">Choose Payment Method</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Lock size={11} /><span>Secure</span>
            </div>
          </div>

          {/* Demo banner */}
          <div className="mx-5 mt-4 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 flex items-center gap-2">
            <span className="text-amber-400 text-sm">⚠</span>
            <span className="text-amber-300 text-xs font-semibold">Demo Mode — no real money will be charged</span>
          </div>

          {/* Method tabs */}
          <div className="flex border-b border-slate-800 mx-5 mt-4 gap-1">
            {[
              { id: "upi",         icon: Smartphone,  label: "UPI"         },
              { id: "card",        icon: CreditCard,  label: "Card"        },
              { id: "netbanking",  icon: Building2,   label: "Net Banking" },
              { id: "wallet",      icon: Wallet,      label: "Wallet"      },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => { setMethod(id as Method); setError(""); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                  ${method === id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {/* Method content */}
          <div className="flex-1 px-5 py-4 overflow-y-auto">

            {/* UPI */}
            {method === "upi" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Enter UPI ID</label>
                  <div className="flex gap-2">
                    <input value={upiId} onChange={e => { setUpiId(e.target.value); setUpiError(""); }}
                      placeholder="yourname@upi"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors" />
                    <button onClick={() => {
                      if (upiId.match(/^[\w.\-_]{3,}@[\w]{3,}$/)) setUpiError("");
                      else setUpiError("Invalid UPI ID");
                    }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 rounded-xl transition-colors">
                      Verify
                    </button>
                  </div>
                  {upiError && <p className="text-red-400 text-xs mt-1">{upiError}</p>}
                  {upiId.match(/^[\w.\-_]{3,}@[\w]{3,}$/) && !upiError && (
                    <p className="text-green-400 text-xs mt-1 flex items-center gap-1"><CheckCircle size={11} /> UPI ID verified</p>
                  )}
                </div>
                <div className="text-xs text-slate-500">— or pay using —</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Google Pay",  short: "GPay",   color: "bg-white text-slate-900" },
                    { label: "PhonePe",     short: "Pe",     color: "bg-[#5f259f] text-white" },
                    { label: "Paytm",       short: "Pay",    color: "bg-[#00baf2] text-white" },
                  ].map(app => (
                    <button key={app.label} onClick={() => setUpiId(`${app.label.toLowerCase().replace(" ", "")}@upi`)}
                      className={`rounded-xl py-3 text-xs font-black border border-slate-700 hover:border-slate-500 transition-colors ${app.color}`}>
                      {app.short}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card */}
            {method === "card" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-1.5">Card Number</label>
                  <div className="relative">
                    <input value={cardNum} onChange={e => setCardNum(formatCard(e.target.value))}
                      placeholder="0000  0000  0000  0000" maxLength={19}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-blue-500 transition-colors pr-16" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                      {cardNum.startsWith("4") ? "VISA" : cardNum.startsWith("5") ? "MC" : cardNum.startsWith("6") ? "RuPay" : ""}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-1.5">Name on Card</label>
                  <input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())}
                    placeholder="FULL NAME"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 font-semibold mb-1.5">Expiry</label>
                    <input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY" maxLength={5}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-semibold mb-1.5">CVV</label>
                    <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••" type="password" maxLength={4}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <p className="text-slate-600 text-xs flex items-center gap-1"><Lock size={10} /> Your card details are encrypted and secure</p>
              </div>
            )}

            {/* Net Banking */}
            {method === "netbanking" && (
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-3">Select Your Bank</label>
                <div className="grid grid-cols-2 gap-2">
                  {BANKS.map(b => (
                    <button key={b} onClick={() => setBank(b)}
                      className={`text-left text-xs px-3 py-3 rounded-xl border transition-colors font-medium
                        ${bank === b
                          ? "border-blue-500 bg-blue-500/15 text-blue-300"
                          : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"}`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet */}
            {method === "wallet" && (
              <div>
                <div className={`rounded-xl border p-4 mb-4 ${walletBalance >= fee ? "border-green-500/30 bg-green-500/8" : "border-slate-700 bg-slate-800/60"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">ChatAid Wallet</p>
                      <p className="text-slate-400 text-xs mt-0.5">Available balance</p>
                    </div>
                    <p className={`text-2xl font-black ${walletBalance >= fee ? "text-green-400" : "text-slate-400"}`}>
                      {loadingWallet ? "…" : `₹${walletBalance.toLocaleString("en-IN")}`}
                    </p>
                  </div>
                  {!loadingWallet && walletBalance < fee && (
                    <p className="mt-3 text-xs text-red-400 font-semibold">
                      Insufficient balance. You need ₹{(fee - walletBalance).toLocaleString("en-IN")} more.
                    </p>
                  )}
                </div>
                {!loadingWallet && walletBalance >= fee && (
                  <p className="text-green-400 text-xs flex items-center gap-1"><CheckCircle size={11} /> Sufficient balance to complete payment</p>
                )}
              </div>
            )}

            {/* Empty state */}
            {!method && (
              <div className="text-center py-10 text-slate-600">
                <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a payment method above</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {error && <p className="mx-5 mb-2 text-xs text-red-400 text-center">{error}</p>}
          <div className="px-5 pb-5 pt-3 border-t border-slate-800">
            <button onClick={handlePay} disabled={!canPay()}
              className={`w-full py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2
                ${canPay()
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 active:scale-[0.98]"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}>
              <Lock size={14} />
              Pay ₹{fee.toLocaleString("en-IN")}
              {method && ` via ${method === "upi" ? "UPI" : method === "card" ? "Card" : method === "netbanking" ? "Net Banking" : "Wallet"}`}
            </button>
            <p className="text-center text-slate-600 text-[10px] mt-2 flex items-center justify-center gap-1">
              <ShieldCheck size={10} /> Powered by ChatAid Secure Pay · Demo Mode
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
