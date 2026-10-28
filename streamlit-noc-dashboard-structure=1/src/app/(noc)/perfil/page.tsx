import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtD } from "@/lib/util";
import { Badge, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { ChangePasswordForm } from "@/components/security";

export default async function PerfilPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);
  const me = rows[0];

  const isSuper = user.role === "superadmin";

  const account: [string, ReactNode][] = [
    ["Nome", me?.name ?? user.name],
    ["Usuário de acesso", <span className="font-mono text-xs">{user.username}</span>],
    [
      "E-mail cadastrado",
      me?.email ? (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{me.email}</span>
          <Badge tone="green">verificado no cadastro</Badge>
        </span>
      ) : (
        <span className="text-xs text-warn-300">
          não cadastrado — peça ao administrador
        </span>
      ),
    ],
    [
      "Perfil",
      <Badge tone={isSuper ? "cyan" : "green"}>
        {isSuper ? "Super Admin" : "Técnico"}
      </Badge>,
    ],
    [
      "Membro desde",
      <span className="font-mono text-xs">{fmtD(me?.createdAt ?? null)}</span>,
    ],
  ];

  return (
    <div>
      <PageHead
        kicker="minha conta"
        title="Meu Perfil"
        sub="Dados do seu acesso e troca da própria senha. A redefinição pelo e-mail também pode ser feita na tela de login."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <Panel title="Minha conta" sub="dados cadastrados pelo administrador" hud className="h-full">
            <dl className="space-y-4">
              {account.map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600/30 pb-3 last:border-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {k}
                  </dt>
                  <dd className="text-sm text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-start gap-2.5 rounded-md border border-ink-600/40 bg-ink-800/40 p-3.5 text-xs leading-relaxed text-slate-400">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-signal-300" />
              Seu acesso foi criado pelo super admin com senha inicial. Altere-a
              agora pelo painel ao lado ou use “Esqueci minha senha” na tela de
              login, com o e-mail cadastrado ao lado.
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={80}>
          <Panel
            title="Alterar minha senha"
            sub="confira a senha atual e escolha uma nova"
            className="h-full"
          >
            <ChangePasswordForm />
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
