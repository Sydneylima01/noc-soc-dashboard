"use server";

import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  getSessionUser,
  verifyPassword,
} from "@/lib/auth";
import { writeLog } from "@/lib/util";

export async function loginAction(formData: FormData): Promise<void> {
  /** aceita o usuário OU o e-mail cadastrado pelo administrador */
  const identity = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!identity || !password) redirect("/login?erro=1");

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, identity), eq(users.email, identity)))
    .limit(1);
  const user = rows[0];

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await writeLog(
      null,
      identity || "desconhecido",
      "LOGIN FALHOU",
      `Tentativa de acesso negada para "${identity}"`,
    );
    redirect("/login?erro=1");
  }

  await createSession(user.id);
  await writeLog(
    user.id,
    user.username,
    "LOGIN",
    `Sessão iniciada para ${user.name} (${user.role === "superadmin" ? "super admin" : "técnico"})`,
  );
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const u = await getSessionUser();
  if (u) {
    await writeLog(u.id, u.username, "LOGOUT", "Sessão encerrada pelo usuário");
  }
  await destroySession();
  redirect("/login");
}
