import { Download, FileText } from "lucide-react";
import type { LabOrder, LabResult } from "../../services/labService";
import StatusBadge from "./StatusBadge";

const flagClass = (flag?: LabResult["flag"]) => {
  if (flag === "normal") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (flag === "low" || flag === "high") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (flag === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-slate-800 bg-slate-950 text-slate-300";
};

export default function ReportViewer({ report }: { report: LabOrder }) {
  const downloadPdf = () => {
    if (report.resultPdfUrl) window.open(report.resultPdfUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">{report.tests.join(", ")}</p>
          <p className="mt-1 text-xs text-slate-500">Ordered by Dr. {report.doctorId?.name || "Doctor"}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="mt-4 grid gap-3">
        {(report.results || []).length === 0 ? (
          <p className="text-sm text-slate-500">No structured result values were entered.</p>
        ) : report.results?.map((result, index) => (
          <div key={`${result.testName}-${index}`} className={`rounded-xl border p-3 ${flagClass(result.flag)}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold">{result.testName}</p>
                <p className="mt-1 text-xs opacity-80">Normal range: {result.normalRange || "Not specified"}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-black">{result.value || result.values || "Not entered"} {result.unit || ""}</p>
                {result.flag && <p className="text-xs font-bold uppercase tracking-wide">{result.flag}</p>}
              </div>
            </div>
            {result.values && result.value && <p className="mt-2 text-xs opacity-80">{result.values}</p>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={!report.resultPdfUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 px-3 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} /> Download as PDF
        </button>
        {report.resultPdfUrl && (
          <a href={report.resultPdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">
            <FileText size={14} /> Open PDF
          </a>
        )}
      </div>
    </div>
  );
}
