import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { fieldReports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PHOTO_DIR } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Exibe a foto do relatório de campo (inline, para <img>). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(fieldReports)
    .where(eq(fieldReports.id, Number(id)))
    .limit(1);
  const r = rows[0];
  if (!r || !r.photoStored)
    return new Response("Foto não encontrada", { status: 404 });

  try {
    const data = await fs.readFile(path.join(PHOTO_DIR, r.photoStored));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": r.photoMime || "image/jpeg",
        "Content-Disposition": "inline",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Foto indisponível no servidor", { status: 410 });
  }
}
