import type { EmailStatus } from "@/types";

const styles: Record<EmailStatus, string> = {
  SCHEDULED: "bg-amber-50 text-amber-700 border border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border border-blue-200",
  SENT: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border border-red-200",
};

const labels: Record<EmailStatus, string> = {
  SCHEDULED: "Scheduled",
  PROCESSING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
