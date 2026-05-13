import type { LabStatus } from "../../services/labService";

const STATUS_STYLES: Record<LabStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  in_progress: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/10 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default function StatusBadge({ status }: { status: LabStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLES[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
