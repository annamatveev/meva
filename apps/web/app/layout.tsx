import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Context Studio",
  description: "Manage and authorize the context that feeds your AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-black/5 bg-white/70 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
              <a href="/" className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">
                  C
                </div>
                <span className="font-semibold tracking-tight">Context Studio</span>
              </a>
              <nav className="ml-2 flex items-center gap-1 text-sm">
                <a href="/" className="rounded-md px-2.5 py-1 text-muted hover:bg-black/[0.04] hover:text-ink">
                  Change Requests
                </a>
                <a href="/governance" className="rounded-md px-2.5 py-1 text-muted hover:bg-black/[0.04] hover:text-ink">
                  Governance
                </a>
                <a
                  href="/edit/policies/refunds.md"
                  className="rounded-md px-2.5 py-1 text-muted hover:bg-black/[0.04] hover:text-ink"
                >
                  Editor
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
