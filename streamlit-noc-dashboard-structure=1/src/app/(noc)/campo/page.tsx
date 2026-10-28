import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  facilities as facilitiesTable,
  fieldReports as fieldReportsTable,
  tickets as ticketsTable,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { timeAgo, fmtDT } from "@/lib/util";
import { Badge, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { DeleteReportBtn, FieldReportForm } from "@/components/campo";

export default async function CampoPage() {
  const user = await requireUser();

  const [reports, fs, openTk] = await Promise.all([
    db
      .select({
        r: fieldReportsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
        ticketCode: ticketsTable.code,
      })
      .from(fieldReportsTable)
      .leftJoin(
        facilitiesTable,
        eq(fieldReportsTable.facilityId, facilitiesTable.id),
      )
      .leftJoin(ticketsTable, eq(fieldReportsTable.ticketId, ticketsTable.id))
      .orderBy(desc(fieldReportsTable.createdAt))
      .limit(40),
    db.select().from(facilitiesTable).orderBy(facilitiesTable.name),
    db
      .select({
        id: ticketsTable.id,
        code: ticketsTable.code,
        title: ticketsTable.title,
      })
      .from(ticketsTable)
      .where(inArray(ticketsTable.status, ["aberto", "andamento"]))
      .orderBy(desc(ticketsTable.createdAt))
      .limit(30),
  ]);

  const withPhoto = reports.filter(({ r }) => r.photoStored).length;

  return (
    <div>
      <PageHead
        kicker="suporte em campo"
        title="Suporte em Campo"
        sub="Fotos e anotações do técnico no local: tire a foto direto do navegador (celular ou PC), escreva a observação e vincule à unidade ou ao chamado."
      >
        <Badge tone="cyan" dot>
          {reports.length} registro{reports.length !== 1 ? "s" : ""} · {withPhoto} com foto
        </Badge>
      </PageHead>

      <div className="grid gap-4 lg:grid-cols-[minmax(360px,440px)_1fr]">
        <Reveal>
          <Panel
            title="Novo registro de campo"
            sub="o técnico autenticado fica como autor do envio"
            hud
            className="h-full"
          >
            <FieldReportForm
              facilities={fs.map((f) => ({ id: f.id, name: f.name, kind: f.kind }))}
              tickets={openTk}
            />
          </Panel>
        </Reveal>

        <Reveal delay={80}>
          <Panel
            title="Últimos registros de campo"
            sub="linha do tempo de fotos e observações da equipe"
            className="h-full overflow-hidden"
          >
            {reports.length === 0 ? (
              <div className="py-10 text-center">
                <Icon name="camera" className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-3 font-mono text-xs text-slate-500">
                  Nenhum registro em campo ainda.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Use o painel ao lado para tirar a primeira foto.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-600/30">
                {reports.map(({ r, facilityName, facilityKind, ticketCode }) => {
                  const canDelete =
                    r.createdById === user.id || user.role === "superadmin";
                  return (
                    <li key={r.id} className="flex gap-3.5 p-4">
                      {r.photoStored ? (
                        <a
                          href={`/api/campo/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver foto em tamanho original"
                          className="block shrink-0 overflow-hidden rounded-md border border-ink-600/50"
                        >
                          <img
                            src={`/api/campo/${r.id}`}
                            alt={`Foto de campo — ${r.createdByName}`}
                            className="h-20 w-28 object-cover transition-transform duration-300 hover:scale-105"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-md border border-ink-600/50 bg-ink-800/40">
                          <Icon name="file" className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {r.notes ? (
                          <p className="line-clamp-2 text-[13px] leading-snug text-slate-200" title={r.notes}>
                            {r.notes}
                          </p>
                        ) : (
                          <p className="text-[13px] italic text-slate-500">
                            Somente foto
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {facilityName && (
                            <Badge tone={facilityKind === "ESCOLA" ? "cyan" : "violet"}>
                              {facilityKind} · {facilityName}
                            </Badge>
                          )}
                          {ticketCode && r.ticketId && (
                            <Link
                              href={`/suporte/${r.ticketId}`}
                              className="font-mono text-[11px] font-semibold text-signal-300 hover:underline"
                            >
                              {ticketCode}
                            </Link>
                          )}
                          <span className="font-mono text-[10.5px] text-slate-500">
                            {r.createdByName} · {fmtDT(r.createdAt)}
                          </span>
                        </div>
                      </div>
                      {canDelete && (
                        <div className="shrink-0 self-start">
                          <DeleteReportBtn id={r.id} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {reports.length > 0 && (
              <p className="border-t border-ink-600/30 px-4 py-2.5 font-mono text-[10px] text-slate-600">
                exibindo os 40 mais recentes · {timeAgo(reports[reports.length - 1].r.createdAt)} no fim da lista
              </p>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
