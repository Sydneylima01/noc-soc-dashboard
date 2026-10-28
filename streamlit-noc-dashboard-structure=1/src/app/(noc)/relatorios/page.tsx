import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  tickets as ticketsTable,
  uploads as uploadsTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  ASSET_KINDS,
  ASSET_STATUS,
  CATEGORIES,
  EQUIPMENT_KINDS,
  fmtD,
  fmtDT,
  getSettings,
  PRIORITIES,
  resolutionLabel,
  TICKET_STATUS,
} from "@/lib/util";
import {
  Badge,
  EmptyRow,
  HBars,
  Icon,
  Panel,
  PageHead,
  Reveal,
} from "@/components/ui";
import {
  DownloadCsv,
  FileUpload,
  PrintButton,
  RemoveUploadBtn,
} from "@/components/forms";

type SP = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [7, 15, 30, 90];

export default async function RelatoriosPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const periodo = PERIODS.includes(Number(sp.periodo)) ? Number(sp.periodo) : 15;
  const cutoff = new Date(Date.now() - periodo * 864e5);

  const [tkAll, assets, fs, st, up] = await Promise.all([
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
    db.select().from(uploadsTable).orderBy(desc(uploadsTable.createdAt)).limit(50),
  ]);

  const exportUrl = (f: string) =>
    `/api/relatorios/export?formato=${f}&periodo=${periodo}`;
  const sizeLabel = (n: number) =>
    n > 1048576
      ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;

  const tk = tkAll.filter(({ t }) => t.createdAt >= cutoff);

  /* ------------------------------- resumo ------------------------------- */
  const count = (f: (r: (typeof tk)[number]) => boolean) => tk.filter(f).length;
  const byStatus = Object.fromEntries(
    Object.keys(TICKET_STATUS).map((k) => [k, count((r) => r.t.status === k)]),
  ) as Record<string, number>;

  const byCat = CATEGORIES
    .map((c) => ({ label: c, value: count((r) => r.t.category === c) }))
    .sort((a, b) => b.value - a.value);

  const byPrio = Object.entries(PRIORITIES).map(([k, v]) => ({
    label: v.label,
    value: count((r) => r.t.priority === k),
    tone: v.tone,
  }));

  const resolved = tk.filter(({ t }) => t.resolvedAt);
  const avgRes =
    resolved.length > 0
      ? (() => {
          const avgMs =
            resolved.reduce(
              (acc, { t }) => acc + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
              0,
            ) / resolved.length;
          return `${Math.round(avgMs / 36e5)} h`;
        })()
      : "—";

  /* --------------------------- matriz unidade x tipo --------------------------- */
  const matrix = fs.map((f) => {
    const of = assets.filter(({ a }) => a.facilityId === f.id);
    const equipment = of.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind));
    return {
      ...f,
      impressora: of.filter((r) => r.a.kind === "impressora").length,
      mesinha: of.filter((r) => r.a.kind === "mesinha").length,
      computador: of.filter((r) => r.a.kind === "computador").length,
      notebook: of.filter((r) => r.a.kind === "notebook").length,
      ip: of.filter((r) => r.a.ip).length,
      link: of.filter((r) => r.a.kind === "link").length,
      total: equipment.length,
      ativos: equipment.filter((r) => r.a.status === "ativo").length,
    };
  });

  /* --------------------------------- CSVs --------------------------------- */
  const headChamados = ["Código", "Título", "Solicitante", "Contato", "Unidade", "Tipo unidade", "Categoria", "Prioridade", "Status", "Aberto em", "Resolvido em"];
  const rowsChamados = tk.map(({ t, facilityName, facilityKind }) => [
    t.code, t.title, t.requester, t.contact || "—",
    facilityName ?? "—", facilityKind ?? "—",
    t.category, PRIORITIES[t.priority]?.label ?? t.priority,
    TICKET_STATUS[t.status]?.label ?? t.status,
    fmtDT(t.createdAt), t.resolvedAt ? fmtDT(t.resolvedAt) : "—",
  ]);

  const headEq = ["Tipo", "Identificação", "IP", "MAC", "Unidade", "Tipo unidade", "Sala", "Status", "Provedor", "Velocidade", "URL", "Observações"];
  const rowsEq = assets.map(({ a, facilityName, facilityKind }) => [
    ASSET_KINDS[a.kind]?.label ?? a.kind, a.name, a.ip || "—", a.mac || "—",
    facilityName ?? "—", facilityKind ?? "—", a.room || "—",
    ASSET_STATUS[a.status]?.label ?? a.status,
    a.provider || "—", a.bandwidth || "—", a.linkUrl || "—", a.notes || "—",
  ]);

  const headResumo = ["Métrica", "Valor"];
  const rowsResumo = [
    ["Período", `últimos ${periodo} dias`],
    ["Chamados no período", tk.length],
    ["Abertos", byStatus.aberto ?? 0],
    ["Em andamento", byStatus.andamento ?? 0],
    ["Resolvidos", byStatus.resolvido ?? 0],
    ["Fechados", byStatus.fechado ?? 0],
    ["Tempo médio de resolução", avgRes],
    ["Equipamentos no inventário", assets.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind)).length],
    ["Notebooks", assets.filter(({ a }) => a.kind === "notebook").length],
    ["IPs informados", assets.filter(({ a }) => a.ip).length],
    ["Links", assets.filter(({ a }) => a.kind === "link").length],
    ["Unidades monitoradas", fs.length],
  ];

  return (
    <div>
      <PageHead
        kicker="relatórios & exportação"
        title="Relatórios"
        sub="Geração de relatórios operacionais: chamados do período, inventário de equipamentos e resumo por unidade."
      >
        <a
          href={exportUrl("pdf")}
          className="btn btn-primary no-print !px-3 !py-2 text-xs"
          title="Gerar relatório em PDF"
        >
          <Icon name="file" className="h-3.5 w-3.5" />
          PDF
        </a>
        <a
          href={exportUrl("xlsx")}
          className="btn btn-ghost no-print !px-3 !py-2 text-xs"
          title="Gerar planilha Excel"
        >
          <Icon name="chart" className="h-3.5 w-3.5" />
          Excel
        </a>
        <a
          href={exportUrl("doc")}
          className="btn btn-ghost no-print !px-3 !py-2 text-xs"
          title="Gerar documento Word"
        >
          <Icon name="file" className="h-3.5 w-3.5" />
          Word
        </a>
        <PrintButton />
      </PageHead>

      {/* cabeçalho do relatório */}
      <Reveal className="mb-5">
        <div className="panel hud p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal-400">
                // relatório operacional
              </p>
              <p className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-slate-50">
                {st.orgName}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Gerado em {fmtDT(new Date())} por {user.name} · DTIC/SUPORTE
              </p>
            </div>
            <form method="GET" action="/relatorios" className="no-print flex items-center gap-2">
              <label className="lbl !mb-0" htmlFor="periodo">Período</label>
              <select id="periodo" name="periodo" className="field !w-auto" defaultValue={periodo}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>Últimos {p} dias</option>
                ))}
              </select>
              <button className="btn btn-ghost">Aplicar</button>
            </form>
          </div>
        </div>
      </Reveal>

      {/* resumo */}
      <Reveal delay={60}>
        <Panel
          title={`Resumo — últimos ${periodo} dias`}
          sub="indicadores do período selecionado"
          actions={<DownloadCsv filename="dtic-resumo.csv" head={headResumo} rows={rowsResumo} label="Resumo CSV" />}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 md:col-span-1">
              {[
                ["Chamados", tk.length, "text-slate-100"],
                ["Abertos", byStatus.aberto ?? 0, "text-crit-300"],
                ["Andamento", byStatus.andamento ?? 0, "text-warn-300"],
                ["Resolvidos", byStatus.resolvido ?? 0, "text-ok-300"],
                ["Fechados", byStatus.fechado ?? 0, "text-slate-400"],
                ["Tempo médio", avgRes, "text-signal-300"],
              ].map(([label, value, cls]) => (
                <div key={String(label)} className="rounded-md border border-ink-600/40 bg-ink-800/40 p-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                  <p className={`mt-1 font-display text-xl font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Por categoria
              </p>
              <HBars data={byCat} />
            </div>
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Por prioridade
              </p>
              <HBars data={byPrio} />
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* chamados do período */}
      <Reveal delay={100} className="mt-4">
        <Panel
          title="Chamados no período"
          sub={`${tk.length} registro${tk.length !== 1 ? "s" : ""} entre ${fmtD(cutoff)} e ${fmtD(new Date())}`}
          actions={<DownloadCsv filename="dtic-chamados.csv" head={headChamados} rows={rowsChamados} />}
          className="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="tbl min-w-[860px]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Unidade</th>
                  <th>Categoria</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Aberto em</th>
                  <th>Resolvido em</th>
                </tr>
              </thead>
              <tbody>
                {tk.length === 0 && (
                  <EmptyRow cols={8} text="Nenhum chamado aberto no período selecionado." />
                )}
                {tk.map(({ t, facilityName, facilityKind }) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap font-mono text-xs font-semibold text-signal-300">{t.code}</td>
                    <td className="max-w-[280px] truncate text-slate-200" title={t.title}>{t.title}</td>
                    <td className="whitespace-nowrap text-xs text-slate-300">
                      {facilityName ? `${facilityKind} · ${facilityName}` : "—"}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{t.category}</td>
                    <td><Badge tone={PRIORITIES[t.priority].tone}>{PRIORITIES[t.priority].label}</Badge></td>
                    <td><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge></td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">{fmtDT(t.createdAt)}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">{t.resolvedAt ? fmtDT(t.resolvedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* inventário por unidade */}
      <Reveal delay={140} className="mt-4">
        <Panel
          title="Inventário por unidade"
          sub="equipamentos e recursos de rede por escola e CMEI"
          className="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="tbl min-w-[960px]">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th className="text-right">Impressoras</th>
                  <th className="text-right">Mesinhas</th>
                  <th className="text-right">Computadores</th>
                  <th className="text-right">Notebooks</th>
                  <th className="text-right">IPs</th>
                  <th className="text-right">Links</th>
                  <th className="text-right">Equipamentos</th>
                  <th className="text-right">Ativos</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Badge tone={m.kind === "ESCOLA" ? "cyan" : "violet"}>{m.kind}</Badge>
                      <span className="ml-2 text-xs text-slate-200">{m.name}</span>
                    </td>
                    <td className="text-right font-mono text-xs text-slate-300">{m.impressora}</td>
                    <td className="text-right font-mono text-xs text-slate-300">{m.mesinha}</td>
                    <td className="text-right font-mono text-xs text-slate-300">{m.computador}</td>
                    <td className="text-right font-mono text-xs text-slate-300">{m.notebook}</td>
                    <td className="text-right font-mono text-xs text-signal-300">{m.ip}</td>
                    <td className="text-right font-mono text-xs text-slate-300">{m.link}</td>
                    <td className="text-right font-mono text-xs font-semibold text-slate-100">{m.total}</td>
                    <td className="text-right font-mono text-xs text-ok-300">{m.ativos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">IPs incluem endereços informados em equipamentos, links e cadastros próprios. O total de equipamentos não inclui registros de IPs ou links.</p>
        </Panel>
      </Reveal>

      {/* estoque completo */}
      <Reveal delay={180} className="mt-4">
        <Panel
          title="Inventário completo"
          sub={`${assets.length} registros de equipamentos, IPs e links`}
          actions={<DownloadCsv filename="dtic-equipamentos.csv" head={headEq} rows={rowsEq} />}
          className="overflow-hidden"
        >
          <div className="max-h-[420px] overflow-auto">
            <table className="tbl min-w-[820px]">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Identificação</th>
                  <th>IP</th>
                  <th>MAC</th>
                  <th>Unidade</th>
                  <th>Sala</th>
                  <th>Status</th>
                  <th>Provedor</th>
                  <th>Velocidade</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(({ a, facilityName }) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs text-slate-300">{ASSET_KINDS[a.kind]?.label ?? a.kind}</td>
                    <td className="whitespace-nowrap font-mono text-xs font-semibold text-slate-100">{a.name}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-signal-300">{a.ip || "—"}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">{a.mac || "—"}</td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{facilityName ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs text-slate-400">{a.room || "—"}</td>
                    <td><Badge tone={ASSET_STATUS[a.status]?.tone ?? "slate"}>{ASSET_STATUS[a.status]?.label ?? a.status}</Badge></td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{a.provider || "—"}</td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{a.bandwidth || "—"}</td>
                    <td className="max-w-[240px] truncate font-mono text-xs text-slate-400" title={a.linkUrl}>{a.linkUrl || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* upload de relatórios */}
      <Reveal delay={220} className="mt-4">
        <Panel
          title="Base de documentos"
          sub="envio, consulta e download de relatórios (PDF, Excel e Word) compartilhados pela equipe"
          actions={
            <Badge tone="cyan" className="no-print">
              {up.length} arquivo{up.length !== 1 ? "s" : ""}
            </Badge>
          }
          className="overflow-hidden"
        >
          <div className="no-print mb-4">
            <FileUpload />
          </div>
          <div className="overflow-x-auto">
            <table className="tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Tamanho</th>
                  <th>Enviado por</th>
                  <th>Data</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {up.length === 0 && (
                  <EmptyRow
                    cols={5}
                    text="Nenhum relatório enviado ainda. Use a área acima para adicionar."
                  />
                )}
                {up.map((u) => (
                  <tr key={u.id}>
                    <td className="max-w-[320px]">
                      <span className="flex items-center gap-2">
                        <Icon name="file" className="h-4 w-4 shrink-0 text-signal-300" />
                        <span
                          className="truncate font-mono text-xs font-semibold text-slate-100"
                          title={u.originalName}
                        >
                          {u.originalName}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">
                      {sizeLabel(u.size)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-300">
                      {u.uploadedByName}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">
                      {fmtDT(u.createdAt)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/uploads/${u.id}`}
                          className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                        >
                          <Icon name="download" className="h-3.5 w-3.5" />
                          Baixar
                        </a>
                        <span className="no-print">
                          <RemoveUploadBtn id={u.id} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      <p className="mt-6 flex items-center justify-center gap-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
        <Icon name="shield" className="h-3.5 w-3.5" />
        relatório gerado pelo console DTIC/SUPORTE · uso interno
      </p>
    </div>
  );
}
