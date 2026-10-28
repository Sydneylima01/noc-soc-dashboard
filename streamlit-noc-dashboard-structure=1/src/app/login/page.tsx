import Link from "next/link";
import { ensureSeed } from "@/lib/seed";
import { getSettings } from "@/lib/util";
import { loginAction } from "@/app/actions/auth";
import { Badge, Icon } from "@/components/ui";
import { ForgotPassword } from "@/components/security";
import { LogoMark } from "@/components/shell";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  await ensureSeed();
  const sp = await searchParams;
  const demo = String(sp.demo ?? "");
  const u = demo === "admin" ? "admin" : demo === "tec" ? "carla" : "";
  const p = demo === "admin" ? "dtic2024" : demo === "tec" ? "tec2024" : "";
  const erro = sp.erro === "1";
  const st = await getSettings();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* ------------------------------ painel de identidade ------------------------------ */}
      <div className="scanlines relative hidden flex-col justify-between overflow-hidden border-r border-ink-600/40 p-10 lg:flex">
        <div className="scan-beam" />

        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="font-display text-lg font-bold tracking-wider text-slate-50">
              DTIC<span className="text-signal-400">/</span>SUPORTE
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Network Operations Center
            </p>
          </div>
        </div>

        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal-400">
            // central de operações de rede
          </p>
          <h1 className="mt-3 max-w-xl font-display text-5xl font-bold uppercase leading-[1.02] tracking-wide text-slate-50">
            Monitoramento,
            <br />
            suporte e serviços
            <br />
            <span className="text-signal-400">para escolas & CMEIs</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            {st.orgName}. Inventário de impressoras, mesinhas digitais e
            computadores com IP e MAC, chamados de suporte, relatórios e trilha
            de auditoria em um único console.
          </p>

          <div className="mt-8 flex items-center gap-8">
            <div className="radar h-36 w-36 shrink-0">
              <div className="radar-sweep" />
              <span className="radar-blip" style={{ top: "28%", left: "58%" }} />
              <span
                className="radar-blip"
                style={{ top: "62%", left: "30%", background: "#22d3ee", boxShadow: "0 0 8px rgba(34,211,238,.9)" }}
              />
              <span
                className="radar-blip"
                style={{ top: "50%", left: "70%", background: "#fbbf24", boxShadow: "0 0 8px rgba(251,191,36,.9)" }}
              />
            </div>
            <ul className="space-y-2.5 font-mono text-[11px] tracking-wide">
              {[
                { c: "bg-ok-400", t: "REDE MUNICIPAL — OPERACIONAL" },
                { c: "bg-signal-400", t: "6 UNIDADES MONITORADAS (ESCOLA/CMEI)" },
                { c: "bg-ok-400", t: "3 TÉCNICOS EM PLANTÃO" },
                { c: "bg-warn-400", t: "2 CHAMADOS DE ALTA PRIORIDADE" },
              ].map((l, i) => (
                <li key={i} className="flex items-center gap-2.5 text-slate-400">
                  <span className={`dot-live h-1.5 w-1.5 rounded-full ${l.c}`} />
                  {l.t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative rounded-lg border border-ink-600/40 bg-ink-950/80 p-4 font-mono text-[11px] leading-relaxed">
          <p className="text-slate-500">
            <span className="text-ok-400">noc@dtic</span>:<span className="text-signal-300">~</span>$ status --all
          </p>
          <p className="text-slate-400">
            [ OK ] enlace principal <span className="text-ok-300">up</span> · uptime {st.networkUptime}%
          </p>
          <p className="text-slate-400">
            [ OK ] dns / dhcp <span className="text-ok-300">resolvendo</span> · [ !! ] 1 equipamento em defeito
          </p>
          <p className="text-slate-400">
            noc@dtic:~$ <span className="caret" />
          </p>
        </div>
      </div>

      {/* --------------------------------- formulário --------------------------------- */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="font-display text-lg font-bold tracking-wider text-slate-50">
                DTIC<span className="text-signal-400">/</span>SUPORTE
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Network Operations Center
              </p>
            </div>
          </div>

          <div className="panel hud p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal-400">
              // acesso restrito
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-slate-50">
              Entrar no console
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Acesso via web com credencial individual. Todas as ações ficam
              registradas nos logs de auditoria.
            </p>

            {erro && (
              <div className="mt-4 flex items-start gap-2.5 rounded-md border border-crit-400/40 bg-crit-400/10 p-3 text-xs text-crit-300">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                Credenciais inválidas ou acesso desativado. Tente novamente.
              </div>
            )}

            <form action={loginAction} className="mt-6 space-y-4">
              <div>
                <label className="lbl" htmlFor="username">
                  Usuário ou e-mail
                </label>
                <input
                  id="username"
                  name="username"
                  required
                  autoComplete="username"
                  className="field font-mono"
                  placeholder="admin ou admin@dtic.gov.br"
                  defaultValue={u}
                />
              </div>
              <div>
                <label className="lbl" htmlFor="password">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="field font-mono"
                  placeholder="••••••••"
                  defaultValue={p}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full !py-3 text-sm">
                <Icon name="shield" className="h-4 w-4" />
                Autenticar
              </button>
            </form>

            <ForgotPassword />

            <div className="mt-6 border-t border-ink-600/40 pt-5">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Perfis de demonstração
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login?demo=admin"
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                >
                  <Icon name="shield" className="h-3.5 w-3.5 text-signal-300" />
                  Super Admin · admin
                </Link>
                <Link href="/login?demo=tec" className="btn btn-ghost !px-3 !py-2 text-xs">
                  <Icon name="wrench" className="h-3.5 w-3.5 text-ok-300" />
                  Técnico · carla
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Icon name="mail" className="h-3.5 w-3.5" />
              {st.supportEmail} · {st.supportPhone}
            </span>
            <Badge tone="cyan">Atendimento: {st.workHours}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
