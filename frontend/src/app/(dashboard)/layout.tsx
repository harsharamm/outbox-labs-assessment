"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Me } from "@/types";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DashboardContext } from "@/components/dashboard-context";

function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0 });

  useEffect(() => {
    api
      .get<Me>("/api/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slack = params.get("slack");
    if (slack === "connected") toast.push("Slack connected");
    if (slack === "error") toast.push("Slack connection failed", "error");
    if (slack) window.history.replaceState({}, "", window.location.pathname);
  }, [toast]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Loading…</div>;
  }
  if (!me) return null;

  return (
    <DashboardContext.Provider value={{ me, counts, setCounts }}>
      <div className="flex min-h-screen bg-gray-50">
        <Suspense fallback={<aside className="w-60 shrink-0 border-r border-gray-100 bg-white" />}>
          <Sidebar counts={counts} />
        </Suspense>
        <div className="flex flex-1 flex-col">
          <Header me={me} />
          <main className="flex-1 px-8 py-6">{children}</main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DashboardShell>{children}</DashboardShell>
    </ToastProvider>
  );
}
