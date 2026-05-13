import { FlaskConical } from "lucide-react";

interface LabTestCardProps {
  name: string;
  selected?: boolean;
  subtitle?: string;
  onClick?: () => void;
}

export default function LabTestCard({ name, selected = false, subtitle, onClick }: LabTestCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[78px] w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-teal-500/40 bg-teal-500/10 text-teal-200"
          : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600"
      }`}
    >
      <span className={`mt-0.5 rounded-lg border p-2 ${selected ? "border-teal-500/30 bg-teal-500/10" : "border-slate-800 bg-slate-900"}`}>
        <FlaskConical size={15} />
      </span>
      <span>
        <span className="block text-sm font-bold">{name}</span>
        {subtitle && <span className="mt-1 block text-xs text-slate-500">{subtitle}</span>}
      </span>
    </button>
  );
}
