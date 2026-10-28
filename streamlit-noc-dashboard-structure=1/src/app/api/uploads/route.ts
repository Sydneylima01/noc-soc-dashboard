import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeLog } from "@/lib/util";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB por arquivo

const ALLOWED: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".csv": "text/csv",
};

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
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length)
    return Response.json(
      { ok: false, msg: "Nenhum arquivo recebido." },
      { status: 400 },
    );

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  let saved = 0;
  const rejected: string[] = [];

  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    const mime = ALLOWED[ext];
    if (!mime) {
      rejected.push(`${f.name} (formato não suportado)`);
      continue;
    }
    if (f.size === 0 || f.size > MAX_SIZE) {
      rejected.push(`${f.name} (tamanho inválido)`);
      continue;
    }
    const stored = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, stored), buf);
    await db.insert(uploads).values({
      originalName: f.name.slice(0, 180),
      storedName: stored,
      mime,
      size: f.size,
      uploadedById: user.id,
      uploadedByName: user.name,
    });
    saved++;
  }

  if (saved > 0) {
    await writeLog(
      user.id,
      user.username,
      "UPLOAD",
      `${saved} relatório(s) enviado(s) para a base de documentos`,
    );
  }

  const msg =
    saved > 0
      ? `${saved} arquivo(s) enviado(s) com sucesso.`
      : `Nenhum arquivo aceito. Formatos: PDF, Excel, Word e CSV · máx. 10 MB.${
          rejected.length ? " (" + rejected.join(", ") + ")" : ""
        }`;
  return Response.json({ ok: saved > 0, msg });
}
