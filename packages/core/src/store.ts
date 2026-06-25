import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoopReport } from "./types";

// The storage contract. loopix owns only the intake queue; swap this adapter
// (file for dev, Postgres for prod) without touching the rest of the loop.
export interface ReportStore {
  append(record: LoopReport): Promise<void>;
  list(): Promise<LoopReport[]>;
  get(id: string): Promise<LoopReport | null>;
  patch(id: string, fields: Record<string, unknown>): Promise<LoopReport | null>;
}

// Default dev adapter: one JSON object per line. Single-writer; the full
// rewrite on patch is fine at dev volume (a DB adapter replaces it in prod).
export class FileReportStore implements ReportStore {
  constructor(private readonly file: string) {}

  private async readAll(): Promise<LoopReport[]> {
    try {
      const txt = await fs.readFile(this.file, "utf8");
      return txt
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as LoopReport);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  private async writeAll(records: LoopReport[]): Promise<void> {
    const tmp = `${this.file}.tmp`;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(tmp, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
    await fs.rename(tmp, this.file); // atomic swap
  }

  async append(record: LoopReport): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, JSON.stringify(record) + "\n", "utf8");
  }

  async list(): Promise<LoopReport[]> {
    return this.readAll();
  }

  async get(id: string): Promise<LoopReport | null> {
    return (await this.readAll()).find((r) => r.id === id) ?? null;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<LoopReport | null> {
    const recs = await this.readAll();
    const r = recs.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, fields);
    await this.writeAll(recs);
    return r;
  }
}
