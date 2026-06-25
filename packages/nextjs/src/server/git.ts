import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// Only branches the loop created may be merged/deleted via the gate.
export const FIX_BRANCH_RE = /^loop\/fix-[a-z0-9-]+$/;

// execFile (no shell) — args are passed literally, never interpolated.
export function git(args: string[], cwd: string = process.cwd()) {
  return execFileP("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
}
