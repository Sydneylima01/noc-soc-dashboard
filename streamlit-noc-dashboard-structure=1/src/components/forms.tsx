"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./ui";
import {
  ASSET_KINDS,
  ASSET_STATUS,
  CATEGORIES,
  PRIORITIES,
  TICKET_STATUS,
} from "@/lib/meta";
import {
  createTicket,
  deleteTicket as deleteTicketAction,
} from "@/app/actions/tickets";
import {
  deleteAsset as deleteAssetAction,
  upsertAsset,
} from "@/app/actions/assets";
import {
  createUser,
  resetPassword as resetPasswordAction,
  toggleUserActive,
} from "@/app/actions/users";
import { saveSettings } from "@/app/actions/settings";
import { deleteUpload } from "@/app/actions/uploads";

export type FormState = { ok: boolean | null; msg: string };

const OK = { ok: null, msg: "" } as FormState;

function Msg({ state }: { state: FormState }) {
  if (!state.msg) return null;
  return (
    <span className={`text-xs font-medium ${state.ok ? "text-ok-300" : "text-crit-300"}`}>
      {state.msg}
    </span>
  );
}

/* ------------------------------- NOVO CHAMADO ------------------------------- */
export function NewTicketForm({
  facilities,
  assets,
}: {
  facilities: { id: number; name: string; kind: string }[];
  assets: { id: number; name: string; kind: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTicket, OK);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="lbl">Título do chamado *</label>
        <input
          name="title"
          required
          className="field"
          placeholder="Ex.: Impressora da secretaria não imprime"
        />
      </div>
      <div>
        <label className="lbl">Solicitante *</label>
        <input name="requester" required className="field" placeholder="Nome / função" />
      </div>
      <div>
        <label className="lbl">Contato</label>
        <input name="contact" className="field" placeholder="e-mail ou telefone" />
      </div>
      <div>
        <label className="lbl">Unidade (ESCOLA / CMEI)</label>
        <select name="facilityId" className="field" defaultValue="">
          <option value="">— Selecione —</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.kind} · {f.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Equipamento vinculado</label>
        <select name="assetId" className="field" defaultValue="">
          <option value="">— Nenhum —</option>
          {Object.entries(ASSET_KINDS).map(([k, v]) => (
            <optgroup key={k} label={v.plural}>
              {assets
                .filter((a) => a.kind === k)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Categoria</label>
        <select name="category" className="field" defaultValue="Impressora">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Prioridade</label>
        <select name="priority" className="field" defaultValue="media">
          {Object.entries(PRIORITIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="lbl">Descrição do problema</label>
        <textarea
          name="description"
          rows={3}
          className="field resize-y"
          placeholder="Detalhe o que está acontecendo, onde e desde quando…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={pending} className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {pending ? "Abrindo…" : "Abrir chamado"}
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}

/* ------------------------------- EQUIPAMENTO ------------------------------- */
export type AssetInitial = {
  id: number;
  kind: string;
  name: string;
  ip: string;
  mac: string;
  provider: string;
  bandwidth: string;
  linkUrl: string;
  facilityId: number | null;
  room: string;
  status: string;
  notes: string;
} | null;

export function AssetForm({
  initial,
  defaultKind,
  facilities,
}: {
  initial: AssetInitial;
  defaultKind: string;
  facilities: { id: number; name: string; kind: string }[];
}) {
  const [state, formAction, pending] = useActionState(upsertAsset, OK);
  const editing = !!initial?.id;
  const [kind, setKind] = useState(initial?.kind ?? defaultKind);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && !editing) {
      router.push(`/ativos?tipo=${encodeURIComponent(kind)}&salvo=1`);
      router.refresh();
    }
  }, [state, editing, kind, router]);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      {editing && <input type="hidden" name="kind" value={kind} />}
      <div>
        <label className="lbl" htmlFor="asset-kind">Tipo</label>
        <select
          id="asset-kind"
          name={editing ? undefined : "kind"}
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={editing}
        >
          {Object.entries(ASSET_KINDS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="asset-name">Identificação *</label>
        <input
          id="asset-name"
          name="name"
          required
          maxLength={200}
          className="field font-mono"
          placeholder={kind === "notebook" ? "NB-SECRETARIA-01" : kind === "ip" ? "IP da secretaria" : kind === "link" ? "Link principal da unidade" : "IMP-DPI-SEC"}
          defaultValue={initial?.name ?? ""}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="asset-ip">Endereço IP {kind === "ip" ? "*" : "(opcional)"}</label>
        <input
          id="asset-ip"
          name="ip"
          required={kind === "ip"}
          className="field font-mono"
          placeholder="10.10.1.21 ou 2001:db8::1"
          defaultValue={initial?.ip ?? ""}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="asset-mac">Endereço MAC (opcional)</label>
        <input
          id="asset-mac"
          name="mac"
          className="field font-mono"
          placeholder="00:1B:44:12:0B:31"
          defaultValue={initial?.mac ?? ""}
        />
      </div>
      {kind === "link" && (
        <>
          <div>
            <label className="lbl" htmlFor="asset-provider">Provedor / operadora</label>
            <input id="asset-provider" name="provider" maxLength={200} className="field" placeholder="Nome do provedor" defaultValue={initial?.provider ?? ""} />
          </div>
          <div>
            <label className="lbl" htmlFor="asset-bandwidth">Velocidade contratada</label>
            <input id="asset-bandwidth" name="bandwidth" maxLength={100} className="field" placeholder="Ex.: 300 Mbps" defaultValue={initial?.bandwidth ?? ""} />
          </div>
          <div className="md:col-span-2">
            <label className="lbl" htmlFor="asset-link">URL de acesso (opcional)</label>
            <input id="asset-link" name="linkUrl" type="url" maxLength={2048} className="field font-mono" placeholder="https://exemplo.com.br" defaultValue={initial?.linkUrl ?? ""} />
            <p className="mt-1 text-[11px] text-slate-500">Para enlaces sem página web, deixe a URL em branco.</p>
          </div>
        </>
      )}
      <div>
        <label className="lbl" htmlFor="asset-facility">Unidade (ESCOLA / CMEI)</label>
        <select id="asset-facility" name="facilityId" className="field" defaultValue={initial?.facilityId ?? ""}>
          <option value="">— Selecione —</option>
          {(["ESCOLA", "CMEI"] as const).map((group) => (
            <optgroup key={group} label={group === "ESCOLA" ? "Escolas" : "CMEIs"}>
              {facilities.filter((f) => f.kind === group).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="asset-room">Sala / Local</label>
        <input id="asset-room" name="room" maxLength={200} className="field" placeholder="Secretaria, Laboratório…" defaultValue={initial?.room ?? ""} />
      </div>
      <div>
        <label className="lbl" htmlFor="asset-status">Status</label>
        <select id="asset-status" name="status" className="field" defaultValue={initial?.status ?? "ativo"}>
          {Object.entries(ASSET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="lbl" htmlFor="asset-notes">Observações</label>
        <textarea id="asset-notes" name="notes" rows={2} maxLength={4000} className="field resize-y" defaultValue={initial?.notes ?? ""} />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={pending} className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar registro"}
        </button>
        <Link href={`/ativos?tipo=${encodeURIComponent(defaultKind)}`} className="btn btn-ghost">Cancelar</Link>
        <Msg state={state} />
      </div>
    </form>
  );
}

/* --------------------------------- EXCLUIR --------------------------------- */
export function ConfirmBtn({
  label,
  confirmMsg,
  onConfirm,
  className = "btn btn-danger !px-2.5 !py-1.5 text-xs",
}: {
  label: string;
  confirmMsg: string;
  onConfirm: () => Promise<unknown>;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(confirmMsg)) return;
        setBusy(true);
        try {
          await onConfirm();
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={className}
    >
      {label}
    </button>
  );
}

export function DeleteTicketBtn({ id }: { id: number }) {
  return (
    <ConfirmBtn
      label="Excluir"
      confirmMsg="Excluir este chamado? A ação será registrada nos logs."
      onConfirm={() => deleteTicketAction(id)}
    />
  );
}

export function DeleteAssetBtn({ id }: { id: number }) {
  return (
    <ConfirmBtn
      label="Excluir"
      confirmMsg="Excluir este equipamento do inventário? A ação será registrada nos logs."
      onConfirm={() => deleteAssetAction(id)}
    />
  );
}

export function RemoveUploadBtn({ id }: { id: number }) {
  return (
    <ConfirmBtn
      label="Remover"
      confirmMsg="Remover este relatório da base de documentos? A ação será registrada nos logs."
      onConfirm={() => deleteUpload(id)}
    />
  );
}

/* --------------------------------- UPLOAD --------------------------------- */
export function FileUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      setMsg({ ok: !!json.ok, text: String(json.msg ?? "") });
      if (json.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Falha no envio. Verifique a conexão e tente novamente." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border border-dashed border-ink-400/70 bg-ink-800/30 p-5 text-center">
      <input
        ref={inputRef}
        id="dtic-file-upload"
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.doc,.docx,.csv"
        onChange={onFiles}
        className="hidden"
      />
      <label
        htmlFor="dtic-file-upload"
        className="btn btn-ghost inline-flex w-full cursor-pointer"
      >
        <Icon name="upload" className="h-4 w-4" />
        {busy ? "Enviando arquivos…" : "Selecionar relatórios para envio"}
      </label>
      <p className="mt-2.5 font-mono text-[10px] text-slate-500">
        PDF · Excel (.xlsx / .xls) · Word (.doc / .docx) · CSV — até 10 MB por arquivo
      </p>
      {msg && (
        <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-ok-300" : "text-crit-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/* --------------------------------- USUÁRIOS --------------------------------- */
export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUser, OK);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="lbl">Nome completo *</label>
        <input name="name" required className="field" placeholder="Maria Silva" />
      </div>
      <div>
        <label className="lbl">Usuário *</label>
        <input
          name="username"
          required
          className="field font-mono"
          placeholder="maria"
        />
      </div>
      <div>
        <label className="lbl">E-mail corporativo *</label>
        <input
          name="email"
          required
          type="email"
          className="field font-mono"
          placeholder="maria@dtic.gov.br"
        />
      </div>
      <div>
        <label className="lbl">Senha inicial *</label>
        <input
          name="password"
          required
          minLength={6}
          className="field font-mono"
          placeholder="mín. 6 caracteres"
        />
      </div>
      <div>
        <label className="lbl">Perfil</label>
        <select name="role" className="field" defaultValue="tecnico">
          <option value="tecnico">Técnico</option>
          <option value="superadmin">Super Admin</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-5">
        <button disabled={pending} className="btn btn-primary">
          <Icon name="user" className="h-4 w-4" />
          {pending ? "Criando…" : "Criar acesso"}
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function UserActions({
  id,
  active,
  username,
  self,
}: {
  id: number;
  active: boolean;
  username: string;
  self: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, resetAction, resetPending] = useActionState(resetPasswordAction, OK);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={self || busy}
        title={self ? "Você não pode desativar o próprio acesso" : undefined}
        onClick={async () => {
          setBusy(true);
          try {
            await toggleUserActive(id);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className={`btn ${active ? "btn-ghost" : "btn-primary"} !px-2.5 !py-1.5 text-xs`}
      >
        {active ? "Desativar" : "Reativar"}
      </button>
      <form action={resetAction} className="flex items-center gap-1.5">
        <input
          type="hidden"
          name="id"
          value={id}
        />
        <input
          name="password"
          required
          minLength={6}
          placeholder={`senha nova de ${username}`}
          className="field !w-44 !py-1.5 font-mono text-xs"
        />
        <button disabled={resetPending} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
          Redefinir
        </button>
      </form>
      <Msg state={state} />
    </div>
  );
}

/* ------------------------------- PARÂMETROS NOC ------------------------------- */
export function SettingsForm({
  initial,
}: {
  initial: {
    orgName: string;
    supportEmail: string;
    supportPhone: string;
    workHours: string;
    codePrefix: string;
    networkUptime: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveSettings, OK);
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-3">
        <label className="lbl">Nome do órgão</label>
        <input name="orgName" className="field" defaultValue={initial.orgName} />
      </div>
      <div>
        <label className="lbl">E-mail do suporte</label>
        <input name="supportEmail" className="field font-mono" defaultValue={initial.supportEmail} />
      </div>
      <div>
        <label className="lbl">Telefone / ramal</label>
        <input name="supportPhone" className="field font-mono" defaultValue={initial.supportPhone} />
      </div>
      <div>
        <label className="lbl">Horário de atendimento</label>
        <input name="workHours" className="field" defaultValue={initial.workHours} />
      </div>
      <div>
        <label className="lbl">Prefixo dos chamados</label>
        <input name="codePrefix" className="field font-mono" defaultValue={initial.codePrefix} />
      </div>
      <div>
        <label className="lbl">Uptime da rede (%)</label>
        <input name="networkUptime" className="field font-mono" defaultValue={initial.networkUptime} />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <button disabled={pending} className="btn btn-primary">
          <Icon name="check" className="h-4 w-4" />
          {pending ? "Salvando…" : "Salvar parâmetros"}
        </button>
        <Msg state={state} />
      </div>
    </form>
  );
}

/* --------------------------------- DOWNLOADS --------------------------------- */
function toCsv(head: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return (
    "\uFEFF" +
    [head, ...rows].map((r) => r.map(esc).join(";")).join("\n")
  );
}

export function DownloadCsv({
  filename,
  head,
  rows,
  label = "Exportar CSV",
}: {
  filename: string;
  head: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  return (
    <button
      onClick={() => {
        const blob = new Blob([toCsv(head, rows)], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 400);
      }}
      className="btn btn-ghost no-print !px-3 !py-2 text-xs"
    >
      <Icon name="download" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-ghost no-print !px-3 !py-2 text-xs"
    >
      <Icon name="print" className="h-3.5 w-3.5" />
      Imprimir
    </button>
  );
}

/* reusado nas telas para exibir selos consistentes (client-safe) */
export function StatusPill({ status }: { status: string }) {
  const meta = TICKET_STATUS[status] ?? TICKET_STATUS.aberto;
  const tone: Record<string, string> = {
    slate: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    cyan: "border-signal-400/40 bg-signal-400/10 text-signal-300",
    green: "border-ok-400/40 bg-ok-400/10 text-ok-300",
    amber: "border-warn-400/40 bg-warn-400/10 text-warn-300",
    red: "border-crit-400/40 bg-crit-400/10 text-crit-300",
    violet: "border-lav-400/40 bg-lav-400/10 text-lav-300",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${tone[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}
