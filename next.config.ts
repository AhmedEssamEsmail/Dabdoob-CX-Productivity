import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    /* Every route is session-gated and cannot be instant; dev validates each
       segment and logs a "Dropped segment" error. Opt out of implicit
       validation so only segments exporting `instant` are checked. */
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  // The dev-mode indicator has no counterpart in the legacy GAS app; hide it so
  // dev and shot captures match production output.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
