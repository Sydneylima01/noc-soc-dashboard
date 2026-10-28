"use client";

import Link from "next/link";
import { useEffect, useActionState, useRef, useState } from "react";
import { Icon } from "./ui";
import {
  changeMyPassword,
  doReset,
  requestReset,
  type PwState,
} from "@/app/actions/passwords";
import { updateUserEmail } from "@/app/actions/users";
import type { FormState } from "./forms";

const OK = { ok: null, msg: "" } as PwState;

/* --------------------- esqueci minha senha (login) — 2 etapas --------------------- */
export function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [demoCode, setDemoCode] = useState("");

  const [reqState, reqAction, reqPending] = useActionState(requestReset, OK);
  const [rstState, rstAction, rstPending] = useActionState(doReset, OK);

  useEffect(() => {
    if (stage === 1 && reqState?.ok && reqState.email) {
      setEmail(reqState.email);
      setDemoCode(reqState.demoCode ?? "");
      setStage(2);
    }
  }, [reqState, stage]);

  const start = () => {
    setOpen(true);
    setStage(1);
    setDemoCode("");
    setEmail("");
  };

  return (
    <div className="mt-6 border-t border-ink-600/40 pt-5">
      {!open ? (
        <button
          type="button"
          onClick={start}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400 underline-offset-4 transition-colors hover:text-signal-300 hover:underline"
        >
          Esqueci minha senha
        </button>
      ) : (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-400">
            // redefinição de senha
          </p>
          {stage === 1 ? (
            <form action={reqAction} className="mt-3 space-y-3">
              <div>
                <label className="lbl">E-mail cadastrado pelo administrador</label>
                <input
                  name="email"
                  required
                  type="email"
                  className="field font-mono"
                  placeholder="nome@dtic.gov.br"
                />
              </div>
              <button disabled={reqPending} className="btn btn-ghost w-full">
                <Icon name="mail" className="h-4 w-4" />
                {reqPending ? "Gerando código…" : "Gerar código de redefinição"}
              </button>
              {reqState.msg && (
                <p
                  className={`text-xs font-medium ${
                    reqState.ok === false ? "text-crit-300" : "text-ok-300"
                  }`}
                >
                  {reqState.msg}
                </p>
              )}
            </form>
          ) : (
            <form action={rstAction} className="mt-3 space-y-3">
              <input type="hidden" name="email" value={email} />
              {demoCode && (
                <div className="rounded-md border border-warn-400/40 bg-warn-400/10 p-3 text-xs leading-relaxed text-warn-300">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold">
                    <Icon name="mail" className="h-3.5 w-3.5" />
                    Ambiente de demonstração (sem servidor de e-mail)
                  </p>
                  O código enviado para <span className="font-mono">{email}</span>{" "}
                  é:{" "}
                  <span className="rounded bg-ink-800 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.3em] text-slate-100">
                    {demoCode}
                  </span>
                </div>
              )}
              <div>
                <label className="lbl">Código de 6 dígitos</label>
                <input
                  name="code"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  className="field w-36 font-mono text-center text-lg tracking-[0.4em]"
                  placeholder="••••••"
                />
              </div>
              <div>
                <label className="lbl">Nova senha</label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="field font-mono"
                  placeholder="mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="lbl">Confirmar nova senha</label>
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  className="field font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button disabled={rstPending} className="btn btn-primary flex-1">
                  {rstPending ? "Redefinindo…" : "Redefinir senha"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStage(1);
                    setDemoCode("");
                  }}
                  className="btn btn-ghost"
                >
                  Voltar
                </button>
              </div>
              {rstState.msg && (
                <p
                  className={`text-xs font-medium ${
                    rstState.ok ? "text-ok-300" : "text-crit-300"
                  }`}
                >
                  {rstState.msg}
                  {rstState.ok && (
                    <Link
                      href="/login"
                      className="ml-2 text-signal-300 underline underline-offset-4"
                    >
                      Fazer login
                    </Link>
                  )}
                </p>
              )}
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setStage(1);
              setDemoCode("");
            }}
            className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:text-slate-300"
          >
            × fechar
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------- alterar minha senha (perfil) ------------------------- */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeMyPassword, OK);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <div>
        <label className="lbl">Senha atual</label>
        <input
          name="current"
          type="password"
          required
          className="field font-mono"
          autoComplete="current-password"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl">Nova senha</label>
          <input
            name="next"
            type="password"
            required
            minLength={6}
            className="field font-mono"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="lbl">Confirmar nova senha</label>
          <input
            name="confirm"
            type="password"
            required
            minLength={6}
            className="field font-mono"
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary">
          <Icon name="shield" className="h-4 w-4" />
          {pending ? "Alterando…" : "Alterar minha senha"}
        </button>
        {state.msg && (
          <span
            className={`text-xs font-medium ${
              state.ok ? "text-ok-300" : "text-crit-300"
            }`}
          >
            {state.msg}
          </span>
        )}
      </div>
    </form>
  );
}

/* --------------------------- editar e-mail (config) --------------------------- */
export function EmailEditForm({
  userId,
  current,
}: {
  userId: number;
  current: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateUserEmail,
    { ok: null, msg: "" } as FormState,
  );

  return (
    <div>
      <form action={formAction} className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={userId} />
        <input
          name="email"
          defaultValue={current ?? ""}
          required
          type="email"
          placeholder="usuario@dtic.gov.br"
          className="field !w-56 !py-1.5 font-mono text-xs"
        />
        <button disabled={pending} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
          {pending ? "…" : "Salvar"}
        </button>
      </form>
      {state.msg && (
        <p
          className={`mt-1.5 text-[11px] font-medium ${
            state.ok ? "text-ok-300" : "text-crit-300"
          }`}
        >
          {state.msg}
        </p>
      )}
    </div>
  );
}
