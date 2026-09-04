"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@/types";
import { api, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ComposeModal } from "@/components/ComposeModal";

export function Header({ me }: { me: Me }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  async function logout() {
    await api.post("/auth/logout");
    router.replace("/login");
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-gray-100 bg-white px-8 py-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search emails…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <Button onClick={() => setComposeOpen(true)}>+ Compose</Button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 hover:bg-gray-50"
          >
            {me.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt={me.name} className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {me.name.charAt(0)}
              </div>
            )}
            <div className="text-left leading-tight">
              <p className="text-xs font-medium text-gray-900">{me.name}</p>
              <p className="text-[11px] text-gray-500">{me.email}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
              <a
                href={`${API_URL}/auth/slack`}
                className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {me.slackConnected ? "Slack connected ✓" : "Connect Slack"}
              </a>
              <button
                onClick={logout}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
