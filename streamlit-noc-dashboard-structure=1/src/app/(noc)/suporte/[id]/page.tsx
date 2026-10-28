import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  logs as logsTable,
  tickets as ticketsTable,
  users as usersTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  fmtDT,
  PRIORITIES,
  resolutionLabel,
  TICKET_STATUS,
} from "@/lib/util";
import { updateTicketStatus } from "@/app/actions/tickets";
import { Badge, Icon, Panel, Reveal } from "@/components/ui";
import { DeleteTicketBtn } from "@/components/forms";

type SP = Promise<{ id: string }>;

export default async function TicketDetailPage({
  params,
}: {
  params: SP;
}) {
  const user = await requireUser();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) notFound();

  const rows = await db
    .select({
      t: ticketsTable,
      facilityName: facilitiesTable.name,
      facilityKind: facilitiesTable.kind,
      asset: assetsTable,
      creator: usersTable.name,
    })
    .from(ticketsTable)
    .leftJoin(facilitiesTable, eq(ticketsTable.facilityId, facilitiesTable.id))
    .leftJoin(assetsTable, eq(ticketsTable.assetId, assetsTable.id))
    .leftJoin(usersTable, eq(ticketsTable.createdById, usersTable.id))
    .where(eq(ticketsTable.id, tid))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();
  const t = row.t;

  const timeline = await db
    .select()
    .from(logsTable)
    .where(like(logsTable.details, `%${t.code}%`))
    .orderBy(asc(logsTable.createdAt))
    .limit(30);

  const metas: [string, ReactNode][] = [
    ["Solicitante", t.requester],
    ["Contato", t.contact || "—"],
    [
      "Unidade",
      row.facilityName ? (
        <span className="flex items-center gap-2">
          <Badge tone={row.facilityKind === "ESCOLA" ? "cyan" : "violet"}>
            {row.facilityKind}
          </Badge>
          {row.facilityName}
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Equipamento vinculado",
      row.asset ? (
        <span className="font-mono text-xs text-slate-200">
          {row.asset.name} · {row.asset.ip || "sem IP"} · {row.asset.mac || "sem MAC"}
        </span>
      ) : (
        "—"
      ),
    ],
    ["Categoria", t.category],
    ["Criado por", row.creator ?? "—"],
    ["Aberto em", <span className="font-mono text-xs">{fmtDT(t.createdAt)}</span>],
    [
      "Resolvido em",
      <span className="font-mono text-xs">
        {t.resolvedAt ? fmtDT(t.resolvedAt) : "—"}
        {t.resolvedAt ? (
          <span className="ml-2 text-ok-300">
            ({resolutionLabel(t.createdAt, t.resolvedAt)})
          </span>
        ) : null}
      </span>,
    ],
  ];

  return (
    <div>
      <Link
        href="/suporte"
        className="mb-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-signal-300"
      >
        <Icon name="back" className="h-3.5 w-3.5" />
        Voltar para a fila
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal-400">
            // chamado
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-slate-50 sm:text-3xl">
            {t.code}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-300">{t.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITIES[t.priority].tone} className="!text-xs">
            Prioridade {PRIORITIES[t.priority].label}
          </Badge>
          <Badge tone={TICKET_STATUS[t.status].tone} dot className="!text-xs">
            {TICKET_STATUS[t.status].label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Panel title="Dados do chamado" hud className="h-full">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {metas.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Descrição
                </dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md border border-ink-600/40 bg-ink-950/70 p-3.5 text-sm leading-relaxed text-slate-300">
                  {t.description || "Sem descrição registrada."}
                </dd>
              </div>
            </dl>
          </Panel>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={80}>
            <Panel title="Atualizar status">
              <form action={updateTicketStatus} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <label className="lbl">Novo status</label>
                <select name="status" defaultValue={t.status} className="field">
                  {Object.entries(TICKET_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <button className="btn btn-primary flex-1">
                    <Icon name="check" className="h-4 w-4" />
                    Aplicar
                  </button>
                  {user.role === "superadmin" && <DeleteTicketBtn id={t.id} />}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Marcar como resolvido ou fechado registra a data de
                  resolução automaticamente.
                </p>
              </form>
            </Panel>
          </Reveal>

          <Reveal delay={140}>
            <Panel title="Linha do tempo" sub={`eventos de ${t.code} nos logs`}>
              {timeline.length === 0 ? (
                <p className="py-4 text-center font-mono text-xs text-slate-500">
                  Sem eventos registrados ainda.
                </p>
              ) : (
                <ol className="relative ml-2 space-y-4 border-l border-ink-600/50 pl-5">
                  {timeline.map((l) => (
                    <li key={l.id} className="relative">
                      <span className="dot-live absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border border-ink-950 bg-signal-400" />
                      <p className="font-mono text-[10px] text-slate-500">
                        {fmtDT(l.createdAt)} · {l.username}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-200">{l.action}</p>
                      <p className="text-[11px] text-slate-400">{l.details}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
