"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, requireUser } from "@/lib/auth";
import { s, writeLog } from "@/lib/util";
import type { FormState } from "@/components/forms";

function reval() {
  revalidatePath("/configuracoes");
  revalidatePath("/dashboard");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cria um novo acesso (somente super admin). */
export async function createUser(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "superadmin")
    return { ok: false, msg: "Apenas o super admin cria acessos." };

  const name = s(fd.get("name"));
  const username = s(fd.get("username")).toLowerCase();
  const email = s(fd.get("email")).toLowerCase();
  const password = s(fd.get("password"));
  const role = s(fd.get("role")) === "superadmin" ? "superadmin" : "tecnico";

  if (!name || !username)
    return { ok: false, msg: "Informe nome e usuário." };
  if (!EMAIL_RE.test(email))
    return { ok: false, msg: "Informe um e-mail corporativo válido (usado na redefinição de senha)." };
  if (password.length < 6)
    return { ok: false, msg: "A senha inicial deve ter ao menos 6 caracteres." };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing[0])
    return { ok: false, msg: `O usuário "${username}" já existe.` };

  const existingMail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingMail[0])
    return { ok: false, msg: `O e-mail ${email} já está cadastrado.` };

  await db.insert(users).values({
    name,
    username,
    email,
    role,
    passwordHash: hashPassword(password),
    active: true,
  });
  await writeLog(
    user.id,
    user.username,
    "USUÁRIO NOVO",
    `Acesso criado para ${name} (${username} · ${email}) — perfil ${role}`,
  );
  reval();
  return { ok: true, msg: `Acesso "${username}" criado com sucesso.` };
}

/** Atualiza o e-mail cadastrado de um usuário (somente super admin). */
export async function updateUserEmail(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "superadmin")
    return { ok: false, msg: "Apenas o super admin altera e-mails." };

  const id = Number(fd.get("id"));
  const email = s(fd.get("email")).toLowerCase();
  if (!id) return { ok: false, msg: "Usuário inválido." };
  if (!EMAIL_RE.test(email))
    return { ok: false, msg: "E-mail inválido." };

  const clash = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (clash[0] && clash[0].id !== id)
    return { ok: false, msg: `O e-mail ${email} já está em uso por outro usuário.` };

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { ok: false, msg: "Usuário não encontrado." };

  await db.update(users).set({ email }).where(eq(users.id, id));
  await writeLog(
    user.id,
    user.username,
    "E-MAIL ALTERADO",
    `E-mail de ${target.username} atualizado para ${email}`,
  );
  reval();
  return { ok: true, msg: `E-mail de ${target.username} atualizado.` };
}

/** Redefine a senha de um usuário (somente super admin). */
export async function resetPassword(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "superadmin")
    return { ok: false, msg: "Apenas o super admin redefine senhas." };

  const id = Number(fd.get("id"));
  const password = s(fd.get("password"));
  if (!id || password.length < 6)
    return { ok: false, msg: "Informe uma nova senha (mín. 6 caracteres)." };

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { ok: false, msg: "Usuário não encontrado." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.id, id));
  await writeLog(
    user.id,
    user.username,
    "USUÁRIO SENHA",
    `Senha redefinida para ${target.username}`,
  );
  reval();
  return { ok: true, msg: `Senha de ${target.username} redefinida.` };
}

/** Ativa / desativa um usuário (somente super admin). */
export async function toggleUserActive(id: number): Promise<void> {
  const user = await requireUser();
  if (user.role !== "superadmin" || id === user.id) return;

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return;

  await db
    .update(users)
    .set({ active: !target.active })
    .where(eq(users.id, id));
  await writeLog(
    user.id,
    user.username,
    "USUÁRIO STATUS",
    `Acesso de ${target.username} ${target.active ? "desativado" : "reativado"}`,
  );
  reval();
}
