import { defineConfig } from "tsup";

const external = ["react", "react-dom", "next", "next/server", "@loopix/core"];

// Two builds: the client entry needs a "use client" banner (esbuild strips
// directives); the server entry must NOT have it.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2022",
    external,
    banner: { js: '"use client";' },
  },
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    target: "es2022",
    external,
  },
]);
