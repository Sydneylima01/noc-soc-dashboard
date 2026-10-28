"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import type { CliLine, CliTone } from "@/lib/cli";

type Entry = { id: number; kind: "cmd" | "out" | "link"; text: string; tone?: CliTone; href?: string };

const TONE_CLS: Record<CliTone, string> = {
  ok: "text-ok-300",
  err: "text-crit-300",
  warn: "text-warn-300",
  info: "text-signal-300",
  dim: "text-slate-500",
  accent: "text-lav-300 font-semibold",
  text: "text-slate-200",
};

const COMPLETIONS = [
  "help", "status", "uptime", "whoami", "date",
  "users", "user list", "user add", "user passwd", "user email", "user disable", "user enable",
  "tickets", "tickets aberto", "tickets andamento", "ticket show", "ticket status",
  "assets", "assets impressora", "assets mesinha", "assets computador", "assets notebook", "assets ip", "assets link",
  "asset show", "asset status", "ip", "mac", "units", "logs",
  "report summary", "export pdf", "export xlsx", "export doc",
  "search", "settings", "theme dark", "theme light", "clear",
];

const QUICK = [
  "help",
  "status",
  "users",
  "tickets aberto",
  "tickets andamento",
  "units",
  "assets impr...",
  "logs 10",
  "export pdf",
];

export function Cli({ banner }: { banner: CliLine[] }) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    banner.map((l, i) => ({ id: i, kind: "out" as const, text: l.text, tone: l.tone })),
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [startedAt] = useState(() => Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(banner.length + 1);
  const nextId = () => ++idRef.current;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dtic-cli-history");
      if (saved) setHistory(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, busy]);

  const push = useCallback((items: Entry[]) => {
    setEntries((prev) => [...prev, ...items]);
  }, []);

  const applyTheme = (t: "light" | "dark") => {
    document.documentElement.classList.toggle("light", t === "light");
    try {
      localStorage.setItem("dtic-theme", t);
    } catch {
      /* ignore */
    }
  };

  const execute = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd || busy) return;

    setHistIdx(-1);
    setHistory((h) => {
      const next = [...h.filter((x) => x !== cmd), cmd].slice(-60);
      try {
        localStorage.setItem("dtic-cli-history", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

    push([{ id: nextId(), kind: "cmd", text: cmd }]);
    setValue("");

    if (cmd === "clear") {
      setEntries([]);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        lines?: CliLine[];
        clear?: boolean;
        theme?: "light" | "dark";
        link?: { label: string; href: string }[];
      };

      if (data.clear) {
        setEntries([]);
      } else {
        const out: Entry[] = (data.lines ?? []).map((l) => ({
          id: nextId(),
          kind: "out" as const,
          text: l.text,
          tone: l.tone,
        }));
        (data.link ?? []).forEach((l) =>
          out.push({ id: nextId(), kind: "link", text: l.label, href: l.href }),
        );
        if (!out.length) {
          out.push({ id: nextId(), kind: "out", text: "(sem saída)", tone: "dim" });
        }
        push(out);
      }
      if (data.theme) applyTheme(data.theme);
    } catch {
      push([
        { id: nextId(), kind: "out", text: "falha de comunicação com o servidor", tone: "err" },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const complete = () => {
    const v = value.trimStart();
    if (!v) {
      setValue("help");
      return;
    }
    const match = COMPLETIONS.find((c) => c.startsWith(v) && c !== v);
    if (match) setValue(match);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void execute(value);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      complete();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setValue(history[idx] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(-1);
        setValue("");
      } else {
        setHistIdx(idx);
        setValue(history[idx] ?? "");
      }
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);

  return (
    <div className="panel hud overflow-hidden">
      {/* barra da janela */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-600/50 bg-ink-800/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-crit-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok-400/80" />
        </span>
        <p className="ml-2 font-mono text-[11px] text-slate-400">
          dtic-cli — admin@noc — bash
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-slate-500 sm:inline">
            sessão {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </span>
          <button
            onClick={() => setEntries([])}
            className="btn btn-ghost !px-2 !py-1 text-[10px]"
            title="Limpar a tela (Ctrl+L)"
          >
            limpar
          </button>
        </div>
      </div>

      {/* scrollback */}
      <div
        ref={scroller}
        onClick={() => inputRef.current?.focus()}
        className="scanlines relative h-[430px] cursor-text overflow-y-auto bg-ink-950/80 p-4 font-mono text-[12px] leading-[1.65]"
      >
        {entries.map((e) => {
          if (e.kind === "cmd") {
            return (
              <p key={e.id} className="whitespace-pre-wrap break-words text-slate-300">
                <span className="text-ok-300">admin@dtic</span>
                <span className="text-slate-600">:</span>
                <span className="text-signal-300">~/noc</span>
                <span className="text-slate-500">$ </span>
                <span className="text-slate-100">{e.text}</span>
              </p>
            );
          }
          if (e.kind === "link" && e.href) {
            return (
              <p key={e.id}>
                <a
                  href={e.href}
                  className="text-signal-300 underline underline-offset-4 hover:text-signal-400"
                >
                  ⇩ {e.text}
                </a>
              </p>
            );
          }
          return (
            <p
              key={e.id}
              className={`whitespace-pre-wrap break-words ${TONE_CLS[e.tone ?? "text"]}`}
            >
              {e.text || "\u00A0"}
            </p>
          );
        })}
        {busy && (
          <p className="text-slate-500">
            executando<span className="caret ml-1 !h-2.5 !w-1.5" />
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-slate-300">
          <span className="text-ok-300">admin@dtic</span>
          <span className="text-slate-600">:</span>
          <span className="text-signal-300">~/noc</span>
          <span className="text-slate-500">$</span>
        </p>
      </div>

      {/* entrada */}
      <div className="flex items-center gap-2 border-t border-ink-600/50 bg-ink-900/70 px-4 py-3">
        <span className="font-mono text-xs text-slate-500">$</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          aria-label="Comando da CLI"
          placeholder='digite um comando — ex.: "status", "tickets aberto", "help"'
          className="flex-1 bg-transparent font-mono text-[12.5px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        <span className="hidden font-mono text-[10px] text-slate-600 sm:inline">
          TAB completa · ↑ histórico
        </span>
        <button
          onClick={() => void execute(value)}
          disabled={busy}
          className="btn btn-primary !px-3 !py-1.5 text-xs"
        >
          <Icon name="terminal" className="h-3.5 w-3.5" />
          Executar
        </button>
      </div>

      {/* atalhos */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-600/40 bg-ink-850/60 px-4 py-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-600">
          atalhos:
        </span>
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => {
              const cmd = q === "assets impr..." ? "assets impressora" : q;
              setValue(cmd);
              inputRef.current?.focus();
            }}
            className="rounded border border-ink-600/50 px-2 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-signal-400/40 hover:text-signal-300"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
