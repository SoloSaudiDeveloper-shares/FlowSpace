import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a portable .next/standalone/ folder on `next build`.
  output: "standalone",

  // Native + dynamic-loading modules must stay external so the runtime can
  // resolve their .node bindings / ONNX assets from node_modules.
  serverExternalPackages: ["@axols/webai-js", "better-sqlite3"],

  // nft sometimes misses better-sqlite3's prebuilt .node binary because it's
  // loaded via dynamic require. Force-include it in the trace.
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/better-sqlite3/build/Release/*.node",
      "node_modules/bindings/**/*",
      "node_modules/file-uri-to-path/**/*",
    ],
  },

  // Empty turbopack config to silence the webpack/turbopack warning
  turbopack: {},
};

export default nextConfig;
