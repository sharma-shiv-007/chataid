import { useState } from "react";
import { CheckCircle, FlaskConical, X } from "lucide-react";
import type { LabOrder, LabResult } from "../../services/labService";

interface ResultUploaderProps {
  order: LabOrder;
  saving?: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
}

const FLAG_OPTIONS: { value: LabResult["flag"]; label: string; color: string }[] = [
  { value: "",         label: "No flag",  color: "text-slate-400" },
  { value: "normal",   label: "Normal",   color: "text-green-400" },
  { value: "low",      label: "Low",      color: "text-yellow-400" },
  { value: "high",     label: "High",     color: "text-orange-400" },
  { value: "critical", label: "Critical", color: "text-red-400" },
];

const flagPill = (flag: LabResult["flag"]) => {
  if (flag === "normal")   return "bg-green-500/15 text-green-300 border-green-500/30";
  if (flag === "low")      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  if (flag === "high")     return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (flag === "critical") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "";
};

export default function ResultUploader({ order, saving = false, onClose, onSave }: ResultUploaderProps) {
  const [results, setResults] = useState<Record<string, LabResult>>(() =>
    Object.fromEntries(order.tests.map(test => {
      const existing = order.results?.find(r => r.testName === test);
      return [test, {
        testName: test,
        value: existing?.value || "",
        unit: existing?.unit || "",
        normalRange: existing?.normalRange || "",
        flag: existing?.flag || "",
        values: existing?.values || "",
      }];
    }))
  );

  const update = (test: string, field: keyof LabResult, val: string) =>
    setResults(prev => ({ ...prev, [test]: { ...prev[test], [field]: val } }));

  const submit = () => {
    const formData = new FormData();
    formData.append("results", JSON.stringify(order.tests.map(t => results[t])));
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-500/25">
              <FlaskConical size={17} className="text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Enter Results</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {order.patientId?.name || "Patient"} &mdash; {order.tests.join(", ")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {order.tests.map(test => {
            const r = results[test];
            const pill = flagPill(r.flag);
            return (
              <div key={test} className={`rounded-xl border p-4 transition-colors ${pill ? `border-current/20 ${pill.split(" ")[0]}` : "border-slate-800 bg-slate-950/50"}`}>
                {/* Test name + flag badge */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-white">{test}</p>
                  {r.flag && (
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${pill}`}>
                      {r.flag}
                    </span>
                  )}
                </div>

                {/* Value + Unit row */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Value</label>
                    <input
                      value={r.value}
                      onChange={e => update(test, "value", e.target.value)}
                      placeholder="e.g. 5.2"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Unit</label>
                    <input
                      value={r.unit}
                      onChange={e => update(test, "unit", e.target.value)}
                      placeholder="e.g. mg/dL"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Normal range + Flag row */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Normal Range</label>
                    <input
                      value={r.normalRange}
                      onChange={e => update(test, "normalRange", e.target.value)}
                      placeholder="e.g. 3.5–5.0"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Flag</label>
                    <select
                      value={r.flag}
                      onChange={e => update(test, "flag", e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors"
                    >
                      {FLAG_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">Notes / Interpretation</label>
                  <textarea
                    value={r.values}
                    onChange={e => update(test, "values", e.target.value)}
                    rows={2}
                    placeholder="Optional notes or interpretation..."
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-800">
          <button
            onClick={submit}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            <CheckCircle size={15} />
            {saving ? "Saving…" : "Save Results"}
          </button>
        </div>
      </div>
    </div>
  );
}
