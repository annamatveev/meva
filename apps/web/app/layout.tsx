import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Logo } from "@/components/brand/Logo";

// Bold grotesk display + clean sans body + characterful mono labels — the
// landing page's editorial-technical type pairing.
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { UserMenu } from "@/components/auth/UserMenu";
import { Tooltip } from "@/components/ui/Tooltip";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DEMO } from "@/lib/demo";

export const metadata: Metadata = {
  title: "meva — Context Studio",
  description: "Govern the context that feeds your AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        {/* Apply saved/system theme before paint to avoid a flash. */}
        <script src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/theme-init.js`} />
      </head>
      <body>
        <div className="app-bg min-h-screen">
          {DEMO && <DemoBanner />}
          <header className="sticky top-0 z-30 border-b border-line bg-surface/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
              <Link href="/" className="flex shrink-0 items-center gap-2.5">
                <Logo size={28} />
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-bold uppercase tracking-tight">meva</span>
                  <span className="hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.15em] text-muted sm:inline">
                    · Memory Vault
                  </span>
                </span>
              </Link>
              <nav className="ml-3 flex items-center gap-0.5 text-sm">
                <NavLink href="/" hint="Review and approve proposed changes to your context. The home queue of change requests.">
                  Change Requests
                </NavLink>
                <NavLink href="/governance" hint="Track how fresh each piece of context is. Stale items are auto-flagged for review.">
                  Governance
                </NavLink>
                <NavLink href="/distribution" hint="Publish signed, per-agent context bundles that your agents pull and verify.">
                  Distribution
                </NavLink>
                <NavLink href="/edit/policies/refunds.md" hint="Draft policy changes. Edits autosave privately until you propose them for review.">
                  Editor
                </NavLink>
                <NavLink href="/setup" hint="Connect meva to where your context actually lives (a folder or git repo).">
                  Workspace
                </NavLink>
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({
  href,
  hint,
  children,
}: {
  href: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={hint}>
      <Link
        href={href}
        className="whitespace-nowrap rounded-md px-2.5 py-1 text-muted transition hover:bg-hover hover:text-ink"
      >
        {children}
      </Link>
    </Tooltip>
  );
}
