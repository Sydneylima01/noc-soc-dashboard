"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { fieldReports } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { writeLog } from "@/lib/util";
import { PHOTO_DIR } from "@/lib/photos";

/** Remove um relatório de campo (criador ou super admin). */
export async function deleteFieldReport(id: number): Promise<void> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(fieldReports)
    .where(eq(fieldReports.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return;
  if (r.createdById !== user.id && user.role !== "superadmin") return;

  if (r.photoStored) {
    try {
      await fs.unlink(path.join(PHOTO_DIR, r.photoStored));
    } catch {
      /* arquivo já pode não existir */
    }
  }

  await db.delete(fieldReports).where(eq(fieldReports.id, id));
  await writeLog(
    user.id,
    user.username,
    "CAMPO",
    "Relatório de campo removido da base",
  );
  revalidatePath("/campo");
}
