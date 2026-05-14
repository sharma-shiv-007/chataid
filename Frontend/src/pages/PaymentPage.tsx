import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, ChevronLeft, CreditCard, Loader, WalletCards } from "lucide-react";
import { api } from "../api/client";
import { labService } from "../services/labService";

const C = {
  bg: "#020817",
  panel: "rgba(15,23,42,0.96)",
  border: "rgba(148,163,184,0.16)",
  text: "#e2e8f0",
  dim: "#94a3b8",
  blue: "#2563eb",
  blueBg: "rgba(37,99,235,0.18)",
  blueBdr: "rgba(96,165,250,0.4)",
  green: "#22c55e",
  greenBg: "rgba(34,197,94,0.14)",
  greenBdr: "rgba(34,197,94,0.38)",
  yellow: "#facc15",
};

type Step = "select" | "processing" | "success";

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctorName, specialty, amount, appointmentData, paymentFor, labBill } = (location.state || {}) as any;
  const isLabPayment = paymentFor === "lab" && labBill?._id;

  const [selectedMethod, setSelectedMethod] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const fee = Number(amount) > 0 ? Number(amount) : isLabPayment ? Number(labBill?.billAmount) || 0 : 500;
  const paymentTitle = isLabPayment ? "Lab Bill Payment" : "ChatAid Clinic Payment";
  const paymentDescription = isLabPayment ? "Secure Demo Lab Payment Gateway" : "Secure Demo Payment Gateway";
  const successTitle = isLabPayment ? "Lab Bill Paid!" : "Payment Successful!";
  const successSubtitle = isLabPayment
    ? `Lab tests: ${(labBill?.tests || []).join(", ")}`
    : `Appointment booked with ${doctorName || "your doctor"}`;

  useEffect(() => {
    let cancelled = false;

    const fetchWallet = async () => {
      try {
        const data = await api.get("/cancellation/wallet");
        if (!cancelled) setWalletBalance(Number(data.wallet?.balance) || 0);
      } catch {
        if (!cancelled) setWalletBalance(0);
      } finally {
        if (!cancelled) setLoadingWallet(false);
      }
    };

    fetchWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  const paymentMethods = [
    {
      id: "wallet",
      label: "My Wallet",
      icon: "wallet",
      description: loadingWallet
        ? "Loading wallet balance..."
        : walletBalance >= fee
          ? `INR ${walletBalance} available - enough to pay`
          : walletBalance > 0
            ? `INR ${walletBalance} available - not enough for full payment`
            : "INR 0 available",
      disabled: loadingWallet || walletBalance <= 0,
      highlight: !loadingWallet && walletBalance >= fee,
    },
    { id: "card", label: "Credit / Debit Card", icon: "Card", description: "Visa, Mastercard, Rupay" },
    { id: "upi", label: "UPI", icon: "UPI", description: "Pay via UPI ID" },
    { id: "gpay", label: "Google Pay", icon: "GPay", description: "Pay via Google Pay" },
    { id: "phonepe", label: "PhonePe", icon: "Pe", description: "Pay via PhonePe" },
    { id: "paytm", label: "Paytm", icon: "Pay", description: "Pay via Paytm" },
    { id: "netbanking", label: "Net Banking", icon: "Bank", description: "All major banks supported" },
  ];

  const handlePay = async () => {
    if (!selectedMethod) {
      setError("Please select a payment method.");
      return;
    }

    if (selectedMethod === "wallet" && walletBalance < fee) {
      setError(`Insufficient wallet balance. You have INR ${walletBalance}, but need INR ${fee}.`);
      return;
    }

    if (!isLabPayment && (!appointmentData?.doctorId || !appointmentData?.dateKey || !appointmentData?.time)) {
      setError("Appointment details are missing. Please start booking again.");
      return;
    }

    setStep("processing");
    setError("");

    window.setTimeout(async () => {
      try {
        if (selectedMethod === "wallet") {
          const walletData = await api.post("/cancellation/wallet/deduct", {
            amount: fee,
            description: isLabPayment
              ? `Payment for lab tests: ${(labBill?.tests || []).join(", ")}`
              : `Payment for appointment with ${doctorName || "doctor"}`,
            appointmentId: null,
          });
          setWalletBalance(Number(walletData.newBalance) || 0);
        }

        if (isLabPayment) {
          await labService.payBill(labBill._id, "online");
        } else {
          await api.post("/appointments/book", {
            ...appointmentData,
            paymentStatus: "paid",
            paymentMethod: selectedMethod,
            consultationFee: fee,
          });
        }

        setStep("success");
        window.setTimeout(() => navigate("/dashboard"), 1800);
      } catch (err: any) {
        setError(err?.message || "Payment failed. Please try again.");
        setStep("select");
      }
    }, 1800);
  };

  if (step === "processing") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <Loader size={56} color={C.blue} style={{ animation: "spin .8s linear infinite", margin: "0 auto 22px" }} />
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Processing Payment...</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Please do not close this window</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <CheckCircle size={72} color={C.green} style={{ margin: "0 auto 20px" }} />
          <h2 style={{ fontSize: 30, fontWeight: 900, color: C.green, marginBottom: 8 }}>{successTitle}</h2>
          <p style={{ color: C.text, marginBottom: 6 }}>INR {fee} paid via {selectedMethod}</p>
          <p style={{ color: C.dim }}>{successSubtitle}</p>
          {selectedMethod === "wallet" && (
            <p style={{ color: C.green, marginTop: 10, fontSize: 13, fontWeight: 700 }}>
              Wallet balance updated: INR {walletBalance} remaining
            </p>
          )}
          <p style={{ color: "#64748b", marginTop: 18, fontSize: 13 }}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", color: C.text }}>
      <div style={{ width: "100%", maxWidth: 460, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: "0 28px 90px rgba(0,0,0,0.45)", overflow: "hidden" }}>
        <div style={{ background: C.blue, padding: "18px 20px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>{paymentTitle}</h2>
          <p style={{ color: "#bfdbfe", fontSize: 13, marginTop: 4 }}>{paymentDescription}</p>
        </div>

        <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
          {isLabPayment ? (
            <>
              <SummaryRow label="Tests" value={(labBill?.tests || []).join(", ") || "Lab tests"} />
              <SummaryRow label="Doctor" value={`Dr. ${labBill?.doctorId?.name || "Doctor"}`} />
              <SummaryRow label="Status" value={labBill?.paymentStatus === "cash_paid" ? "Cash paid" : labBill?.paymentStatus === "paid_online" ? "Paid online" : "Unpaid"} />
            </>
          ) : (
            <>
              <SummaryRow label="Doctor" value={doctorName || "Doctor"} />
              <SummaryRow label="Specialty" value={specialty || "General"} />
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 900, fontSize: 17 }}>Total Amount</span>
            <span style={{ color: C.green, fontWeight: 900, fontSize: 26 }}>INR {fee}</span>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Select Payment Method</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paymentMethods.map(method => {
              const selected = selectedMethod === method.id;
              const isWallet = method.id === "wallet";

              return (
                <button
                  key={method.id}
                  onClick={() => !method.disabled && setSelectedMethod(method.id)}
                  disabled={method.disabled}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px",
                    borderRadius: 12,
                    border: `2px solid ${selected ? (isWallet ? C.greenBdr : C.blueBdr) : method.highlight ? C.greenBdr : C.border}`,
                    background: selected ? (isWallet ? C.greenBg : C.blueBg) : method.highlight ? "rgba(34,197,94,0.08)" : "rgba(30,41,59,0.72)",
                    color: method.disabled ? "#475569" : selected ? C.text : C.dim,
                    cursor: method.disabled ? "not-allowed" : "pointer",
                    opacity: method.disabled ? 0.52 : 1,
                    textAlign: "left",
                    fontFamily: "inherit",
                    minHeight: 62,
                  }}
                >
                  <span style={{ minWidth: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: method.icon.length > 3 ? 10 : 13, fontWeight: 900, color: isWallet && !method.disabled ? C.green : "inherit" }}>
                    {isWallet ? <WalletCards size={18} /> : method.icon}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: isWallet && !method.disabled ? C.green : C.text }}>
                      {method.label}
                      {method.highlight && (
                        <span style={{ color: "#bbf7d0", background: "rgba(22,101,52,0.6)", borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 900 }}>
                          Recommended
                        </span>
                      )}
                    </span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 11, color: method.disabled ? "#64748b" : C.dim }}>
                      {method.description}
                    </span>
                  </span>
                  {selected && <CheckCircle size={17} color={isWallet ? C.green : C.blue} />}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ margin: "0 20px 16px", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: "9px 12px", textAlign: "center", color: C.yellow, fontSize: 12, fontWeight: 800 }}>
          Demo Mode - No real money charged
        </div>

        {error && <div style={{ margin: "0 20px 16px", color: "#fca5a5", fontSize: 12, textAlign: "center" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, padding: "0 20px 20px" }}>
          <button onClick={() => navigate(-1)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, cursor: "pointer", fontWeight: 800 }}>
            <ChevronLeft size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Cancel
          </button>
          <button onClick={handlePay} disabled={!selectedMethod} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.blueBdr}`, background: selectedMethod ? C.blue : "rgba(37,99,235,0.35)", color: "#fff", cursor: selectedMethod ? "pointer" : "not-allowed", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CreditCard size={16} /> {selectedMethod === "wallet" ? `Pay INR ${fee} from Wallet` : `Pay INR ${fee}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: C.dim, fontSize: 13, marginBottom: 10 }}>
      <span>{label}</span>
      <span style={{ color: C.text, fontWeight: 800, textAlign: "right" }}>{value}</span>
    </div>
  );
}
