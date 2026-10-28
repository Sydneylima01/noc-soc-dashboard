"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { s, writeLog } from "@/lib/util";
import type { FormState } from "@/components/forms";

/** Salva os parâmetros gerais do NOC (somente super admin). */
export async function saveSettings(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "superadmin")
    return { ok: false, msg: "Apenas o super admin altera parâmetros." };

  const values = {
    orgName: s(fd.get("orgName")) || "DTIC",
    supportEmail: s(fd.get("supportEmail")),
    supportPhone: s(fd.get("supportPhone")),
    workHours: s(fd.get("workHours")),
    codePrefix: s(fd.get("codePrefix")).toUpperCase() || "DTIC",
    networkUptime: s(fd.get("networkUptime")) || "99,74",
  };

  const rows = await db.select().from(settingsTable).limit(1);
  if (rows[0]) {
    await db
      .update(settingsTable)
      .set(values)
      .where(eq(settingsTable.id, rows[0].id));
  } else {
    await db.insert(settingsTable).values(values);
  }

  await writeLog(user.id, user.username, "CONFIG", "Parâmetros do NOC atualizados");

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  revalidatePath("/relatorios");
  revalidatePath("/configuracoes");
  return { ok: true, msg: "Parâmetros salvos com sucesso." };
}
