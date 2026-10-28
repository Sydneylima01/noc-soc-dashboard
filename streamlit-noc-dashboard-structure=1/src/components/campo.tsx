"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./ui";
import { ConfirmBtn } from "./forms";
import { deleteFieldReport } from "@/app/actions/campo";

type Facility = { id: number; name: string; kind: string };
type TicketOpt = { id: number; code: string; title: string };

function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

export function FieldReportForm({
  facilities,
  tickets,
}: {
  facilities: Facility[];
  tickets: TicketOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const objUrlRef = useRef("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<"off" | "starting" | "on" | "error">("off");
  const [camErr, setCamErr] = useState("");

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    },
    [],
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam("off");
  };

  const startCamera = async () => {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr(
        "Este navegador não expõe a câmera. Use “Escolher da galeria” para anexar a foto.",
      );
      setCam("error");
      return;
    }
    setCam("starting");
    setCamErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCam("on");
    } catch {
      setCamErr(
        "Não foi possível acessar a câmera (permissão negada ou sem dispositivo). Use a galeria.",
      );
      setCam("error");
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = "";
    }
    setFile(
      dataUrlToFile(
        dataUrl,
        `campo-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.jpg`,
      ),
    );
    setPreview(dataUrl);
    stopCamera();
    setMsg(null);
  };

  const onGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Selecione um arquivo de imagem." });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setMsg({ ok: false, text: "Imagem muito grande (máximo 10 MB)." });
      return;
    }
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    objUrlRef.current = URL.createObjectURL(f);
    setFile(f);
    setPreview(objUrlRef.current);
    setMsg(null);
  };

  const clearPhoto = () => {
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    objUrlRef.current = "";
    setFile(null);
    setPreview(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (file) fd.append("photo", file);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/campo", { method: "POST", body: fd });
      const json = await res.json();
      setMsg({ ok: !!json.ok, text: String(json.msg ?? "") });
      if (json.ok) {
        clearPhoto();
        form.reset();
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Falha no envio. Verifique a conexão." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* ------------------------------ área da foto ------------------------------ */}
      <div className="overflow-hidden rounded-md border border-ink-600/50 bg-ink-950/60">
        {preview ? (
          <div>
            <img
              src={preview}
              alt="Prévia da foto de campo"
              className="max-h-72 w-full bg-black/40 object-contain"
            />
            <div className="flex flex-wrap gap-2 border-t border-ink-600/40 p-3">
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-ghost !py-2 text-xs"
              >
                <Icon name="camera" className="h-3.5 w-3.5" />
                Tirar outra
              </button>
              <button
                type="button"
                onClick={clearPhoto}
                className="btn btn-danger !py-2 text-xs"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
                Remover foto
              </button>
            </div>
          </div>
        ) : cam === "on" || cam === "starting" ? (
          <div>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-64 w-full bg-black object-cover sm:h-80"
            />
            <div className="flex items-center justify-between gap-2 border-t border-ink-600/40 p-3">
              <button
                type="button"
                onClick={stopCamera}
                className="btn btn-ghost !py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capture}
                disabled={cam !== "on"}
                className="btn btn-primary !rounded-full !px-6 !py-2.5"
              >
                <Icon name="camera" className="h-4 w-4" />
                {cam === "starting" ? "Preparando…" : "Capturar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Foto do local · do equipamento · da etiqueta
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-primary"
              >
                <Icon name="camera" className="h-4 w-4" />
                Tirar foto
              </button>
              <label className="btn btn-ghost cursor-pointer">
                <Icon name="upload" className="h-4 w-4" />
                Escolher da galeria
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onGallery}
                />
              </label>
            </div>
            {cam === "error" && (
              <p className="text-xs leading-relaxed text-crit-300">{camErr}</p>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------ campos ------------------------------ */}
      <div>
        <label className="lbl">Observações / descrição do serviço *</label>
        <textarea
          name="notes"
          rows={3}
          className="field resize-y"
          placeholder="Descreva o que foi feito, o estado do equipamento, pendências, peças utilizadas…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl">Unidade (ESCOLA / CMEI)</label>
          <select name="facilityId" className="field" defaultValue="">
            <option value="">— Não vincular —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kind} · {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Chamado vinculado</label>
          <select name="ticketId" className="field" defaultValue="">
            <option value="">— Não vincular —</option>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.title.slice(0, 42)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          <Icon name="check" className="h-4 w-4" />
          {busy ? "Enviando…" : "Registrar em campo"}
        </button>
        {msg && (
          <span
            className={`text-xs font-medium ${msg.ok ? "text-ok-300" : "text-crit-300"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        É obrigatório anotar a observação ou anexar a foto. O registro fica
        associado ao técnico que enviou e entra nos logs de auditoria.
      </p>
    </form>
  );
}

export function DeleteReportBtn({ id }: { id: number }) {
  return (
    <ConfirmBtn
      label="Remover"
      confirmMsg="Remover este relatório de campo? A ação será registrada nos logs."
      onConfirm={() => deleteFieldReport(id)}
    />
  );
}
