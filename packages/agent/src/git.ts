import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// Only branches the loop created may be merged/deleted via the gate.
export const FIX_BRANCH_RE = /^loop\/fix-[a-z0-9-]+$/;

const BIG = 16 * 1024 * 1024;

// execFile (no shell) — args are passed literally, never interpolated.
export function git(args: string[], cwd: string = process.cwd()) {
  return execFileP("git", args, { cwd, maxBuffer: BIG });
}

export function claude(args: string[], cwd: string) {
  return execFileP("claude", args, { cwd, maxBuffer: BIG });
}

export function tscBin(cwd: string) {
  return execFileP("npx", ["tsc", "--noEmit"], { cwd, maxBuffer: BIG });
}
