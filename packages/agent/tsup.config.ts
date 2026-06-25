import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: "src/index.ts" },
  clean: true,
  target: "es2022",
  noExternal: ["@loopix/core"], // bundle core in → self-contained CLI
});
