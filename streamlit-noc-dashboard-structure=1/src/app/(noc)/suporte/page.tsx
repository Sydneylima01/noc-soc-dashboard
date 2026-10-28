import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  tickets as ticketsTable,
  users as usersTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDT, PRIORITIES, TICKET_STATUS } from "@/lib/util";
import { updateTicketStatus } from "@/app/actions/tickets";
import { Badge, EmptyRow, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { DeleteTicketBtn, NewTicketForm } from "@/components/forms";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SuportePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = String(sp.status ?? "");
  const prio = String(sp.prio ?? "");
  const q = String(sp.q ?? "").trim().toLowerCase();
  const novo = String(sp.novo ?? "") === "1";

  const [all, fs, assets] = await Promise.all([
    db
      .select({
        t: ticketsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
        assetName: assetsTable.name,
        creator: usersTable.name,
      })
      .from(ticketsTable)
      .leftJoin(facilitiesTable, eq(ticketsTable.facilityId, facilitiesTable.id))
      .leftJoin(assetsTable, eq(ticketsTable.assetId, assetsTable.id))
      .leftJoin(usersTable, eq(ticketsTable.createdById, usersTable.id))
      .orderBy(desc(ticketsTable.createdAt)),
    db.select().from(facilitiesTable).orderBy(facilitiesTable.name),
    db.select().from(assetsTable).orderBy(assetsTable.name),
  ]);

  const counts = {
    aberto: all.filter((r) => r.t.status === "aberto").length,
    andamento: all.filter((r) => r.t.status === "andamento").length,
    resolvido: all.filter((r) => r.t.status === "resolvido").length,
    fechado: all.filter((r) => r.t.status === "fechado").length,
  };

  const rows = all.filter(({ t, facilityName, assetName, creator }) => {
    if (status && t.status !== status) return false;
    if (prio && t.priority !== prio) return false;
    if (q) {
      const hay = `${t.code} ${t.title} ${t.requester} ${facilityName ?? ""} ${assetName ?? ""} ${creator ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const hasFilter = status || prio || q;

  return (
    <div>
      <PageHead
        kicker="suporte & serviços"
        title="Chamados"
        sub="Abertura e acompanhamento de chamados de impressoras, computadores, rede e sistemas das unidades."
      >
        <Link href={novo ? "/suporte" : "/suporte?novo=1"} className="btn btn-primary">
          <Icon name={novo ? "x" : "plus"} className="h-4 w-4" />
          {novo ? "Fechar" : "Novo chamado"}
        </Link>
      </PageHead>

      {novo && (
        <Reveal className="mb-5">
          <Panel title="Abrir novo chamado" sub="o número do chamado é gerado automaticamente" hud>
            <NewTicketForm
              facilities={fs.map((f) => ({ id: f.id, name: f.name, kind: f.kind }))}
              assets={assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
            />
          </Panel>
        </Reveal>
      )}

      <Reveal delay={60}>
        <Panel
          title="Fila de chamados"
          sub={`${rows.length} chamado${rows.length !== 1 ? "s" : ""} exibido${rows.length !== 1 ? "s" : ""}`}
          className="overflow-hidden"
        >
          {/* filtros */}
          <form method="GET" action="/suporte" className="mb-4 grid gap-2.5 sm:grid-cols-[150px_150px_1fr_auto]">
            <select name="status" className="field" defaultValue={status}>
              <option value="">Todos os status</option>
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select name="prio" className="field" defaultValue={prio}>
              <option value="">Todas as prioridades</option>
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                className="field !pl-8"
                placeholder="Buscar por código, título, solicitante, unidade…"
                defaultValue={q}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost">Filtrar</button>
              {(status || prio || q) && (
                <Link href="/suporte" className="btn btn-ghost">Limpar</Link>
              )}
            </div>
          </form>

          {/* contadores */}
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, v]) => (
              <Link
                key={k}
                href={`/suporte${status === k ? "" : `?status=${k}`}`}
                className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  status === k
                    ? "border-signal-400/50 bg-signal-400/10 text-signal-300"
                    : "border-ink-600/40 text-slate-400 hover:border-signal-400/40"
                }`}
              >
                {TICKET_STATUS[k].label}: <span className="font-semibold">{v}</span>
              </Link>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="tbl min-w-[900px]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Chamado</th>
                  <th>Unidade</th>
                  <th>Categoria</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Aberto em</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow cols={8} text="Nenhum chamado encontrado com os filtros atuais." />
                )}
                {rows.map(({ t, facilityName, facilityKind, assetName, creator }) => (
                  <tr key={t.id}>
                    <td>
                      <Link
                        href={`/suporte/${t.id}`}
                        className="font-mono text-xs font-semibold text-signal-300 hover:underline"
                      >
                        {t.code}
                      </Link>
                    </td>
                    <td className="max-w-[300px]">
                      <Link href={`/suporte/${t.id}`} className="block truncate font-medium text-slate-200 hover:text-signal-300">
                        {t.title}
                      </Link>
                      <p className="truncate text-[11px] text-slate-500">
                        {t.requester}
                        {assetName ? ` · ${assetName}` : ""}
                        {creator ? ` · por ${creator}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      {facilityName ? (
                        <>
                          <Badge tone={facilityKind === "ESCOLA" ? "cyan" : "violet"}>
                            {facilityKind}
                          </Badge>{" "}
                          <span className="ml-1 text-xs text-slate-400">{facilityName}</span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-300">{t.category}</td>
                    <td>
                      <Badge tone={PRIORITIES[t.priority].tone}>{PRIORITIES[t.priority].label}</Badge>
                    </td>
                    <td>
                      <Badge tone={TICKET_STATUS[t.status].tone} dot={t.status !== "resolvido" && t.status !== "fechado"}>
                        {TICKET_STATUS[t.status].label}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-400">
                      {fmtDT(t.createdAt)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={updateTicketStatus} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={t.id} />
                          <select
                            name="status"
                            defaultValue={t.status}
                            className="field !w-auto !px-2 !py-1 text-xs"
                          >
                            {Object.entries(TICKET_STATUS).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          <button className="btn btn-ghost !px-2 !py-1 text-xs">OK</button>
                        </form>
                        {user.role === "superadmin" && <DeleteTicketBtn id={t.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasFilter && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-600">
              filtros aplicados: {status && `status=${status}`} {prio && `prioridade=${prio}`} {q && `busca="${q}"`}
            </p>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
