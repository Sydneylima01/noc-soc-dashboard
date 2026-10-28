"use server";

import { isIP } from "node:net";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, facilities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { normMac, num, s, writeLog, ASSET_KINDS, ASSET_STATUS } from "@/lib/util";
import type { FormState } from "@/components/forms";

function reval() {
  revalidatePath("/ativos");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/suporte");
  revalidatePath("/cli");
}

/** Cria ou atualiza um registro do inventário. */
export async function upsertAsset(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const rawId = s(fd.get("id"));
  const id = num(fd.get("id"));
  if (rawId && (!id || !Number.isInteger(id)))
    return { ok: false, msg: "Registro inválido." };
  const submittedKind = s(fd.get("kind"));
  const existing = id
    ? (await db.select().from(assets).where(eq(assets.id, id)).limit(1))[0]
    : undefined;
  if (id && !existing) return { ok: false, msg: "Registro não encontrado." };

  // A categoria de um registro já existente não pode ser alterada pelo formulário.
  const kind = existing?.kind ?? submittedKind;
  const name = s(fd.get("name"));
  const ip = s(fd.get("ip"));
  const macInput = s(fd.get("mac"));
  const mac = normMac(macInput);
  const status = s(fd.get("status")) || "ativo";
  const facilityId = num(fd.get("facilityId"));
  const provider = kind === "link" ? s(fd.get("provider")) : "";
  const bandwidth = kind === "link" ? s(fd.get("bandwidth")) : "";
  const linkUrl = kind === "link" ? s(fd.get("linkUrl")) : "";

  if (!Object.hasOwn(ASSET_KINDS, kind))
    return { ok: false, msg: "Tipo de registro inválido." };
  if (!name || name.length > 200)
    return { ok: false, msg: "Informe uma identificação de até 200 caracteres." };
  if (kind === "ip" && !ip)
    return { ok: false, msg: "Informe o endereço IP do registro." };
  if (ip && !isIP(ip))
    return { ok: false, msg: "IP inválido. Informe um endereço IPv4 ou IPv6 válido." };
  if (macInput && !/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/.test(mac))
    return { ok: false, msg: "MAC inválido. Use o formato 00:1B:44:12:0B:31." };
  if (!Object.hasOwn(ASSET_STATUS, status))
    return { ok: false, msg: "Status inválido." };
  if (provider.length > 200 || bandwidth.length > 100 || linkUrl.length > 2048)
    return { ok: false, msg: "Os dados do link excedem o tamanho permitido." };
  if (linkUrl) {
    try {
      const parsed = new URL(linkUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return { ok: false, msg: "URL inválida. Use um endereço que comece com http:// ou https://." };
    }
  }
  if (facilityId) {
    if (!Number.isInteger(facilityId))
      return { ok: false, msg: "Unidade inválida." };
    const unit = await db.select({ id: facilities.id }).from(facilities).where(eq(facilities.id, facilityId)).limit(1);
    if (!unit[0]) return { ok: false, msg: "Unidade não encontrada." };
  }

  const values = {
    kind,
    name,
    ip,
    mac,
    provider,
    bandwidth,
    linkUrl,
    facilityId,
    room: s(fd.get("room")).slice(0, 200),
    status,
    notes: s(fd.get("notes")).slice(0, 4000),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(assets).set(values).where(eq(assets.id, existing.id));
    await writeLog(
      user.id,
      user.username,
      "EQUIPAMENTO ALTERADO",
      `${name} atualizado — ${ip || "sem IP"} · ${mac || "sem MAC"} (${ASSET_KINDS[kind].label})`,
    );
    reval();
    return { ok: true, msg: "Registro atualizado com sucesso." };
  }

  await db.insert(assets).values(values);
  await writeLog(
    user.id,
    user.username,
    "EQUIPAMENTO NOVO",
    `${name} cadastrado — ${ip || "sem IP"} · ${mac || "sem MAC"} (${ASSET_KINDS[kind].label})`,
  );
  reval();
  return { ok: true, msg: "Registro cadastrado com sucesso." };
}

/** Remove um registro do inventário (somente super admin). */
export async function deleteAsset(id: number): Promise<void> {
  const user = await requireUser();
  if (user.role !== "superadmin" || !Number.isInteger(id) || id <= 0) return;

  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  const a = rows[0];
  if (!a) return;

  await db.delete(assets).where(eq(assets.id, id));
  await writeLog(
    user.id,
    user.username,
    "EQUIPAMENTO REMOVIDO",
    `${a.name} removido do inventário (${a.ip || "sem IP"})`,
  );
  reval();
}
