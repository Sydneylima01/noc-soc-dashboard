import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { logs as logsTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDT, logTone } from "@/lib/util";
import { Badge, EmptyRow, Icon, Panel, PageHead, Reveal } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [
  { v: 0, label: "Todo o histórico" },
  { v: 7, label: "Últimos 7 dias" },
  { v: 30, label: "Últimos 30 dias" },
  { v: 90, label: "Últimos 90 dias" },
];

export default async function LogsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  if (user.role !== "superadmin") redirect("/dashboard");

  const sp = await searchParams;
  const u = String(sp.u ?? "").trim().toLowerCase();
  const a = String(sp.a ?? "").trim().toLowerCase();
  const periodo = Number.isInteger(Number(sp.periodo)) ? Number(sp.periodo) : 0;
  const cutoff = periodo > 0 ? new Date(Date.now() - periodo * 864e5) : null;

  const all = await db.select().from(logsTable).orderBy(desc(logsTable.createdAt)).limit(500);

  const usernames = [...new Set(all.map((l) => l.username))].sort();
  const actions = [...new Set(all.map((l) => l.action))].sort();

  const rows = all.filter((l) => {
    if (u && l.username.toLowerCase() !== u) return false;
    if (a && l.action.toLowerCase() !== a) return false;
    if (cutoff && l.createdAt < cutoff) return false;
    return true;
  });

  return (
    <div>
      <PageHead
        kicker="auditoria"
        title="Logs"
        sub="Trilha completa de eventos do console: acessos, chamados, equipamentos, usuários e configurações."
      />

      <Reveal>
        <Panel
          title="Trilha de eventos"
          sub={`${rows.length} evento${rows.length !== 1 ? "s" : ""} exibido${rows.length !== 1 ? "s" : ""} (máx. 500 do histórico)`}
          className="overflow-hidden"
        >
          <form method="GET" action="/logs" className="mb-4 grid gap-2.5 sm:grid-cols-3">
            <select name="u" className="field" defaultValue={u}>
              <option value="">Todos os usuários</option>
              {usernames.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
            <select name="a" className="field" defaultValue={a}>
              <option value="">Todas as ações</option>
              {actions.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select name="periodo" className="field" defaultValue={periodo}>
                {PERIODS.map((p) => (
                  <option key={p.v} value={p.v}>{p.label}</option>
                ))}
              </select>
              <button className="btn btn-ghost">Filtrar</button>
            </div>
          </form>

          <div className="max-h-[600px] overflow-auto rounded-md border border-ink-600/40 bg-ink-950/85 p-4 font-mono text-[11px]">
            {rows.length === 0 ? (
              <p className="py-8 text-center text-slate-500">
                Nenhum evento encontrado com os filtros atuais.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Data / Hora", "Usuário", "Ação", "Detalhes"].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-left font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-ink-600/25 align-top transition-colors hover:bg-signal-400/[0.04]"
                    >
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{fmtDT(l.createdAt)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-signal-300">{l.username}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        <Badge tone={logTone(l.action)}>{l.action}</Badge>
                      </td>
                      <td className="py-2 text-slate-400">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 border-t border-ink-600/30 pt-3 text-ok-400">
              noc@dtic:~$ tail -f /var/log/dtic/audit.log <span className="caret" />
            </p>
          </div>

          {rows.length === 0 && <EmptyRow cols={1} text="" />}
        </Panel>
      </Reveal>
    </div>
  );
}
