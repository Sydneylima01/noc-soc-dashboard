import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, Number(id)))
    .limit(1);
  const u = rows[0];
  if (!u) return new Response("Arquivo não encontrado", { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, u.storedName));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": u.mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(u.originalName)}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Arquivo indisponível no servidor", { status: 410 });
  }
}
