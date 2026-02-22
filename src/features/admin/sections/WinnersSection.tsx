import type { ReactNode } from "react";

export function WinnersSection({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      {children}
    </section>
  );
}
