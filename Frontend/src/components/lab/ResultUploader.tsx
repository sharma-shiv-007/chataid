import { useState } from "react";
import { CheckCircle, X } from "lucide-react";
import type { LabOrder, LabResult } from "../../services/labService";

interface ResultUploaderProps {
  order: LabOrder;
  saving?: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
}

export default function ResultUploader({ order, saving = false, onClose, onSave }: ResultUploaderProps) {
  const [results, setResults] = useState<Record<string, LabResult>>(() =>
    Object.fromEntries(order.tests.map(test => {
      const existing = order.results?.find(result => result.testName === test);
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
  const [file, setFile] = useState<File | null>(null);

  const updateResult = (test: string, field: keyof LabResult, value: string) => {
    setResults(prev => ({ ...prev, [test]: { ...prev[test], [field]: value } }));
  };

  const submit = () => {
    const formData = new FormData();
    formData.append("results", JSON.stringify(order.tests.map(test => results[test])));
    if (file) formData.append("resultPdf", file);
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Enter Results</h2>
            <p className="mt-1 text-sm text-slate-400">{order.patientId?.name || "Patient"} - {order.tests.join(", ")}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {order.tests.map(test => {
            const result = results[test];
            return (
              <div key={test} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm font-bold text-white">{test}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={result.value || ""} onChange={e => updateResult(test, "value", e.target.value)} placeholder="Value" className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                  <input value={result.unit || ""} onChange={e => updateResult(test, "unit", e.target.value)} placeholder="Unit" className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                  <input value={result.normalRange || ""} onChange={e => updateResult(test, "normalRange", e.target.value)} placeholder="Normal range" className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                  <select value={result.flag || ""} onChange={e => updateResult(test, "flag", e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500">
                    <option value="">No flag</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <textarea value={result.values || ""} onChange={e => updateResult(test, "values", e.target.value)} rows={2} placeholder="Notes / interpretation" className="mt-3 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
            );
          })}

          <label className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Result PDF</span>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-300" />
          </label>

          <button onClick={submit} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">
            <CheckCircle size={15} /> {saving ? "Saving..." : "Save Results"}
          </button>
        </div>
      </div>
    </div>
  );
}
