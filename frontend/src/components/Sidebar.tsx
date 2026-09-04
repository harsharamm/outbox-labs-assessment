"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Counts } from "@/components/dashboard-context";

export function Sidebar({ counts }: { counts: Counts }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "scheduled";

  const items = [
    { key: "scheduled", label: "Scheduled", count: counts.scheduled, icon: ClockIcon },
    { key: "sent", label: "Sent", count: counts.sent, icon: SendIcon },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          RI
        </div>
        <span className="text-sm font-semibold text-gray-900">ReachInbox</span>
      </div>

      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Core</p>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = tab === item.key;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/?tab=${item.key}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {item.count}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
