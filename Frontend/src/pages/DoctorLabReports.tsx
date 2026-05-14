import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FileText, FlaskConical, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReportViewer from "../components/lab/ReportViewer";
import StatusBadge from "../components/lab/StatusBadge";
import { labService, type LabOrder } from "../services/labService";

export default function DoctorLabReports() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ["doctor-lab-reports"],
    queryFn: labService.getDoctorReports,
  });

  const formatDate = (report: LabOrder) =>
    new Date(report.completedAt || report.updatedAt || report.createdAt || Date.now()).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="border-b border-slate-800 bg-slate-900/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-teal-300" />
            <span className="font-bold">Patient Lab Results</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl p-5">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white">Completed Lab Results</h1>
          <p className="mt-1 text-sm text-slate-400">Review completed results for lab tests you ordered.</p>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-500">Loading reports...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-300">Could not load reports.</div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-500">No completed lab reports yet.</div>
          ) : reports.map(report => {
            const open = openId === report._id;
            return (
              <div key={report._id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                <button onClick={() => setOpenId(open ? null : report._id)} className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-white">
                      <FileText size={15} className="text-teal-300" />
                      {report.tests.join(", ")}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <UserRound size={13} /> {report.patientId?.name || "Patient"}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays size={13} /> {formatDate(report)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} />
                </button>
                {open && <div className="border-t border-slate-800 p-4"><ReportViewer report={report} /></div>}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
