"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "crypto";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { s, writeLog } from "@/lib/util";

export type PwState = {
  ok: boolean | null;
  msg: string;
  email?: string;
  demoCode?: string;
};

const revalPerfil = () => {
  revalidatePath("/perfil");
  revalidatePath("/configuracoes");
};

/* ----------------------- mudança de senha no próprio perfil ----------------------- */
export async function changeMyPassword(
  _prev: PwState,
  fd: FormData,
): Promise<PwState> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const me = rows[0];
  if (!me) return { ok: false, msg: "Usuário não encontrado." };

  const current = String(fd.get("current") ?? "");
  const next = s(fd.get("next"));
  const confirm = s(fd.get("confirm"));

  if (!verifyPassword(current, me.passwordHash))
    return { ok: false, msg: "A senha atual está incorreta." };
  if (next.length < 6)
    return { ok: false, msg: "A nova senha deve ter ao menos 6 caracteres." };
  if (next !== confirm)
    return { ok: false, msg: "A confirmação não confere com a nova senha." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(next) })
    .where(eq(users.id, user.id));
  await writeLog(user.id, user.username, "SENHA ALTERADA", "Usuário alterou a própria senha no perfil");
  revalPerfil();
  return { ok: true, msg: "Senha alterada com sucesso." };
}

/* ----------------- redefinição de senha via e-mail cadastrado ----------------- */
/** Etapa 1: gera um código de 6 dígitos para o e-mail informado. */
export async function requestReset(
  _prev: PwState,
  fd: FormData,
): Promise<PwState> {
  const email = s(fd.get("email")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, msg: "Informe um e-mail válido." };

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.active, true)))
    .limit(1);
  const user = rows[0];

  // resposta genérica para não revelar se o e-mail existe
  if (!user) {
    return {
      ok: true,
      msg: "Se o e-mail estiver cadastrado e o acesso ativo, um código foi gerado.",
      email,
    };
  }

  const code = String(randomInt(100000, 1000000));
  // invalida pendências anteriores
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(eq(passwordResets.email, email), sql`${passwordResets.usedAt} is null`),
    );
  await db.insert(passwordResets).values({
    email,
    code,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  await writeLog(user.id, user.username, "SENHA SOLICITADA", `Código de redefinição gerado para ${email}`);

  return {
    ok: true,
    msg: "Código gerado com sucesso (válido por 15 minutos).",
    email,
    demoCode: code,
  };
}

/** Etapa 2: valida o código e aplica a nova senha. */
export async function doReset(_prev: PwState, fd: FormData): Promise<PwState> {
  const email = s(fd.get("email")).toLowerCase();
  const code = s(fd.get("code"));
  const next = s(fd.get("password"));
  const confirm = s(fd.get("confirm"));

  if (!code) return { ok: false, msg: "Informe o código recebido." };
  if (next.length < 6)
    return { ok: false, msg: "A nova senha deve ter ao menos 6 caracteres." };
  if (next !== confirm)
    return { ok: false, msg: "A confirmação não confere com a nova senha." };

  const pendings = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.email, email),
        eq(passwordResets.code, code),
        sql`${passwordResets.usedAt} is null`,
      ),
    )
    .orderBy(desc(passwordResets.createdAt))
    .limit(1);
  const r = pendings[0];
  if (!r) return { ok: false, msg: "Código inválido. Verifique e tente novamente." };
  if (r.expiresAt < new Date())
    return { ok: false, msg: "Código expirado. Solicite um novo." };

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = userRows[0];
  if (!user) return { ok: false, msg: "E-mail não encontrado." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(next) })
    .where(eq(users.id, user.id));
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, r.id));
  await writeLog(user.id, user.username, "SENHA REDEFINIDA", `Senha redefinida via e-mail ${email}`);
  revalPerfil();
  return { ok: true, msg: "Senha redefinida! Faça login com a nova senha." };
}
