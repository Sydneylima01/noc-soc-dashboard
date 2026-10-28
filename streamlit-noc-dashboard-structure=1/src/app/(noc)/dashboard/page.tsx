import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  logs as logsTable,
  tickets as ticketsTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  getSettings,
  CATEGORIES,
  EQUIPMENT_KINDS,
  PRIORITIES,
  resolutionLabel,
  TICKET_STATUS,
  timeAgo,
} from "@/lib/util";
import {
  Badge,
  BarChart,
  Donut,
  HBars,
  Icon,
  Panel,
  PageHead,
  Reveal,
  Stat,
  TONE_HEX,
} from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const [tk, as, lg, fs, st] = await Promise.all([
    db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt)),
    db.select().from(assetsTable),
    db.select().from(logsTable).orderBy(desc(logsTable.createdAt)).limit(14),
    db.select().from(facilitiesTable).orderBy(facilitiesTable.name),
    getSettings(),
  ]);

  /* ------------------------------ agregações ------------------------------ */
  const byStatus = (s: string) => tk.filter((t) => t.status === s).length;
  const open = byStatus("aberto");
  const inProgress = byStatus("andamento");
  const resolvedTotal = byStatus("resolvido") + byStatus("fechado");

  const today = new Date().toDateString();
  const resolvedToday = tk.filter(
    (t) =>
      (t.status === "resolvido" || t.status === "fechado") &&
      t.resolvedAt &&
      t.resolvedAt.toDateString() === today,
  ).length;

  const printers = as.filter((a) => a.kind === "impressora");
  const printersOk = printers.filter((a) => a.status === "ativo").length;
  const equipment = as.filter((a) => EQUIPMENT_KINDS.includes(a.kind));
  const computers = as.filter((a) => ["mesinha", "computador", "notebook"].includes(a.kind));
  const computersOk = computers.filter((a) => a.status === "ativo").length;
  const ipCount = as.filter((a) => a.ip).length;
  const linkCount = as.filter((a) => a.kind === "link").length;

  const days: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    days.push({
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: tk.filter((t) => t.createdAt >= d && t.createdAt < next).length,
    });
  }

  const byCat = CATEGORIES
    .map((c) => ({ label: c, value: tk.filter((t) => t.category === c).length }))
    .sort((a, b) => b.value - a.value);

  const donutSegs = [
    { value: open, color: TONE_HEX.red },
    { value: inProgress, color: TONE_HEX.amber },
    { value: byStatus("resolvido"), color: TONE_HEX.green },
    { value: byStatus("fechado"), color: TONE_HEX.slate },
  ];

  const resolved = tk.filter((t) => t.resolvedAt);
  const avgRes =
    resolved.length > 0
      ? resolutionLabel(
          new Date(0),
          new Date(
            resolved.reduce(
              (acc, t) => acc + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
              0,
            ) / resolved.length,
          ),
        )
      : "—";

  const critical = tk
    .filter(
      (t) =>
        (t.status === "aberto" || t.status === "andamento") &&
        (t.priority === "critica" || t.priority === "alta"),
    )
    .slice(0, 5);

  const facilityStats = fs.map((f) => {
    const assetsF = as.filter((a) => a.facilityId === f.id);
    const equipmentF = assetsF.filter((a) => EQUIPMENT_KINDS.includes(a.kind));
    const ok = equipmentF.filter((a) => a.status === "ativo").length;
    const openT = tk.filter(
      (t) => t.facilityId === f.id && (t.status === "aberto" || t.status === "andamento"),
    ).length;
    return {
      ...f,
      total: equipmentF.length,
      ok,
      openT,
      impressora: assetsF.filter((a) => a.kind === "impressora").length,
      mesinha: assetsF.filter((a) => a.kind === "mesinha").length,
      computador: assetsF.filter((a) => a.kind === "computador").length,
      notebook: assetsF.filter((a) => a.kind === "notebook").length,
      ip: assetsF.filter((a) => a.ip).length,
      link: assetsF.filter((a) => a.kind === "link").length,
    };
  });

  const gruposUnidade = (["ESCOLA", "CMEI"] as const).map((kind) => ({
    kind,
    title: kind === "ESCOLA" ? "Escolas" : "CMEIs",
    items: facilityStats.filter((f) => f.kind === kind),
    totalEq: facilityStats
      .filter((f) => f.kind === kind)
      .reduce((acc, f) => acc + f.total, 0),
  }));

  return (
    <div>
      <PageHead
        kicker="central de operações"
        title="Painel NOC"
        sub={`${st.orgName} — visão geral de rede, chamados e equipamentos. Atualizado em tempo real.`}
      >
        <Badge tone="green" dot>
          Rede {st.networkUptime}% uptime
        </Badge>
        <Link href="/suporte?novo=1" className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          Novo chamado
        </Link>
      </PageHead>

      {/* ----------------------------------- KPIs ----------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon="alert" label="Chamados abertos" value={String(open)} sub={`${inProgress} em andamento`} tone="red" delay={0} />
        <Stat icon="activity" label="Resolvidos hoje" value={String(resolvedToday)} sub={`${resolvedTotal} no histórico`} tone="green" delay={60} />
        <Stat icon="clock" label="Tempo médio" value={avgRes} sub="até a resolução" tone="cyan" delay={120} />
        <Stat icon="printer" label="Impressoras ativas" value={`${printersOk}/${printers.length}`} sub="na rede das unidades" tone="amber" delay={180} />
        <Stat icon="monitor" label="Estações ativas" value={`${computersOk}/${computers.length}`} sub="mesinhas, PCs e notebooks" tone="violet" delay={240} />
        <Stat icon="network" label="IPs informados" value={String(ipCount)} sub={`${linkCount} link(s) no inventário`} tone="cyan" delay={300} />
      </div>

      {/* ------------------------------- gráficos ------------------------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal delay={80} className="lg:col-span-1">
          <Panel title="Fluxo de chamados" sub="últimos 14 dias" hud className="h-full">
            <BarChart data={days} height={158} />
          </Panel>
        </Reveal>
        <Reveal delay={140}>
          <Panel title="Status dos chamados" sub="situação atual do plantão" className="h-full">
            <div className="flex items-center gap-5">
              <Donut
                segments={donutSegs}
                centerLabel={String(tk.length)}
                centerSub="total"
              />
              <ul className="space-y-2.5 text-xs">
                {[
                  { k: "aberto", v: open },
                  { k: "andamento", v: inProgress },
                  { k: "resolvido", v: byStatus("resolvido") },
                  { k: "fechado", v: byStatus("fechado") },
                ].map((r) => (
                  <li key={r.k} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: TONE_HEX[TICKET_STATUS[r.k].tone] }}
                    />
                    <span className="text-slate-300">{TICKET_STATUS[r.k].label}</span>
                    <span className="ml-auto pl-4 font-mono text-slate-400">{r.v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </Reveal>
        <Reveal delay={200}>
          <Panel title="Por categoria" sub="distribuição de chamados" className="h-full">
            <HBars data={byCat} />
          </Panel>
        </Reveal>
      </div>

      {/* --------------------------- unidades + críticos + feed --------------------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal delay={80}>
          <Panel
            title="Unidades monitoradas"
            sub="escolas e CMEIs separados, com contagem de equipamentos"
            actions={<Badge tone="cyan">{fs.length} unidades · {equipment.length} equipamentos</Badge>}
            className="h-full"
          >
            <div className="space-y-5">
              {gruposUnidade.map((g) => (
                <div key={g.kind}>
                  <div className="mb-2.5 flex items-center gap-2.5 border-b border-ink-600/40 pb-2">
                    <Icon
                      name="building"
                      className={`h-4 w-4 ${g.kind === "ESCOLA" ? "text-signal-300" : "text-lav-300"}`}
                    />
                    <p className="font-display text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-100">
                      {g.title}
                      <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
                        {g.items.length} unidade{g.items.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                    <Badge tone={g.kind === "ESCOLA" ? "cyan" : "violet"} className="ml-auto">
                      {g.totalEq} equipamentos
                    </Badge>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {g.items.map((f) => (
                      <div
                        key={f.id}
                        className={`rounded-md border p-3 transition-colors ${
                          f.openT > 0
                            ? "border-crit-400/30 bg-crit-400/[0.04]"
                            : "border-ink-600/40 bg-ink-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            {f.total} equip. · {f.ok} ativos
                          </span>
                          {f.openT > 0 ? (
                            <span className="font-mono text-[10px] text-crit-300">
                              {f.openT} aberto{f.openT > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-ok-300">ok</span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[13px] font-semibold text-slate-200" title={f.name}>
                          {f.name}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] text-slate-400">
                          {[
                            { label: "Impressoras", icon: "printer", value: f.impressora },
                            { label: "Mesinhas digitais", icon: "cpu", value: f.mesinha },
                            { label: "Computadores", icon: "monitor", value: f.computador },
                            { label: "Notebooks", icon: "laptop", value: f.notebook },
                            { label: "IPs informados", icon: "network", value: f.ip },
                            { label: "Links", icon: "link", value: f.link },
                          ].map((item) => (
                            <span key={item.label} className="flex items-center gap-1" title={item.label} aria-label={`${item.label}: ${item.value}`}>
                              <Icon name={item.icon} className="h-3 w-3" />{item.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={140}>
          <Panel
            title="Chamados prioritários"
            sub="críticos e alta prioridade em aberto"
            className="h-full"
          >
            {critical.length === 0 ? (
              <p className="py-8 text-center font-mono text-xs text-slate-500">
                Nenhum chamado prioritário em aberto. Plantão tranquilo.
              </p>
            ) : (
              <ul className="space-y-2">
                {critical.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/suporte/${t.id}`}
                      className="group flex items-center gap-3 rounded-md border border-ink-600/40 bg-ink-800/40 p-3 transition-colors hover:border-signal-400/40"
                    >
                      <Badge tone={PRIORITIES[t.priority].tone} className="shrink-0">
                        {PRIORITIES[t.priority].label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-200 group-hover:text-signal-300">
                          {t.title}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500">
                          {t.code} · {t.category} · {timeAgo(t.createdAt)}
                        </p>
                      </div>
                      <Icon name="back" className="h-4 w-4 rotate-180 text-slate-600 group-hover:text-signal-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={200}>
          <Panel title="Atividade recente" sub="trilha do console" className="h-full">
            <div className="max-h-[340px] overflow-y-auto rounded-md border border-ink-600/40 bg-ink-950/85 p-3.5 font-mono text-[10.5px] leading-relaxed">
              {lg.map((l) => (
                <p key={l.id} className="flex gap-2 whitespace-nowrap py-[3px]">
                  <span className="text-slate-600">
                    [{l.createdAt.toLocaleTimeString("pt-BR")}]
                  </span>
                  <span className="w-[72px] shrink-0 truncate text-signal-300">
                    {l.username}
                  </span>
                  <span className="shrink-0 text-ok-300">{l.action}</span>
                  <span className="truncate text-slate-400" title={l.details}>
                    {l.details}
                  </span>
                </p>
              ))}
              <p className="pt-1 text-ok-400">
                noc@dtic:~$ <span className="caret" />
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
        operado por {user.name} · perfil{" "}
        {user.role === "superadmin" ? "super admin" : "técnico"} · sessão 12h
      </p>
    </div>
  );
}
