"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tone } from "@/lib/util";

/* --------------------------------- ícones --------------------------------- */
const PATHS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5 2.7-3.2Z" />
  ),
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.5" />
      <rect x="12" y="8" width="3" height="10" rx="0.5" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 7 5 5-5 5" />
      <path d="M12 19h7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  print: (
    <>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  activity: <path d="M22 12h-4l-3 8L9 4l-3 8H2" />,
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="4" width="16" height="12" rx="1.5" />
      <path d="M2 19h20l-1.5-3h-17L2 19ZM10 18h4" />
    </>
  ),
  network: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4M5 16v-4h14v4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l3-3A4.5 4.5 0 0 0 13 4.1l-1.7 1.7" />
      <path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-3 3A4.5 4.5 0 0 0 11 19.9l1.7-1.7" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 18 5" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21v-4h6v4" />
      <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 8 5-5 5 5" />
      <path d="M12 3v12" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h2.5l2-3h7l2 3H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
};

export function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name] ?? PATHS.grid}
    </svg>
  );
}

/* --------------------------------- badges --------------------------------- */
const TONE_CLS: Record<Tone, string> = {
  slate: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  cyan: "border-signal-400/40 bg-signal-400/10 text-signal-300",
  green: "border-ok-400/40 bg-ok-400/10 text-ok-300",
  amber: "border-warn-400/40 bg-warn-400/10 text-warn-300",
  red: "border-crit-400/40 bg-crit-400/10 text-crit-300",
  violet: "border-lav-400/40 bg-lav-400/10 text-lav-300",
};

export function Badge({
  tone = "slate",
  children,
  dot = false,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${TONE_CLS[tone]} ${className}`}
    >
      {dot && <span className="dot-live h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const TONE_HEX: Record<Tone, string> = {
  slate: "var(--tone-slate)",
  cyan: "var(--tone-cyan)",
  green: "var(--tone-green)",
  amber: "var(--tone-amber)",
  red: "var(--tone-red)",
  violet: "var(--tone-violet)",
};

/* -------------------------------- reveal -------------------------------- */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* --------------------------------- painel --------------------------------- */
export function Panel({
  title,
  sub,
  actions,
  children,
  className = "",
  hud = false,
}: {
  title?: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hud?: boolean;
}) {
  return (
    <section className={`panel ${hud ? "hud" : ""} ${className}`}>
      <div className="p-5">
        {(title || actions) && (
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              {title && (
                <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                  {title}
                </h2>
              )}
              {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
            </div>
            {actions}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHead({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal-400">
          // {kicker}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-slate-50">
          {title}
        </h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ----------------------------------- KPI ----------------------------------- */
export function Stat({
  icon,
  label,
  value,
  sub,
  tone = "cyan",
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  delay?: number;
}) {
  const hex = TONE_HEX[tone];
  return (
    <Reveal delay={delay}>
      <div className="panel hud group relative h-full overflow-hidden p-4">
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${hex}, transparent 70%)` }}
        />
        <div className="flex items-start justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <span style={{ color: hex }}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        </div>
        <p
          className="mt-2 font-display text-[28px] font-bold leading-none"
          style={{ color: hex }}
        >
          {value}
        </p>
        {sub && <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>}
      </div>
    </Reveal>
  );
}

/* ------------------------------- gráfico: colunas ------------------------------- */
export function BarChart({
  data,
  color = "var(--tone-cyan)",
  height = 150,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-ink-800 px-1 font-mono text-[10px] text-signal-300 opacity-0 transition-opacity group-hover:opacity-100">
              {d.value}
            </span>
            <div
              className="bar-anim w-full rounded-t-[3px] transition-all group-hover:brightness-150"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 5 : 2,
                background: d.value > 0
                  ? `linear-gradient(180deg, ${color}, ${color}26)`
                  : "rgba(51,80,122,0.25)",
                animationDelay: `${i * 45}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center font-mono text-[8.5px] text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- gráfico: donut -------------------------------- */
export function Donut({
  segments,
  size = 158,
  thickness = 17,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerSub: string;
}) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(51,80,122,0.25)"
          strokeWidth={thickness}
        />
        {segments.map((s, i) => {
          if (!s.value) return null;
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-off}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-slate-50">{centerLabel}</span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500">
          {centerSub}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ gráfico: barras h ------------------------------ */
export function HBars({
  data,
  color = "#22d3ee",
}: {
  data: { label: string; value: number; tone?: Tone }[];
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-300">{d.label}</span>
            <span className="font-mono text-[11px] text-slate-400">{d.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700/60">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.tone ? TONE_HEX[d.tone] : color,
                transition: "width .8s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- campo vazio / linha ----------------------------- */
export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center font-mono text-xs text-slate-500">
        {text}
      </td>
    </tr>
  );
}
