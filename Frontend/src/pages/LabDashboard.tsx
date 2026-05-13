import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import StatusBadge from "../components/lab/StatusBadge";
import ResultUploader from "../components/lab/ResultUploader";
import { labService, type LabOrder } from "../services/labService";

export default function LabDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOrders = () => {
    setLoading(true);
    setError("");
    labService.getOrders({ status: "pending,in_progress" })
      .then(setOrders)
      .catch(err => setError(err?.message || "Could not load lab orders."))
      .finally(() => setLoading(false));
  };

  useEffect(loadOrders, []);

  const replaceOrder = (updated: LabOrder) =>
    setOrders(prev => updated.status === "completed"
      ? prev.filter(order => order._id !== updated._id)
      : prev.map(order => order._id === updated._id ? updated : order)
    );

  const markComplete = async (order: LabOrder) => {
    try {
      const updated = await labService.markComplete(order._id);
      replaceOrder(updated);
    } catch (err: any) {
      alert(err?.message || "Could not mark complete.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-teal-300" />
            <span className="font-bold">Lab Technician Dashboard</span>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-5">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Pending Lab Orders</h1>
              <p className="text-sm text-slate-400 mt-1">Enter results, upload PDFs, and complete orders.</p>
            </div>
            <button onClick={loadOrders} className="border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 rounded-xl px-4 py-2 text-sm font-semibold">
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading orders...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-300">{error}</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No pending or in-progress lab orders.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Patient</th>
                    <th className="text-left px-4 py-3 font-semibold">Test name</th>
                    <th className="text-left px-4 py-3 font-semibold">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Doctor</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {orders.map(order => (
                    <tr key={order._id}>
                      <td className="px-4 py-4 text-white font-semibold">{order.patientId?.name || "Patient"}</td>
                      <td className="px-4 py-4 text-slate-300">{order.tests.join(", ")}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${order.priority === "Urgent" ? "bg-red-500/10 text-red-300 border-red-500/30" : "bg-teal-500/10 text-teal-300 border-teal-500/30"}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-4 text-slate-300">Dr. {order.doctorId?.name || "Doctor"}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setActiveOrder(order)} className="border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 rounded-lg px-3 py-1.5 text-xs font-semibold">
                            Enter Results
                          </button>
                          <button onClick={() => markComplete(order)} className="border border-green-500/30 text-green-300 hover:bg-green-500/10 rounded-lg px-3 py-1.5 text-xs font-semibold">
                            Mark Complete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {activeOrder && (
        <ResultUploader
          order={activeOrder}
          saving={saving}
          onClose={() => setActiveOrder(null)}
          onSave={async (formData) => {
            setSaving(true);
            try {
              const updated = await labService.updateResult(activeOrder._id, formData);
              replaceOrder(updated);
              setActiveOrder(null);
            } catch (err: any) {
              alert(err?.message || "Could not save results.");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
