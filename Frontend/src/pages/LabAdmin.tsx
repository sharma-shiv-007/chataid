import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../components/lab/StatusBadge";
import { labService, type LabOrder, type LabStatus } from "../services/labService";

const statusOptions: Array<"" | LabStatus> = ["", "pending", "in_progress", "completed", "cancelled"];

export default function LabAdmin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"" | LabStatus>("");
  const [date, setDate] = useState("");
  const [department, setDepartment] = useState("");

  const filters = useMemo(() => ({ status, date, department }), [status, date, department]);

  const statsQuery = useQuery({
    queryKey: ["lab-admin-stats", date, department],
    queryFn: () => labService.getAdminStats({ date, department }),
  });

  const ordersQuery = useQuery({
    queryKey: ["lab-admin-orders", filters],
    queryFn: () => labService.getOrders(filters),
  });

  const orders = ordersQuery.data || [];
  const stats = statsQuery.data?.stats || { total: 0, pending: 0, completed: 0, urgent: 0 };
  const departments = statsQuery.data?.departments || [];

  const exportCsv = () => {
    const rows = [
      ["Patient", "Tests", "Priority", "Status", "Doctor", "Department", "Date"],
      ...orders.map(order => [
        order.patientId?.name || "Patient",
        order.tests.join("; "),
        order.priority,
        order.status,
        order.doctorId?.name || "Doctor",
        order.department || "",
        new Date(order.createdAt || Date.now()).toLocaleString("en-IN"),
      ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lab-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="border-b border-slate-800 bg-slate-900/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-teal-300" />
            <span className="font-bold">Lab Admin Overview</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Orders", value: stats.total, color: "text-white" },
            { label: "Pending", value: stats.pending, color: "text-yellow-300" },
            { label: "Completed", value: stats.completed, color: "text-green-300" },
            { label: "Urgent", value: stats.urgent, color: "text-red-300" },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-2 text-3xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">All Lab Orders</h1>
              <p className="mt-1 text-sm text-slate-400">Filter by status, date, or department.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select value={status} onChange={e => setStatus(e.target.value as "" | LabStatus)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500">
                {statusOptions.map(option => <option key={option || "all"} value={option}>{option ? option.replace("_", " ") : "All statuses"}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              <select value={department} onChange={e => setDepartment(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500">
                <option value="">All departments</option>
                {departments.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/30 px-3 py-2 text-sm font-bold text-teal-300 hover:bg-teal-500/10">
                <Download size={15} /> CSV
              </button>
            </div>
          </div>

          {ordersQuery.isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading lab orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No lab orders match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Patient</th>
                    <th className="px-4 py-3 text-left font-semibold">Tests</th>
                    <th className="px-4 py-3 text-left font-semibold">Priority</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Doctor</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {orders.map((order: LabOrder) => (
                    <tr key={order._id}>
                      <td className="px-4 py-4 font-semibold text-white">{order.patientId?.name || "Patient"}</td>
                      <td className="px-4 py-4 text-slate-300">{order.tests.join(", ")}</td>
                      <td className="px-4 py-4 text-slate-300">{order.priority}</td>
                      <td className="px-4 py-4"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-4 text-slate-300">Dr. {order.doctorId?.name || "Doctor"}</td>
                      <td className="px-4 py-4 text-slate-300">{order.department || "General"}</td>
                      <td className="px-4 py-4 text-slate-400">{new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
