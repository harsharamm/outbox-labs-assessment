"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { EmailRow } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDashboard } from "@/components/dashboard-context";
import { EMAILS_SCHEDULED_EVENT } from "@/components/ComposeModal";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailTable({ rows, mode }: { rows: EmailRow[]; mode: "scheduled" | "sent" }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={mode === "scheduled" ? "No scheduled emails" : "No sent emails yet"}
        description={
          mode === "scheduled"
            ? "Compose a new email to schedule your first send."
            : "Emails will show up here once they've gone out."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{mode === "scheduled" ? "Scheduled time" : "Sent time"}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{row.email}</td>
              <td className="px-4 py-3 text-gray-600">{row.subject}</td>
              <td className="px-4 py-3 text-gray-500">
                {formatDate(mode === "scheduled" ? row.scheduledAt : row.sentAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as "scheduled" | "sent") ?? "scheduled";
  const { setCounts } = useDashboard();
  const [rows, setRows] = useState<EmailRow[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const [scheduled, sent] = await Promise.all([
      api.get<EmailRow[]>("/api/emails?status=scheduled"),
      api.get<EmailRow[]>("/api/emails?status=sent"),
    ]);
    setCounts({ scheduled: scheduled.length, sent: sent.length });
    setRows(tab === "scheduled" ? scheduled : sent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener(EMAILS_SCHEDULED_EVENT, load);
    return () => window.removeEventListener(EMAILS_SCHEDULED_EVENT, load);
  }, [load]);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">
        {tab === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
      </h1>
      {rows === null ? <TableSkeleton /> : <EmailTable rows={rows} mode={tab} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
