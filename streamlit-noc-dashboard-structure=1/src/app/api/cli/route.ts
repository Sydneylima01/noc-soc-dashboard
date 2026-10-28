import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runCommand } from "@/lib/cli";
import { writeLog } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user)
    return Response.json(
      { ok: false, lines: [{ text: "não autenticado", tone: "err" }] },
      { status: 401 },
    );

  if (user.role !== "superadmin")
    return Response.json(
      {
        ok: false,
        lines: [
          { text: "acesso negado: a CLI é exclusiva do super administrador", tone: "err" },
        ],
      },
      { status: 403 },
    );

  let command = "";
  try {
    const body = (await req.json()) as { command?: unknown };
    command = typeof body.command === "string" ? body.command.slice(0, 500) : "";
  } catch {
    return Response.json(
      { ok: false, lines: [{ text: "requisição inválida", tone: "err" }] },
      { status: 400 },
    );
  }

  const result = await runCommand(command, user);

  const cmd = command.trim();
  if (cmd && cmd !== "clear") {
    await writeLog(user.id, user.username, "CLI", `$ ${cmd.slice(0, 180)}`);
  }

  return Response.json(result);
}
