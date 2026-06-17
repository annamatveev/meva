/** @type {import('next').NextConfig} */

// For the GitHub Pages demo we produce a fully static export. A project repo is
// served from a subpath (e.g. /bravo), so basePath must be set. Gated behind
// STATIC_EXPORT so the normal SSR app is unaffected.
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@context-studio/types"],
  // Opt-in alternate build dir so `next build` can run while `next dev` holds
  // the default `.next` (avoids the cache collision). Inert unless set.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(isExport
    ? {
        output: "export",
        trailingSlash: true,
        basePath: basePath || undefined,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
