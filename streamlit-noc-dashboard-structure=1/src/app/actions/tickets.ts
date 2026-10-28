"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings, num, s, writeLog, TICKET_STATUS } from "@/lib/util";
import type { FormState } from "@/components/forms";

function reval() {
  revalidatePath("/");
  revalidatePath("/suporte");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

/** Abre um novo chamado de suporte. */
export async function createTicket(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const title = s(fd.get("title"));
  const requester = s(fd.get("requester"));
  if (!title || !requester)
    return { ok: false, msg: "Informe ao menos o título e o solicitante." };

  const st = await getSettings();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(tickets);
  const code = `${st.codePrefix}-${new Date().getFullYear()}-${String(
    Number(n) + 1,
  ).padStart(4, "0")}`;

  await db.insert(tickets).values({
    code,
    title,
    requester,
    contact: s(fd.get("contact")),
    facilityId: num(fd.get("facilityId")),
    assetId: num(fd.get("assetId")),
    category: s(fd.get("category")) || "Outros",
    priority: s(fd.get("priority")) || "media",
    status: "aberto",
    description: s(fd.get("description")),
    assignedTo: "",
    createdById: user.id,
  });

  await writeLog(user.id, user.username, "CHAMADO NOVO", `Chamado ${code} criado — ${title}`);
  reval();
  return { ok: true, msg: `Chamado ${code} aberto com sucesso.` };
}

/** Atualiza o status do chamado (formulário clássico). */
export async function updateTicketStatus(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = num(fd.get("id"));
  const status = s(fd.get("status"));
  if (!id || !(status in TICKET_STATUS)) return;

  const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  const t = rows[0];
  if (!t) return;

  const now = new Date();
  await db
    .update(tickets)
    .set({
      status,
      updatedAt: now,
      resolvedAt:
        status === "resolvido" || status === "fechado"
          ? (t.resolvedAt ?? now)
          : null,
    })
    .where(eq(tickets.id, id));

  await writeLog(
    user.id,
    user.username,
    "CHAMADO STATUS",
    `Chamado ${t.code} → ${TICKET_STATUS[status].label}`,
  );
  reval();
}

/** Exclui um chamado (somente super admin). */
export async function deleteTicket(id: number): Promise<void> {
  const user = await requireUser();
  if (user.role !== "superadmin") return;

  const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  const t = rows[0];
  if (!t) return;

  await db.delete(tickets).where(eq(tickets.id, id));
  await writeLog(
    user.id,
    user.username,
    "CHAMADO EXCLUIDO",
    `Chamado ${t.code} excluído — ${t.title}`,
  );
  reval();
}
