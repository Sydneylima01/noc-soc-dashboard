import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/util";
import { Badge, Icon, Panel, PageHead, Reveal } from "@/components/ui";
import { NewUserForm, SettingsForm, UserActions } from "@/components/forms";
import { EmailEditForm } from "@/components/security";

export default async function ConfigPage() {
  const user = await requireUser();
  if (user.role !== "superadmin") redirect("/dashboard");

  const [users, st] = await Promise.all([
    db.select().from(usersTable).orderBy(asc(usersTable.username)),
    getSettings(),
  ]);

  return (
    <div>
      <PageHead
        kicker="administração"
        title="Configurações"
        sub="Gestão de acessos (super admin e técnicos) e parâmetros gerais do NOC DTIC/SUPORTE."
      />

      <Reveal>
        <Panel
          title="Usuários & perfis"
          sub="técnicos acessam suporte, serviços, equipamentos e relatórios · super admin tem acesso total"
          className="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="tbl min-w-[920px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuário</th>
                  <th>E-mail cadastrado</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap font-medium text-slate-200">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-600/50 bg-ink-800 font-display text-xs font-bold text-signal-300">
                          {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                        {u.name}
                        {u.id === user.id && (
                          <span className="font-mono text-[10px] text-slate-500">(você)</span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-300">{u.username}</td>
                    <td>
                      <EmailEditForm userId={u.id} current={u.email} />
                    </td>
                    <td>
                      <Badge tone={u.role === "superadmin" ? "cyan" : "green"}>
                        {u.role === "superadmin" ? "Super Admin" : "Técnico"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={u.active ? "green" : "red"} dot={u.active}>
                        {u.active ? "Ativo" : "Desativado"}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <UserActions
                          id={u.id}
                          active={u.active}
                          username={u.username}
                          self={u.id === user.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 border-t border-ink-600/40 pt-5">
            <p className="mb-4 flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              <Icon name="plus" className="h-3.5 w-3.5 text-signal-300" />
              Criar novo acesso
            </p>
            <NewUserForm />
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={80} className="mt-4">
        <Panel
          title="Parâmetros do NOC"
          sub="identidade do console, contato do suporte e regras dos chamados"
        >
          <SettingsForm
            initial={{
              orgName: st.orgName,
              supportEmail: st.supportEmail,
              supportPhone: st.supportPhone,
              workHours: st.workHours,
              codePrefix: st.codePrefix,
              networkUptime: st.networkUptime,
            }}
          />
        </Panel>
      </Reveal>

      <Reveal delay={140} className="mt-4">
        <Panel title="Segurança & sessão" sub="políticas vigentes do console">
          <ul className="grid gap-3 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            <li className="flex items-start gap-2.5">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-ok-300" />
              Senhas armazenadas com hash <span className="font-mono text-slate-300">scrypt</span> + sal individual.
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-signal-300" />
              Sessões web com cookie <span className="font-mono text-slate-300">httpOnly</span> e validade de 12 horas.
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-lav-300" />
              Login por usuário ou e-mail; redefinição de senha pelo e-mail cadastrado (código de 6 dígitos, 15 min).
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="terminal" className="mt-0.5 h-4 w-4 shrink-0 text-warn-300" />
              Toda operação relevante é gravada nos logs de auditoria, incluindo falhas de login e trocas de senha.
            </li>
          </ul>
        </Panel>
      </Reveal>
    </div>
  );
}
