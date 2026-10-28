import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { logs as logsTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDT } from "@/lib/util";
import { cliBanner } from "@/lib/cli";
import { Badge, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { Cli } from "@/components/cli";

export default async function CliPage() {
  const user = await requireUser();
  if (user.role !== "superadmin") redirect("/dashboard");

  const [banner, history] = await Promise.all([
    cliBanner(user),
    db
      .select()
      .from(logsTable)
      .where(eq(logsTable.action, "CLI"))
      .orderBy(desc(logsTable.createdAt))
      .limit(10),
  ]);

  return (
    <div>
      <PageHead
        kicker="administração avançada"
        title="CLI Admin"
        sub="Console de linha de comando do NOC: consulte e altere usuários, chamados, equipamentos e parâmetros, e gere relatórios — tudo auditado."
      >
        <Badge tone="red" dot>
          super admin
        </Badge>
        <Badge tone="cyan">
          <Icon name="terminal" className="h-3 w-3" /> dtic-cli v2.4
        </Badge>
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1fr_290px]">
        <Reveal>
          <Cli banner={banner} />
        </Reveal>

        <Reveal delay={90} className="space-y-4">
          <Panel title="Comandos principais" sub="referência rápida">
            <ul className="space-y-2 font-mono text-[11px]">
              {[
                ["status", "visão geral do NOC"],
                ["users", "usuários e perfis"],
                ["user passwd <u> <s>", "redefine senha"],
                ["tickets aberto", "fila por status"],
                ["ticket status <c> <s>", "atualiza chamado"],
                ["assets notebook", "notebooks no inventário"],
                ["assets ip | assets link", "endereços e links"],
                ["ip <endereço>", "localiza por IP"],
                ["mac <endereço>", "localiza por MAC"],
                ["units", "ESCOLA / CMEI + contagem"],
                ["logs 20", "auditoria recente"],
                ["report summary 30", "resumo de 30 dias"],
                ["export pdf", "gera relatório"],
              ].map(([c, d]) => (
                <li key={c} className="flex flex-col gap-0.5 border-b border-ink-600/25 pb-1.5 last:border-0">
                  <span className="text-signal-300">{c}</span>
                  <span className="text-[10.5px] text-slate-500">{d}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Últimos comandos" sub="trilha de auditoria da CLI">
            {history.length === 0 ? (
              <p className="py-4 text-center font-mono text-[11px] text-slate-500">
                nenhum comando executado ainda
              </p>
            ) : (
              <ul className="space-y-1.5 font-mono text-[10.5px]">
                {history.map((l) => (
                  <li key={l.id} className="flex gap-2 border-b border-ink-600/20 pb-1.5 last:border-0">
                    <span className="shrink-0 text-slate-600">
                      {l.createdAt.toLocaleTimeString("pt-BR")}
                    </span>
                    <span className="truncate text-slate-300" title={l.details}>
                      {l.details}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Segurança" sub="política da CLI">
            <ul className="space-y-2.5 text-[11px] leading-relaxed text-slate-400">
              <li className="flex gap-2">
                <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok-300" />
                Exclusiva do super administrador — técnicos recebem acesso negado.
              </li>
              <li className="flex gap-2">
                <Icon name="terminal" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn-300" />
                Todo comando é gravado no log de auditoria com autor e horário.
              </li>
              <li className="flex gap-2">
                <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-300" />
                Comandos restritos ao escopo do NOC; nada de shell do sistema.
              </li>
            </ul>
            <p className="mt-3 border-t border-ink-600/30 pt-2.5 font-mono text-[10px] text-slate-600">
              última sessão: {fmtDT(new Date())}
            </p>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
