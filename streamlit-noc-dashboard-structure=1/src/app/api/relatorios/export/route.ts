import { NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  tickets as ticketsTable,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  ASSET_KINDS,
  ASSET_STATUS,
  EQUIPMENT_KINDS,
  fmtD,
  fmtDT,
  getSettings,
  PRIORITIES,
  TICKET_STATUS,
} from "@/lib/util";

export const dynamic = "force-dynamic";

const PERIODS = [7, 15, 30, 90];

type TicketRow = {
  t: {
    id: number;
    code: string;
    title: string;
    requester: string;
    contact: string;
    category: string;
    priority: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  };
  facilityName: string | null;
  facilityKind: string | null;
};

type AssetRow = {
  a: {
    id: number;
    kind: string;
    name: string;
    ip: string;
    mac: string;
    room: string;
    status: string;
    notes: string;
  };
  facilityName: string | null;
  facilityKind: string | null;
};

async function gatherData(periodo: number) {
  const cutoff = new Date(Date.now() - periodo * 864e5);
  const [tk, assets, facilities, settings] = await Promise.all([
    db
      .select({
        t: ticketsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
      })
      .from(ticketsTable)
      .leftJoin(facilitiesTable, eq(ticketsTable.facilityId, facilitiesTable.id))
      .orderBy(desc(ticketsTable.createdAt)),
    db
      .select({
        a: assetsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
      })
      .from(assetsTable)
      .leftJoin(facilitiesTable, eq(assetsTable.facilityId, facilitiesTable.id))
      .orderBy(asc(assetsTable.name)),
    db.select().from(facilitiesTable).orderBy(facilitiesTable.name),
    getSettings(),
  ]);

  const tickets = tk.filter(({ t }) => t.createdAt >= cutoff);
  const resolved = tickets.filter(({ t }) => t.resolvedAt);
  const avgResH =
    resolved.length > 0
      ? Math.round(
          resolved.reduce(
            (acc, { t }) =>
              acc + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
            0,
          ) /
            resolved.length /
            36e5,
        )
      : 0;

  const count = (f: (r: TicketRow) => boolean) => tickets.filter(f).length;

  return {
    periodo,
    cutoff,
    tickets,
    assets,
    facilities,
    settings,
    summary: {
      total: tickets.length,
      abertos: count((r) => r.t.status === "aberto"),
      andamento: count((r) => r.t.status === "andamento"),
      resolvidos: count((r) => r.t.status === "resolvido"),
      fechados: count((r) => r.t.status === "fechado"),
      avgResH,
      escolas: facilities.filter((f) => f.kind === "ESCOLA").length,
      cmeis: facilities.filter((f) => f.kind === "CMEI").length,
    },
  };
}

type Data = Awaited<ReturnType<typeof gatherData>>;

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const unit = (facilityName: string | null, facilityKind: string | null) =>
  facilityName ? `${facilityKind} · ${facilityName}` : "—";

/* ----------------------------------- PDF ----------------------------------- */
function buildPdf(data: Data, userName: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 44 });
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (b: Buffer) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => done(Buffer.concat(chunks)));
    doc.on("error", () => done(Buffer.from("%PDF-1.4")));

    const M = 44;
    const W = doc.page.width - M * 2;
    let y = M;

    const ensure = (h: number) => {
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = M;
      }
    };
    const rule = (color = "#cbd5e1", lw = 0.7) => {
      ensure(12);
      y += 3;
      doc.moveTo(M, y).lineTo(M + W, y).strokeColor(color).lineWidth(lw).stroke();
      y += 7;
    };
    const cellText = (
      s: string,
      x: number,
      w: number,
      size = 8.5,
      bold = false,
      color = "#334155",
    ) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
      doc.text(s, x, y, { width: Math.max(10, w) });
      return doc.y;
    };
    const table = (headers: string[], rows: string[][], widths: number[]) => {
      ensure(24);
      let x = M;
      let mx = y;
      headers.forEach((h, i) => {
        mx = Math.max(mx, cellText(h, x, widths[i], 8, true, "#0f172a"));
        x += widths[i];
      });
      y = mx + 1;
      doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1.1).strokeColor("#0e7490").stroke();
      y += 6;
      rows.forEach((row) => {
        ensure(26);
        x = M;
        let mxx = y;
        row.forEach((c, i) => {
          mxx = Math.max(mxx, cellText(c, x, widths[i] - 5));
          x += widths[i];
        });
        y = mxx + 3;
        doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.3).strokeColor("#e2e8f0").stroke();
        y += 2;
      });
    };
    const sectionTitle = (s: string) => {
      ensure(30);
      y += 4;
      doc.font("Helvetica-Bold").fontSize(11.5).fillColor("#0e7490").text(s, M, y);
      y = doc.y + 4;
    };

    // cabeçalho
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("DTIC/SUPORTE — Relatório Operacional", M, y);
    y = doc.y + 3;
    doc.font("Helvetica").fontSize(9.5).fillColor("#475569");
    doc.text(data.settings.orgName, M, y, { width: W });
    y = doc.y + 2;
    doc.text(
      `Período: últimos ${data.periodo} dias (${fmtD(data.cutoff)} a ${fmtD(new Date())})  ·  Gerado em ${fmtDT(new Date())} por ${userName}`,
      M,
      y,
      { width: W },
    );
    y = doc.y + 4;
    rule("#0e7490", 1.4);

    // resumo
    sectionTitle("1. Resumo do período");
    const sum: [string, string][] = [
      ["Chamados no período", String(data.summary.total)],
      ["Abertos / Em andamento", `${data.summary.abertos} / ${data.summary.andamento}`],
      ["Resolvidos / Fechados", `${data.summary.resolvidos} / ${data.summary.fechados}`],
      ["Tempo médio de resolução", data.summary.avgResH > 0 ? `${data.summary.avgResH} h` : "—"],
      ["Equipamentos no inventário", String(data.assets.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind)).length)],
      ["Notebooks", String(data.assets.filter(({ a }) => a.kind === "notebook").length)],
      ["IPs informados / links", `${data.assets.filter(({ a }) => a.ip).length} / ${data.assets.filter(({ a }) => a.kind === "link").length}`],
      ["Unidades monitoradas", `${data.summary.escolas} escolas + ${data.summary.cmeis} CMEIs`],
    ];
    sum.forEach(([k, v]) => {
      ensure(18);
      const ky = y;
      doc.font("Helvetica").fontSize(9.5).fillColor("#475569").text(k, M, ky, { width: W * 0.58 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text(v, M + W * 0.58, ky, { width: W * 0.42 });
      y = Math.max(doc.y, ky + 15);
    });
    y += 6;
    rule();

    // chamados
    sectionTitle(`2. Chamados — ${data.tickets.length} registro(s)`);
    table(
      ["Código", "Título", "Unidade", "Categoria", "Prioridade", "Status", "Aberto em"],
      data.tickets.map(({ t, facilityName, facilityKind }) => [
        t.code,
        trunc(t.title, 34),
        trunc(unit(facilityName, facilityKind), 28),
        t.category,
        PRIORITIES[t.priority]?.label ?? t.priority,
        TICKET_STATUS[t.status]?.label ?? t.status,
        fmtDT(t.createdAt),
      ]),
      [64, 148, 102, 52, 44, 63, 34],
    );
    y += 6;
    rule();

    // Inventário completo, incluindo notebooks, IPs e links.
    sectionTitle(`3. Inventário — ${data.assets.length} registro(s)`);
    table(
      ["Tipo", "Identificação", "IP", "MAC", "Unidade", "Sala", "Status"],
      data.assets.map(({ a, facilityName, facilityKind }) => [
        ASSET_KINDS[a.kind]?.label ?? a.kind,
        a.name,
        a.ip || "—",
        a.mac || "—",
        trunc(unit(facilityName, facilityKind), 26),
        trunc(a.room, 16),
        ASSET_STATUS[a.status]?.label ?? a.status,
      ]),
      [62, 88, 60, 84, 108, 62, 43],
    );

    const links = data.assets.filter(({ a }) => a.kind === "link");
    if (links.length) {
      y += 6;
      rule();
      sectionTitle(`4. Detalhes dos links — ${links.length} registro(s)`);
      table(
        ["Identificação", "Provedor", "Velocidade", "URL de acesso", "Unidade"],
        links.map(({ a, facilityName, facilityKind }) => [
          trunc(a.name, 24),
          trunc(a.provider || "—", 24),
          trunc(a.bandwidth || "—", 16),
          trunc(a.linkUrl || "—", 75),
          trunc(unit(facilityName, facilityKind), 26),
        ]),
        [82, 80, 65, 175, 105],
      );
    }

    doc.end();
  });
}

/* ---------------------------------- EXCEL ---------------------------------- */
function buildXlsx(data: Data, userName: string): Buffer {
  const wb = XLSX.utils.book_new();

  const resumo = XLSX.utils.aoa_to_sheet([
    ["DTIC/SUPORTE — Relatório Operacional"],
    [data.settings.orgName],
    ["Período", `Últimos ${data.periodo} dias (${fmtD(data.cutoff)} a ${fmtD(new Date())})`],
    ["Gerado em", fmtDT(new Date())],
    ["Gerado por", userName],
    [],
    ["Métrica", "Valor"],
    ["Chamados no período", data.summary.total],
    ["Abertos", data.summary.abertos],
    ["Em andamento", data.summary.andamento],
    ["Resolvidos", data.summary.resolvidos],
    ["Fechados", data.summary.fechados],
    ["Tempo médio de resolução (h)", data.summary.avgResH],
    ["Equipamentos no inventário", data.assets.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind)).length],
    ["Notebooks", data.assets.filter(({ a }) => a.kind === "notebook").length],
    ["IPs informados", data.assets.filter(({ a }) => a.ip).length],
    ["Links", data.assets.filter(({ a }) => a.kind === "link").length],
    ["Unidades monitoradas", data.facilities.length],
  ]);
  resumo["!cols"] = [{ wch: 30 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, resumo, "Resumo");

  const chamados = XLSX.utils.aoa_to_sheet([
    ["Código", "Título", "Solicitante", "Contato", "Unidade", "Tipo unidade", "Categoria", "Prioridade", "Status", "Aberto em", "Resolvido em"],
    ...data.tickets.map(({ t, facilityName, facilityKind }) => [
      t.code,
      t.title,
      t.requester,
      t.contact,
      facilityName ?? "—",
      facilityKind ?? "—",
      t.category,
      PRIORITIES[t.priority]?.label ?? t.priority,
      TICKET_STATUS[t.status]?.label ?? t.status,
      fmtDT(t.createdAt),
      t.resolvedAt ? fmtDT(t.resolvedAt) : "—",
    ]),
  ]);
  chamados["!cols"] = [
    { wch: 16 }, { wch: 44 }, { wch: 22 }, { wch: 20 }, { wch: 28 },
    { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 13 }, { wch: 16 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, chamados, "Chamados");

  const equip = XLSX.utils.aoa_to_sheet([
    ["Tipo", "Identificação", "IP", "MAC", "Unidade", "Tipo unidade", "Sala", "Status", "Provedor", "Velocidade", "URL", "Observações"],
    ...data.assets.map(({ a, facilityName, facilityKind }) => [
      ASSET_KINDS[a.kind]?.label ?? a.kind,
      a.name,
      a.ip,
      a.mac,
      facilityName ?? "—",
      facilityKind ?? "—",
      a.room,
      ASSET_STATUS[a.status]?.label ?? a.status,
      a.provider,
      a.bandwidth,
      a.linkUrl,
      a.notes,
    ]),
  ]);
  equip["!cols"] = [
    { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 28 },
    { wch: 13 }, { wch: 18 }, { wch: 13 }, { wch: 22 }, { wch: 16 }, { wch: 38 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, equip, "Equipamentos");

  const unidades = XLSX.utils.aoa_to_sheet([
    ["Tipo da unidade", "Unidade", "Impressoras", "Mesinhas", "Computadores", "Notebooks", "IPs informados", "Links", "Equipamentos", "Equipamentos ativos"],
    ...data.facilities.map((facility) => {
      const of = data.assets.filter(({ a }) => a.facilityId === facility.id);
      const equipment = of.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind));
      return [
        facility.kind, facility.name,
        of.filter(({ a }) => a.kind === "impressora").length,
        of.filter(({ a }) => a.kind === "mesinha").length,
        of.filter(({ a }) => a.kind === "computador").length,
        of.filter(({ a }) => a.kind === "notebook").length,
        of.filter(({ a }) => a.ip).length,
        of.filter(({ a }) => a.kind === "link").length,
        equipment.length,
        equipment.filter(({ a }) => a.status === "ativo").length,
      ];
    }),
  ]);
  unidades["!cols"] = [{ wch: 18 }, { wch: 32 }, ...Array.from({ length: 8 }, () => ({ wch: 19 }))];
  XLSX.utils.book_append_sheet(wb, unidades, "Unidades");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

/* ---------------------------------- WORD ---------------------------------- */
function buildDoc(data: Data, userName: string): Buffer {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const chamadosRows = data.tickets
    .map(
      ({ t, facilityName, facilityKind }) =>
        `<tr><td>${t.code}</td><td>${esc(t.title)}</td><td>${esc(unit(facilityName, facilityKind))}</td><td>${esc(t.category)}</td><td>${PRIORITIES[t.priority]?.label ?? t.priority}</td><td>${TICKET_STATUS[t.status]?.label ?? t.status}</td><td>${fmtDT(t.createdAt)}</td></tr>`,
    )
    .join("");

  const equipRows = data.assets
    .map(
      ({ a, facilityName, facilityKind }) =>
        `<tr><td>${esc(ASSET_KINDS[a.kind]?.label ?? a.kind)}</td><td>${esc(a.name)}</td><td>${esc(a.ip || "—")}</td><td>${esc(a.mac || "—")}</td><td>${esc(unit(facilityName, facilityKind))}</td><td>${esc(a.room)}</td><td>${esc(ASSET_STATUS[a.status]?.label ?? a.status)}</td><td>${esc(a.provider || "—")}</td><td>${esc(a.bandwidth || "—")}</td><td>${esc(a.linkUrl || "—")}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Relatório DTIC</title>
<style>
body{font-family:Calibri,Arial,sans-serif;color:#111;font-size:12px;margin:28px}
h1{font-size:20px;color:#0e7490;margin-bottom:2px}
h2{font-size:14px;color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:3px;margin-top:24px}
.meta{color:#475569;font-size:11px;margin-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:10.5px;margin-top:8px}
th{background:#0e7490;color:#fff;padding:5px 6px;border:1px solid #94a3b8;text-align:left}
td{padding:4px 6px;border:1px solid #cbd5e1}
tr:nth-child(even) td{background:#f1f5f9}
ul{margin:6px 0 0 18px;padding:0}
li{margin-bottom:3px}
</style></head>
<body>
<h1>DTIC/SUPORTE — Relatório Operacional</h1>
<p class="meta">${esc(data.settings.orgName)}</p>
<p class="meta">Período: últimos ${data.periodo} dias (${fmtD(data.cutoff)} a ${fmtD(new Date())}) · Gerado em ${fmtDT(new Date())} por ${esc(userName)}</p>
<h2>1. Resumo do período</h2>
<ul>
<li>Chamados no período: <b>${data.summary.total}</b></li>
<li>Abertos: ${data.summary.abertos} · Em andamento: ${data.summary.andamento}</li>
<li>Resolvidos: ${data.summary.resolvidos} · Fechados: ${data.summary.fechados}</li>
<li>Tempo médio de resolução: ${data.summary.avgResH > 0 ? data.summary.avgResH + " h" : "—"}</li>
<li>Equipamentos no inventário: ${data.assets.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind)).length}</li>
<li>Notebooks: ${data.assets.filter(({ a }) => a.kind === "notebook").length} · IPs informados: ${data.assets.filter(({ a }) => a.ip).length} · Links: ${data.assets.filter(({ a }) => a.kind === "link").length}</li>
<li>Unidades monitoradas: ${data.summary.escolas} escolas + ${data.summary.cmeis} CMEIs</li>
</ul>
<h2>2. Chamados (${data.tickets.length})</h2>
<table>
<thead><tr><th>Código</th><th>Título</th><th>Unidade</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Aberto em</th></tr></thead>
<tbody>${chamadosRows || '<tr><td colspan="7">Sem chamados no período.</td></tr>'}</tbody>
</table>
<h2>3. Inventário (${data.assets.length} registros)</h2>
<table>
<thead><tr><th>Tipo</th><th>Identificação</th><th>IP</th><th>MAC</th><th>Unidade</th><th>Sala</th><th>Status</th><th>Provedor</th><th>Velocidade</th><th>URL</th></tr></thead>
<tbody>${equipRows}</tbody>
</table>
<p class="meta" style="margin-top:18px">Relatório gerado pelo console DTIC/SUPORTE · uso interno.</p>
</body></html>`;
  return Buffer.from(html, "utf8");
}

/* --------------------------------- handler --------------------------------- */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user)
    return Response.json({ ok: false, msg: "Não autenticado." }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const formato = p.get("formato") ?? "";
  const periodo = PERIODS.includes(Number(p.get("periodo")))
    ? Number(p.get("periodo"))
    : 15;

  const data = await gatherData(periodo);
  const date = new Date().toISOString().slice(0, 10);
  const dl = (name: string) => `attachment; filename="${name}"`;

  if (formato === "pdf") {
    const buf = await buildPdf(data, user.name);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": dl(`relatorio-dtic-${date}.pdf`),
      },
    });
  }
  if (formato === "xlsx") {
    const buf = buildXlsx(data, user.name);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": dl(`relatorio-dtic-${date}.xlsx`),
      },
    });
  }
  if (formato === "doc") {
    const buf = buildDoc(data, user.name);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": dl(`relatorio-dtic-${date}.doc`),
      },
    });
  }

  return Response.json(
    { ok: false, msg: "Formato inválido. Use pdf, xlsx ou doc." },
    { status: 400 },
  );
}
