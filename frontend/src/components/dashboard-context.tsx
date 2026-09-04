"use client";

import { createContext, useContext, Dispatch, SetStateAction } from "react";
import type { Me } from "@/types";

export interface Counts {
  scheduled: number;
  sent: number;
}

interface DashboardContextValue {
  me: Me;
  counts: Counts;
  setCounts: Dispatch<SetStateAction<Counts>>;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardLayout");
  return ctx;
}
