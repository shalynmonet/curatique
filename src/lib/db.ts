import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

// Tiny JSON-file store. Good enough for a single-instance hackathon deploy; on Render, mount a
// persistent disk at DATA_DIR to survive restarts (see README).
const locks = new Map<string, Promise<unknown>>();

function file(name: string) {
  return path.resolve(process.cwd(), env.dataDir(), `${name}.json`);
}

export async function readJSON<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Serialized read-modify-write per file. */
export async function updateJSON<T>(name: string, fallback: T, fn: (cur: T) => T | Promise<T>): Promise<T> {
  const prev = locks.get(name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const cur = await readJSON(name, fallback);
    const out = await fn(cur);
    await fs.mkdir(path.dirname(file(name)), { recursive: true });
    const tmp = `${file(name)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 2));
    await fs.rename(tmp, file(name));
    return out;
  });
  locks.set(name, next.catch(() => undefined));
  return next;
}
