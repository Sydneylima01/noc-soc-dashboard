import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets as assetsTable, facilities as facilitiesTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ASSET_KINDS, ASSET_KIND_ORDER, ASSET_STATUS, EQUIPMENT_KINDS } from "@/lib/util";
import { Badge, EmptyRow, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { AssetForm, DeleteAssetBtn } from "@/components/forms";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AtivosPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tipoRaw = String(sp.tipo ?? "");
  const tipo = (ASSET_KIND_ORDER as readonly string[]).includes(tipoRaw) ? tipoRaw : "impressora";
  const kindRaw = String(sp.kind ?? "").toUpperCase();
  const kindF = kindRaw === "ESCOLA" || kindRaw === "CMEI" ? kindRaw : "";
  const q = String(sp.q ?? "").trim().toLowerCase();
  const novo = String(sp.novo ?? "") === "1";
  const editId = Number(sp.edit);

  const [all, fs] = await Promise.all([
    db
      .select({ a: assetsTable, facilityName: facilitiesTable.name, facilityKind: facilitiesTable.kind })
      .from(assetsTable)
      .leftJoin(facilitiesTable, eq(assetsTable.facilityId, facilitiesTable.id))
      .orderBy(asc(assetsTable.name)),
    db.select().from(facilitiesTable).orderBy(facilitiesTable.name),
  ]);

  // A aba IPs reúne endereços cadastrados separadamente e também os já informados nos equipamentos.
  const inTab = (a: (typeof all)[number]["a"], tab: string) =>
    tab === "ip" ? Boolean(a.ip) : a.kind === tab;
  const counts = Object.fromEntries(
    ASSET_KIND_ORDER.map((k) => [k, all.filter(({ a }) => inTab(a, k)).length]),
  ) as Record<string, number>;
  const tabRows = all.filter(({ a }) => inTab(a, tipo));
  const kindCounts = {
    ESCOLA: tabRows.filter((r) => r.facilityKind === "ESCOLA").length,
    CMEI: tabRows.filter((r) => r.facilityKind === "CMEI").length,
  };

  const rows = tabRows.filter(({ a, facilityName, facilityKind }) => {
    if (kindF && facilityKind !== kindF) return false;
    const haystack = `${a.name} ${a.ip} ${a.mac} ${a.room} ${facilityName ?? ""} ${a.notes} ${a.provider} ${a.bandwidth} ${a.linkUrl}`.toLowerCase();
    return !q || haystack.includes(q);
  });
  const editing = Number.isInteger(editId) && editId > 0
    ? all.find(({ a }) => a.id === editId)?.a ?? null
    : null;
  const kindMeta = ASSET_KINDS[tipo];
  const unitQuery = kindF ? `&kind=${kindF}` : "";
  const equipmentCount = all.filter(({ a }) => EQUIPMENT_KINDS.includes(a.kind)).length;

  return (
    <div>
      <PageHead
        kicker="gestão de inventário"
        title="Inventário"
        sub="Equipamentos e recursos de rede das escolas e CMEIs em um só lugar."
      >
        <Link
          href={novo || editing ? `/ativos?tipo=${tipo}${unitQuery}` : `/ativos?tipo=${tipo}${unitQuery}&novo=1`}
          className="btn btn-primary"
        >
          <Icon name={novo || editing ? "x" : "plus"} className="h-4 w-4" />
          {novo || editing ? "Fechar cadastro" : tipo === "ip" ? "Cadastrar IP" : tipo === "link" ? "Cadastrar link" : `Cadastrar ${kindMeta.label.toLowerCase()}`}
        </Link>
      </PageHead>

      {sp.salvo === "1" && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-md border border-ok-400/30 bg-ok-400/10 px-4 py-3 text-sm text-ok-300">
          <Icon name="shield" className="h-4 w-4" /> Registro cadastrado com sucesso.
        </div>
      )}

      <Reveal className="mb-5">
        <div className="panel hud flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div className="mr-auto">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Visão geral do inventário</p>
            <p className="mt-1 text-xs text-slate-400">Selecione uma categoria para consultar e gerenciar os registros.</p>
          </div>
          {[
            { label: "Equipamentos", value: equipmentCount, icon: "monitor" },
            { label: "IPs informados", value: counts.ip, icon: "network" },
            { label: "Links", value: counts.link, icon: "link" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5">
              <Icon name={stat.icon} className="h-4 w-4 text-signal-300" />
              <div>
                <p className="font-display text-lg font-bold leading-none text-slate-100">{stat.value}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="mb-5" delay={30}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {ASSET_KIND_ORDER.map((k) => {
            const m = ASSET_KINDS[k];
            const active = k === tipo;
            return (
              <Link
                key={k}
                href={`/ativos?tipo=${k}${unitQuery}`}
                aria-current={active ? "page" : undefined}
                className={`group flex min-w-0 items-center gap-3 rounded-md border px-3.5 py-3 transition-all ${
                  active
                    ? "border-signal-400/50 bg-signal-400/10 shadow-[0_0_18px_rgba(34,211,238,0.10)]"
                    : "border-ink-600/40 bg-ink-800/40 text-slate-400 hover:border-signal-400/30 hover:text-slate-200"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${active ? "border-signal-400/30 bg-signal-400/10 text-signal-300" : "border-ink-600/40 bg-ink-900/50 text-slate-500"}`}>
                  <Icon name={m.icon} className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className={`truncate font-display text-[12px] font-semibold uppercase tracking-wider ${active ? "text-signal-300" : "text-slate-200"}`}>{m.plural}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500">{counts[k]} {k === "ip" ? "informados" : "registrados"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={40} className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Unidade:</span>
          {[
            { v: "", label: "Todas", n: tabRows.length },
            { v: "ESCOLA", label: "Escolas", n: kindCounts.ESCOLA },
            { v: "CMEI", label: "CMEIs", n: kindCounts.CMEI },
          ].map((c) => (
            <Link
              key={c.label}
              href={`/ativos?tipo=${tipo}${c.v ? `&kind=${c.v}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                kindF === c.v ? "border-signal-400/50 bg-signal-400/10 text-signal-300" : "border-ink-600/40 text-slate-400 hover:border-signal-400/40 hover:text-slate-200"
              }`}
            >
              {c.label} · <span className="font-semibold">{c.n}</span>
            </Link>
          ))}
          <span className="ml-auto font-mono text-[10px] text-slate-500">exibindo {rows.length} de {tabRows.length}</span>
        </div>
      </Reveal>

      {(novo || editing) && (
        <Reveal className="mb-5">
          <Panel title={editing ? `Editar — ${editing.name}` : `Cadastrar ${kindMeta.label.toLowerCase()}`} sub={kindMeta.desc} hud>
            <AssetForm
              key={editing ? `edit-${editing.id}` : `new-${tipo}`}
              defaultKind={tipo}
              initial={editing ? {
                id: editing.id, kind: editing.kind, name: editing.name,
                ip: editing.ip, mac: editing.mac, provider: editing.provider,
                bandwidth: editing.bandwidth, linkUrl: editing.linkUrl,
                facilityId: editing.facilityId, room: editing.room,
                status: editing.status, notes: editing.notes,
              } : null}
              facilities={fs.map((f) => ({ id: f.id, name: f.name, kind: f.kind }))}
            />
          </Panel>
        </Reveal>
      )}

      <Reveal delay={60}>
        <Panel
          title={kindMeta.plural}
          sub={tipo === "ip" ? "IPs de equipamentos e links, além de endereços cadastrados separadamente." : kindMeta.desc}
          actions={
            <form method="GET" action="/ativos" className="no-print relative flex items-center gap-2">
              <input type="hidden" name="tipo" value={tipo} />
              {kindF && <input type="hidden" name="kind" value={kindF} />}
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input name="q" defaultValue={q} className="field !w-60 !pl-8 sm:!w-64" placeholder="Buscar nome, IP, link, unidade…" aria-label="Buscar no inventário" />
              </div>
              <button type="submit" className="btn btn-ghost !py-2">Buscar</button>
              {q && <Link href={`/ativos?tipo=${tipo}${unitQuery}`} className="btn btn-ghost !py-2">Limpar</Link>}
            </form>
          }
          className="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="tbl min-w-[960px]">
              <thead><tr>
                <th>Identificação</th>
                {tipo === "ip" && <th>Origem</th>}
                <th>IP</th>
                <th>MAC</th>
                {tipo === "link" && <><th>Provedor / velocidade</th><th>URL de acesso</th></>}
                <th>Unidade (ESCOLA/CMEI)</th>
                <th>Sala / Local</th>
                <th>Status</th>
                <th>Observações</th>
                <th className="text-right">Ações</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <EmptyRow cols={tipo === "link" ? 10 : tipo === "ip" ? 9 : 8} text="Nenhum registro encontrado. Ajuste os filtros ou faça um cadastro." />}
                {rows.map(({ a, facilityName, facilityKind }) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Icon name={ASSET_KINDS[a.kind]?.icon ?? "monitor"} className="h-4 w-4 text-slate-500" />
                        <span className="font-mono text-xs font-semibold text-slate-100">{a.name}</span>
                      </span>
                    </td>
                    {tipo === "ip" && <td className="whitespace-nowrap text-xs text-slate-300">{ASSET_KINDS[a.kind]?.label ?? a.kind}</td>}
                    <td className="whitespace-nowrap font-mono text-xs text-signal-300">{a.ip || "—"}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">{a.mac || "—"}</td>
                    {tipo === "link" && <>
                      <td className="min-w-[135px] text-xs text-slate-300">{a.provider || "—"}<span className="block text-[11px] text-slate-500">{a.bandwidth || ""}</span></td>
                      <td className="max-w-[200px] truncate font-mono text-xs">
                        {a.linkUrl && /^https?:\/\//i.test(a.linkUrl) ? <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" title={a.linkUrl} className="text-signal-300 hover:underline">{a.linkUrl} ↗</a> : "—"}
                      </td>
                    </>}
                    <td className="whitespace-nowrap">
                      {facilityName ? <><Badge tone={facilityKind === "ESCOLA" ? "cyan" : "violet"}>{facilityKind}</Badge><span className="ml-1.5 text-xs text-slate-300">{facilityName}</span></> : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{a.room || "—"}</td>
                    <td><Badge tone={ASSET_STATUS[a.status]?.tone ?? "slate"} dot={a.status === "defeito"}>{ASSET_STATUS[a.status]?.label ?? a.status}</Badge></td>
                    <td className="max-w-[220px] truncate text-xs text-slate-500" title={a.notes}>{a.notes || "—"}</td>
                    <td><div className="flex items-center justify-end gap-1.5">
                      <Link href={`/ativos?tipo=${tipo}${unitQuery}&edit=${a.id}`} className="btn btn-ghost !px-2.5 !py-1.5 text-xs"><Icon name="settings" className="h-3.5 w-3.5" />Editar</Link>
                      {user.role === "superadmin" && <DeleteAssetBtn id={a.id} />}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tipo === "ip" && <p className="mt-4 font-mono text-[10px] leading-relaxed text-slate-500">IPs vinculados a equipamentos aparecem automaticamente nesta lista. A edição ou exclusão atua sobre o registro de origem.</p>}
        </Panel>
      </Reveal>
    </div>
  );
}
