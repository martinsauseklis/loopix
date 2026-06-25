#!/usr/bin/env node
import path from "node:path";
import { FileReportStore } from "@loopix/core";
import { triageNext } from "./triage";
import { fixNext } from "./fix";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const has = (flag: string) => process.argv.includes(flag);

async function main() {
  const cmd = process.argv[2];
  const repo = path.resolve(arg("--repo", process.cwd())!);
  const reportsPath = path.resolve(arg("--reports", path.join(repo, ".loop", "reports.jsonl"))!);
  const model = arg("--model");
  const store = new FileReportStore(reportsPath);

  if (cmd === "triage") {
    if (has("--once")) {
      const did = await triageNext(store, { repo, model });
      if (!did) console.log("[loop] no reports with status:new");
      return;
    }
    for (;;) {
      const did = await triageNext(store, { repo, model });
      if (!did) await new Promise((r) => setTimeout(r, 4000));
    }
  } else if (cmd === "fix") {
    await fixNext(store, { repo, model, id: arg("--id") });
  } else {
    console.log(
      `loopix — feedback-loop agent

Usage:
  loopix triage [--once] [--repo <dir>] [--reports <path>] [--model <m>]
  loopix fix    [--id <id>] [--repo <dir>] [--reports <path>] [--model <m>]
`,
    );
    process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => {
  console.error("[loopix] fatal", e);
  process.exit(1);
});
