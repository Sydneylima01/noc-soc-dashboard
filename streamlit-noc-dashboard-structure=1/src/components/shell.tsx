"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Icon } from "./ui";
import { logout } from "@/app/actions/auth";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M20 2 36 11v18L20 38 4 29V11L20 2Z"
        fill="rgba(34,211,238,0.06)"
        stroke="#22d3ee"
        strokeWidth="2"
      />
      <path
        d="M15 12h10l-10 16h10"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ShellUser = { name: string; username: string; role: string };

export function navItems(user: ShellUser) {
  const base = [
    { href: "/dashboard", label: "Painel NOC", icon: "grid" },
    { href: "/suporte", label: "Suporte & Serviços", icon: "wrench" },
    { href: "/campo", label: "Suporte em Campo", icon: "camera" },
    { href: "/ativos", label: "Equipamentos", icon: "printer" },
    { href: "/relatorios", label: "Relatórios", icon: "chart" },
    { href: "/perfil", label: "Meu Perfil", icon: "user" },
  ];
  if (user.role === "superadmin") {
    base.push(
      { href: "/cli", label: "CLI Admin", icon: "terminal" },
      { href: "/logs", label: "Logs", icon: "terminal" },
      { href: "/configuracoes", label: "Configurações", icon: "settings" },
    );
  }
  return base;
}

export function Sidebar({ user }: { user: ShellUser }) {
  const path = usePathname();
  const items = navItems(user);

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-ink-600/30 bg-ink-900/70 backdrop-blur md:flex">
      <div className="flex items-center gap-3 border-b border-ink-600/30 px-5 py-5">
        <LogoMark />
        <div>
          <p className="font-display text-[15px] font-bold leading-tight tracking-wider text-slate-50">
            DTIC<span className="text-signal-400">/</span>SUPORTE
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-500">
            NOC · v2.4
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((it) => {
          const active =
            path === it.href || path.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`group flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? "border-signal-400/30 bg-signal-400/10 text-signal-300 shadow-[inset_2px_0_0_0_#22d3ee]"
                  : "text-slate-400 hover:bg-ink-700/40 hover:text-slate-200"
              }`}
            >
              <Icon name={it.icon} className="h-[17px] w-[17px]" />
              <span>{it.label}</span>
              {active && (
                <span className="dot-live ml-auto h-1.5 w-1.5 rounded-full bg-signal-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-ink-600/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-600/50 bg-ink-800 font-display text-sm font-bold text-signal-300">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-200">
              {user.name}
            </p>
            <Badge tone={user.role === "superadmin" ? "cyan" : "green"} className="mt-0.5">
              {user.role === "superadmin" ? "Super Admin" : "Técnico"}
            </Badge>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="btn btn-ghost w-full !justify-start !py-2 text-xs"
          >
            <Icon name="logout" className="h-3.5 w-3.5" />
            Encerrar sessão
          </button>
        </form>
      </div>
    </aside>
  );
}

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const flip = () => {
    const isLight = document.documentElement.classList.toggle("light");
    try {
      localStorage.setItem("dtic-theme", isLight ? "light" : "dark");
    } catch {
      /* armazenamento indisponível */
    }
    setLight(isLight);
  };

  return (
    <button
      onClick={flip}
      aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
      title={light ? "Tema escuro" : "Tema claro"}
      className="btn btn-ghost !px-2.5 !py-2 text-xs"
    >
      <Icon name={light ? "moon" : "sun"} className="h-4 w-4" />
    </button>
  );
}

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, "Painel NOC"],
  [/^\/suporte\/\d+/, "Detalhe do chamado"],
  [/^\/suporte/, "Suporte & Serviços"],
  [/^\/ativos/, "Equipamentos"],
  [/^\/relatorios/, "Relatórios"],
  [/^\/cli/, "CLI Admin"],
  [/^\/perfil/, "Meu Perfil"],
  [/^\/logs/, "Logs de Auditoria"],
  [/^\/configuracoes/, "Configurações"],
];

export function Topbar({ user }: { user: ShellUser }) {
  const path = usePathname();
  const [now, setNow] = useState("--:--:--");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.toLocaleTimeString("pt-BR"));
      setDate(
        d.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const title =
    TITLES.find(([re]) => re.test(path))?.[1] ?? "Console";
  const items = navItems(user);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-ink-600/30 bg-ink-950/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="md:hidden">
            <LogoMark className="h-7 w-7" />
          </span>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <span className="text-signal-400">dtic/suporte</span>
            <span className="mx-1.5 text-slate-600">/</span>
            <span className="text-slate-300">{title}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <Badge tone="green" dot className="hidden sm:inline-flex">
            Sistema operacional
          </Badge>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold tabular-nums text-signal-300">
              {now}
            </p>
            <p className="font-mono text-[10px] text-slate-500">{date}</p>
          </div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                active
                  ? "border-signal-400/40 bg-signal-400/10 text-signal-300"
                  : "border-ink-600/40 text-slate-400"
              }`}
            >
              <Icon name={it.icon} className="h-3.5 w-3.5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
