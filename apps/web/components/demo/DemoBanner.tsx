"use client";

import { useEffect, useState } from "react";
import { getSession, setSession } from "@/lib/auth";
import { demo } from "@/lib/demo";

/**
 * Shown only in demo mode. Explains that data is sample/non-persistent and
 * auto-signs-in a demo Owner so every capability is visible without a login step.
 */
export function DemoBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSession()) setSession(demo.ownerSession);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="border-b border-line bg-accent/15 px-6 py-1.5 text-center text-xs text-ink">
      <span className="font-mono uppercase tracking-wide text-accent">Demo</span>{" "}
      — bravo with sample data, signed in as a demo Owner. Changes aren’t saved; reload to reset.
    </div>
  );
}
