import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { fieldReports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { num, s, writeLog } from "@/lib/util";
import { MAX_PHOTO_SIZE, PHOTO_DIR, PHOTO_MIME } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Registra um relatório de campo (foto + texto) do técnico. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user)
    return Response.json({ ok: false, msg: "Não autenticado." }, { status: 401 });

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ ok: false, msg: "Corpo inválido." }, { status: 400 });
  }
  const notes = s(fd.get("notes")).slice(0, 4000);
  const facilityId = num(fd.get("facilityId"));
  const ticketId = num(fd.get("ticketId"));

  const raw = fd.get("photo");
  const file = raw instanceof File && raw.size > 0 ? raw : null;

  if (!notes && !file) {
    return Response.json(
      { ok: false, msg: "Anexe uma foto ou escreva uma observação." },
      { status: 400 },
    );
  }

  let stored = "";
  let mime = "";
  let size = 0;

  if (file) {
    const ext = PHOTO_MIME[file.type];
    if (!ext) {
      return Response.json(
        { ok: false, msg: "Foto inválida. Use JPEG, PNG, WEBP ou GIF." },
        { status: 400 },
      );
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return Response.json(
        { ok: false, msg: "Foto muito grande (máximo 10 MB)." },
        { status: 400 },
      );
    }
    stored = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    await fs.mkdir(PHOTO_DIR, { recursive: true });
    await fs.writeFile(
      path.join(PHOTO_DIR, stored),
      Buffer.from(await file.arrayBuffer()),
    );
    mime = file.type;
    size = file.size;
  }

  await db.insert(fieldReports).values({
    notes,
    photoStored: stored,
    photoMime: mime,
    photoSize: size,
    facilityId,
    ticketId,
    createdById: user.id,
    createdByName: user.name,
  });

  await writeLog(
    user.id,
    user.username,
    "CAMPO",
    `Relatório de campo registrado${file ? " com foto" : " (apenas texto)"}`,
  );

  return Response.json({
    ok: true,
    msg: "Relatório de campo registrado com sucesso.",
  });
}
