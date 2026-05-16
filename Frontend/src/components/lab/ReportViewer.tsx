import { Download, FileText } from "lucide-react";
import { useState } from "react";
import type { LabOrder, LabResult } from "../../services/labService";
import StatusBadge from "./StatusBadge";

const flagBorder = (flag?: LabResult["flag"]) => {
  if (flag === "normal") return "border-green-500/30 bg-green-500/10";
  if (flag === "low" || flag === "high") return "border-yellow-500/30 bg-yellow-500/10";
  if (flag === "critical") return "border-red-500/30 bg-red-500/10";
  return "border-slate-800 bg-slate-950";
};

const FlagBadge = ({ flag }: { flag?: LabResult["flag"] }) => {
  if (!flag) return null;
  const color =
    flag === "normal"   ? "bg-green-500/20 text-green-300 border-green-500/30" :
    flag === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                          "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${color}`}>
      {flag}
    </span>
  );
};

async function fetchPdfBlob(url: string): Promise<Blob> {
  const token = localStorage.getItem("medicare_token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Could not load PDF");
  return res.blob();
}

export default function ReportViewer({ report }: { report: LabOrder }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState("");

  const handlePdf = async (mode: "open" | "download") => {
    if (!report.resultPdfUrl) return;
    setPdfLoading(true); setPdfError("");
    try {
      const blob = await fetchPdfBlob(report.resultPdfUrl);
      const blobUrl = URL.createObjectURL(blob);
      if (mode === "open") {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `lab-report-${report._id}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch {
      setPdfError("Could not load PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
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
          <div key={`${result.testName}-${index}`} className={`rounded-xl border p-3 ${flagBorder(result.flag)}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-white">{result.testName}</p>
                <p className="mt-1 text-xs text-slate-400">Normal range: {result.normalRange || "Not specified"}</p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <p className="text-lg font-black text-white">
                  {result.value || "—"}
                  {result.unit && <span className="ml-1 text-sm font-normal text-slate-400">{result.unit}</span>}
                </p>
                <FlagBadge flag={result.flag} />
              </div>
            </div>
            {result.values && <p className="mt-2 text-xs text-slate-400">{result.values}</p>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handlePdf("download")}
          disabled={!report.resultPdfUrl || pdfLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 px-3 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} /> {pdfLoading ? "Loading…" : "Download as PDF"}
        </button>
        {report.resultPdfUrl && (
          <button
            type="button"
            onClick={() => handlePdf("open")}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <FileText size={14} /> Open PDF
          </button>
        )}
      </div>
      {pdfError && <p className="mt-2 text-xs text-red-400">{pdfError}</p>}
    </div>
  );
}
