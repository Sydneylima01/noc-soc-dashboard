"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { writeLog } from "@/lib/util";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/** Remove um relatório enviado (qualquer usuário autenticado). */
export async function deleteUpload(id: number): Promise<void> {
  const user = await requireUser();

  const rows = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  const u = rows[0];
  if (!u) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, u.storedName));
  } catch {
    /* arquivo já pode não existir */
  }

  await db.delete(uploads).where(eq(uploads.id, id));
  await writeLog(user.id, user.username, "REMOÇÃO", `Relatório "${u.originalName}" removido da base de documentos`);

  revalidatePath("/relatorios");
}
