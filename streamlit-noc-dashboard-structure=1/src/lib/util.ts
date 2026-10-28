import { db } from "@/db";
import { logs as logsTable, settings as settingsTable } from "@/db/schema";
import { DEFAULT_SETTINGS } from "./meta";

export * from "./meta";

/* --------------------------- parâmetros NOC (server) --------------------------- */
export async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? DEFAULT_SETTINGS;
}

/* ------------------------------ auditoria (server) ------------------------------ */
export async function writeLog(
  userId: number | null,
  username: string,
  action: string,
  details: string,
): Promise<void> {
  try {
    await db.insert(logsTable).values({
      userId,
      username,
      action,
      details,
      createdAt: new Date(),
    });
  } catch {
    /* o log nunca deve derrubar a operação */
  }
}

/* ------------------------------- helpers form ------------------------------- */
export const s = (v: FormDataEntryValue | null): string => String(v ?? "").trim();

export const num = (v: FormDataEntryValue | null): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
