import { isIP } from "node:net";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  logs as logsTable,
  tickets as ticketsTable,
  users as usersTable,
} from "@/db/schema";
import { hashPassword, type SessionUser } from "@/lib/auth";
import {
  ASSET_KINDS,
  ASSET_STATUS,
  fmtDT,
  getSettings,
  PRIORITIES,
  TICKET_STATUS,
} from "@/lib/util";

/* ---------------------------------- tipos ---------------------------------- */
export type CliTone = "ok" | "err" | "warn" | "info" | "dim" | "accent" | "text";
export type CliLine = { text: string; tone?: CliTone };
export type CliResult = {
  ok: boolean;
  lines: CliLine[];
  clear?: boolean;
  theme?: "light" | "dark";
  link?: { label: string; href: string }[];
};

export const CLI_COMMANDS = [
  "help",
  "status",
  "uptime",
  "whoami",
  "users",
  "user",
  "tickets",
  "ticket",
  "assets",
  "asset",
  "ip",
  "mac",
  "units",
  "logs",
  "report",
  "export",
  "search",
  "settings",
  "clear",
  "theme",
  "date",
] as const;

/* --------------------------------- helpers --------------------------------- */
const ok = (text: string): CliLine => ({ text, tone: "ok" });
const err = (text: string): CliLine => ({ text, tone: "err" });
const warn = (text: string): CliLine => ({ text, tone: "warn" });
const info = (text: string): CliLine => ({ text, tone: "info" });
const dim = (text: string): CliLine => ({ text, tone: "dim" });

function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

function table(headers: string[], rows: string[][]): CliLine[] {
  const safeRows = rows.length ? rows : [["—"]];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...safeRows.map((r) => (r[i] ?? "").length)),
  );
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  return [
    { text: fmt(headers), tone: "accent" },
    { text: widths.map((w) => "─".repeat(w)).join("  "), tone: "dim" },
    ...safeRows.map((r): CliLine => ({ text: fmt(r), tone: "text" })),
  ];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normMac = (v: string) =>
  v.toUpperCase().replace(/[^0-9A-F]/g, "").length === 12
    ? (v.toUpperCase().replace(/[^0-9A-F]/g, "").match(/.{1,2}/g) ?? []).join(":")
    : v.toUpperCase();

/* ------------------------------- documentação ------------------------------- */
function help(): CliResult {
  const rows: [string, string][] = [
    ["help", "lista os comandos disponíveis"],
    ["status", "visão geral do NOC (chamados, equipamentos, unidades)"],
    ["uptime", "uptime da rede e tempo de sessão do console"],
    ["whoami", "identifica o operador do console"],
    ["date", "data e hora do servidor"],
    ["users", "lista usuários cadastrados"],
    ["user show <usuario>", "detalha um acesso"],
    ["user add <usuario> <email> <tecnico|superadmin> <senha>", "cria um acesso"],
    ["user passwd <usuario> <nova-senha>", "redefine a senha"],
    ["user email <usuario> <email>", "atualiza o e-mail cadastrado"],
    ["user disable|enable <usuario>", "desativa / reativa o acesso"],
    ["tickets [status]", "lista chamados (aberto, andamento, resolvido, fechado)"],
    ["ticket show <codigo>", "detalha um chamado"],
    ["ticket status <codigo> <status>", "atualiza o status do chamado"],
    ["assets [tipo]", "lista impressoras, mesinhas, computadores, notebooks, IPs e links"],
    ["asset show <nome>", "detalha o equipamento (IP, MAC, unidade)"],
    ["asset status <nome> <status>", "atualiza o status do equipamento"],
    ["ip <endereco>", "localiza o equipamento pelo IP"],
    ["mac <endereco>", "localiza o equipamento pelo MAC"],
    ["units", "unidades separadas por ESCOLA / CMEI com contagem"],
    ["logs [n]", "últimos eventos de auditoria (padrão 15)"],
    ["report summary [dias]", "resumo operacional do período"],
    ["export <pdf|xlsx|doc>", "gera relatório para download"],
    ["search <termo>", "busca global em chamados, equipamentos e unidades"],
    ["settings", "parâmetros atuais do NOC"],
    ["theme <dark|light>", "alterna o tema do console"],
    ["clear", "limpa a tela"],
  ];
  return {
    ok: true,
    lines: [
      info("DTIC/SUPORTE — CLI administrativa · comandos disponíveis"),
      dim("sintaxe: comando [subcomando] [argumentos] · aspas para nomes com espaço"),
      ...table(["COMANDO", "DESCRIÇÃO"], rows.map(([c, d]) => [c, d])),
      dim("dica: use TAB para completar e ↑/↓ para navegar no histórico"),
    ],
  };
}

/* --------------------------------- comandos --------------------------------- */
async function status(): Promise<CliResult> {
  const [st, tk, as, us, fs] = await Promise.all([
    getSettings(),
    db.select().from(ticketsTable),
    db.select().from(assetsTable),
    db.select().from(usersTable),
    db.select().from(facilitiesTable),
  ]);

  const count = (s: string) => tk.filter((t) => t.status === s).length;
  const open = count("aberto");
  const prog = count("andamento");
  const eqOk = as.filter((a) => a.status === "ativo").length;
  const alerts = as.filter((a) => a.status === "defeito").length;

  return {
    ok: true,
    lines: [
      info(`NOC DTIC/SUPORTE — ${st.orgName}`),
      ...table(
        ["MÉTRICA", "VALOR"],
        [
          ["Uptime da rede", `${st.networkUptime}%`],
          ["Chamados abertos / em andamento", `${open} / ${prog}`],
          ["Resolvidos / fechados", `${count("resolvido")} / ${count("fechado")}`],
          ["Equipamentos ativos / total", `${eqOk} / ${as.length}`],
          ["Equipamentos em defeito", String(alerts)],
          ["Unidades (ESCOLA / CMEI)", `${fs.filter((f) => f.kind === "ESCOLA").length} / ${fs.filter((f) => f.kind === "CMEI").length}`],
          ["Usuários ativos / total", `${us.filter((u) => u.active).length} / ${us.length}`],
        ],
      ),
      open > 0 ? warn(`atenção: ${open} chamado(s) aguardando atendimento`) : ok("fila de chamados sem pendências"),
    ],
  };
}

async function usersCmd(args: string[], me: SessionUser): Promise<CliResult> {
  const sub = args[0] ?? "list";

  if (sub === "list" || sub === "ls") {
    const rows = await db
      .select()
      .from(usersTable)
      .orderBy(asc(usersTable.username));
    return {
      ok: true,
      lines: [
        info(`${rows.length} acesso(s) cadastrado(s)`),
        ...table(
          ["USUÁRIO", "NOME", "E-MAIL", "PERFIL", "STATUS"],
          rows.map((u) => [
            u.username + (u.id === me.id ? " *" : ""),
            u.name,
            u.email ?? "—",
            u.role === "superadmin" ? "superadmin" : "tecnico",
            u.active ? "ativo" : "desativado",
          ]),
        ),
      ],
    };
  }

  if (sub === "show") {
    const uname = (args[1] ?? "").toLowerCase();
    if (!uname) return { ok: false, lines: [err("uso: user show <usuario>")] };
    const r = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, uname))
      .limit(1);
    const u = r[0];
    if (!u) return { ok: false, lines: [err(`usuário "${uname}" não encontrado`)] };
    return {
      ok: true,
      lines: table(
        ["CAMPO", "VALOR"],
        [
          ["id", String(u.id)],
          ["nome", u.name],
          ["usuário", u.username],
          ["e-mail", u.email ?? "—"],
          ["perfil", u.role],
          ["status", u.active ? "ativo" : "desativado"],
          ["criado em", fmtDT(u.createdAt)],
        ],
      ),
    };
  }

  if (sub === "add") {
    const [uname, email, role, pass] = args.slice(1);
    if (!uname || !email || !role || !pass)
      return {
        ok: false,
        lines: [err("uso: user add <usuario> <email> <tecnico|superadmin> <senha>")],
      };
    if (!EMAIL_RE.test(email)) return { ok: false, lines: [err("e-mail inválido")] };
    if (pass.length < 6)
      return { ok: false, lines: [err("a senha deve ter ao menos 6 caracteres")] };
    const dupe = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(or(eq(usersTable.username, uname.toLowerCase()), eq(usersTable.email, email.toLowerCase())))
      .limit(1);
    if (dupe[0])
      return { ok: false, lines: [err("usuário ou e-mail já cadastrado")] };

    await db.insert(usersTable).values({
      name: uname,
      username: uname.toLowerCase(),
      email: email.toLowerCase(),
      role: role === "superadmin" ? "superadmin" : "tecnico",
      passwordHash: hashPassword(pass),
      active: true,
    });
    return {
      ok: true,
      lines: [ok(`acesso "${uname.toLowerCase()}" criado (${role})`), dim(`e-mail cadastrado: ${email.toLowerCase()}`)],
    };
  }

  if (sub === "passwd") {
    const uname = (args[1] ?? "").toLowerCase();
    const pass = args[2] ?? "";
    if (!uname || !pass)
      return { ok: false, lines: [err("uso: user passwd <usuario> <nova-senha>")] };
    if (pass.length < 6)
      return { ok: false, lines: [err("a senha deve ter ao menos 6 caracteres")] };
    const r = await db.select().from(usersTable).where(eq(usersTable.username, uname)).limit(1);
    if (!r[0]) return { ok: false, lines: [err(`usuário "${uname}" não encontrado`)] };
    await db.update(usersTable).set({ passwordHash: hashPassword(pass) }).where(eq(usersTable.id, r[0].id));
    return { ok: true, lines: [ok(`senha de "${uname}" redefinida`), dim("o usuário pode alterá-la em Meu Perfil")] };
  }

  if (sub === "email") {
    const uname = (args[1] ?? "").toLowerCase();
    const email = (args[2] ?? "").toLowerCase();
    if (!uname || !email)
      return { ok: false, lines: [err("uso: user email <usuario> <email>")] };
    if (!EMAIL_RE.test(email)) return { ok: false, lines: [err("e-mail inválido")] };
    const r = await db.select().from(usersTable).where(eq(usersTable.username, uname)).limit(1);
    if (!r[0]) return { ok: false, lines: [err(`usuário "${uname}" não encontrado`)] };
    const clash = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (clash[0] && clash[0].id !== r[0].id)
      return { ok: false, lines: [err("e-mail já utilizado por outro usuário")] };
    await db.update(usersTable).set({ email }).where(eq(usersTable.id, r[0].id));
    return { ok: true, lines: [ok(`e-mail de "${uname}" atualizado para ${email}`)] };
  }

  if (sub === "disable" || sub === "enable") {
    const uname = (args[1] ?? "").toLowerCase();
    if (!uname) return { ok: false, lines: [err(`uso: user ${sub} <usuario>`)] };
    const r = await db.select().from(usersTable).where(eq(usersTable.username, uname)).limit(1);
    if (!r[0]) return { ok: false, lines: [err(`usuário "${uname}" não encontrado`)] };
    if (r[0].id === me.id)
      return { ok: false, lines: [err("você não pode desativar o próprio acesso")] };
    const active = sub === "enable";
    await db.update(usersTable).set({ active }).where(eq(usersTable.id, r[0].id));
    return { ok: true, lines: [ok(`acesso "${uname}" ${active ? "reativado" : "desativado"}`)] };
  }

  return { ok: false, lines: [err(`subcomando "${sub}" inválido`), dim("use: user list | show | add | passwd | email | disable | enable")] };
}

async function ticketsCmd(args: string[]): Promise<CliResult> {
  const sub = args[0];
  const isStatusArg = !!sub && sub in TICKET_STATUS;

  if (!sub || sub === "list" || sub === "ls" || isStatusArg) {
    const status = sub === "list" || sub === "ls" ? args[1] : sub;
    const rows = await db
      .select({
        t: ticketsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
      })
      .from(ticketsTable)
      .leftJoin(facilitiesTable, eq(ticketsTable.facilityId, facilitiesTable.id))
      .orderBy(desc(ticketsTable.createdAt))
      .limit(40);
    const filtered = status && TICKET_STATUS[status] ? rows.filter((r) => r.t.status === status) : rows;
    if (status && !TICKET_STATUS[status])
      return { ok: false, lines: [err(`status inválido. use: ${Object.keys(TICKET_STATUS).join(", ")}`)] };
    return {
      ok: true,
      lines: [
        info(`${filtered.length} chamado(s)${status ? ` com status "${status}"` : " (mais recentes)"}`),
        ...table(
          ["CÓDIGO", "TÍTULO", "PRIOR.", "STATUS", "UNIDADE"],
          filtered.map(({ t, facilityName, facilityKind }) => [
            t.code,
            t.title.length > 34 ? t.title.slice(0, 33) + "…" : t.title,
            PRIORITIES[t.priority]?.label ?? t.priority,
            TICKET_STATUS[t.status]?.label ?? t.status,
            facilityName ? `${facilityKind} · ${facilityName}` : "—",
          ]),
        ),
      ],
    };
  }

  if (sub === "show") {
    const code = (args[1] ?? "").toUpperCase();
    if (!code) return { ok: false, lines: [err("uso: ticket show <codigo>")] };
    const r = await db
      .select({
        t: ticketsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
        assetName: assetsTable.name,
      })
      .from(ticketsTable)
      .leftJoin(facilitiesTable, eq(ticketsTable.facilityId, facilitiesTable.id))
      .leftJoin(assetsTable, eq(ticketsTable.assetId, assetsTable.id))
      .where(eq(ticketsTable.code, code))
      .limit(1);
    const row = r[0];
    if (!row) return { ok: false, lines: [err(`chamado ${code} não encontrado`)] };
    const t = row.t;
    return {
      ok: true,
      lines: [
        info(`${t.code} — ${t.title}`),
        ...table(
          ["CAMPO", "VALOR"],
          [
            ["solicitante", `${t.requester}${t.contact ? ` (${t.contact})` : ""}`],
            ["unidade", row.facilityName ? `${row.facilityKind} · ${row.facilityName}` : "—"],
            ["equipamento", row.assetName ?? "—"],
            ["categoria", t.category],
            ["prioridade", PRIORITIES[t.priority]?.label ?? t.priority],
            ["status", TICKET_STATUS[t.status]?.label ?? t.status],
            ["responsável", t.assignedTo || "—"],
            ["aberto em", fmtDT(t.createdAt)],
            ["resolvido em", t.resolvedAt ? fmtDT(t.resolvedAt) : "—"],
          ],
        ),
        dim(t.description || "sem descrição"),
      ],
    };
  }

  if (sub === "status") {
    const code = (args[1] ?? "").toUpperCase();
    const st = (args[2] ?? "").toLowerCase();
    if (!code || !st)
      return { ok: false, lines: [err("uso: ticket status <codigo> <aberto|andamento|resolvido|fechado>")] };
    if (!TICKET_STATUS[st])
      return { ok: false, lines: [err(`status inválido. use: ${Object.keys(TICKET_STATUS).join(", ")}`)] };
    const r = await db.select().from(ticketsTable).where(eq(ticketsTable.code, code)).limit(1);
    const t = r[0];
    if (!t) return { ok: false, lines: [err(`chamado ${code} não encontrado`)] };
    const now = new Date();
    await db
      .update(ticketsTable)
      .set({
        status: st,
        updatedAt: now,
        resolvedAt: st === "resolvido" || st === "fechado" ? (t.resolvedAt ?? now) : null,
      })
      .where(eq(ticketsTable.id, t.id));
    return { ok: true, lines: [ok(`${t.code} → ${TICKET_STATUS[st].label}`)] };
  }

  return { ok: false, lines: [err(`subcomando "${sub}" inválido`), dim("use: tickets [status] | ticket show | ticket status")] };
}

async function assetsCmd(args: string[]): Promise<CliResult> {
  const sub = (args[0] ?? "").toLowerCase();

  if (!sub || sub === "list" || sub === "ls" || Object.hasOwn(ASSET_KINDS, sub)) {
    const kind = sub === "list" || sub === "ls" ? args[1] : sub;
    if (kind && !ASSET_KINDS[kind])
      return { ok: false, lines: [err(`tipo inválido. use: ${Object.keys(ASSET_KINDS).join(", ")}`)] };
    const rows = await db
      .select({
        a: assetsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
      })
      .from(assetsTable)
      .leftJoin(facilitiesTable, eq(assetsTable.facilityId, facilitiesTable.id))
      .orderBy(asc(assetsTable.name));
    const filtered = kind ? rows.filter((r) => kind === "ip" ? Boolean(r.a.ip) : r.a.kind === kind) : rows;
    return {
      ok: true,
      lines: [
        info(`${filtered.length} registro(s)${kind ? ` do tipo "${kind}"` : ""}`),
        ...table(
          ["IDENTIFICAÇÃO", "TIPO", "IP", "MAC", "UNIDADE", "STATUS"],
          filtered.map(({ a, facilityName, facilityKind }) => [
            a.name,
            ASSET_KINDS[a.kind]?.label ?? a.kind,
            a.ip || "—",
            a.mac || "—",
            facilityName ? `${facilityKind} · ${facilityName}` : "—",
            ASSET_STATUS[a.status]?.label ?? a.status,
          ]),
        ),
      ],
    };
  }

  if (sub === "listall") return assetsCmd([]);

  return { ok: false, lines: [err(`tipo "${sub}" inválido`), dim("use: assets [impressora|mesinha|computador|notebook|ip|link]")] };
}

async function assetCmd(args: string[]): Promise<CliResult> {
  const sub = args[0];
  if (sub === "show") {
    const name = (args.slice(1).join(" ") ?? "").toUpperCase();
    if (!name) return { ok: false, lines: [err("uso: asset show <identificação>")] };
    const r = await db
      .select({
        a: assetsTable,
        facilityName: facilitiesTable.name,
        facilityKind: facilitiesTable.kind,
      })
      .from(assetsTable)
      .leftJoin(facilitiesTable, eq(assetsTable.facilityId, facilitiesTable.id))
      .where(eq(assetsTable.name, name))
      .limit(1);
    const row = r[0];
    if (!row) return { ok: false, lines: [err(`equipamento "${name}" não encontrado`)] };
    const a = row.a;
    return {
      ok: true,
      lines: table(
        ["CAMPO", "VALOR"],
        [
          ["identificação", a.name],
          ["tipo", ASSET_KINDS[a.kind]?.label ?? a.kind],
          ["ip", a.ip || "—"],
          ["mac", a.mac || "—"],
          ["unidade", row.facilityName ? `${row.facilityKind} · ${row.facilityName}` : "—"],
          ["sala / local", a.room || "—"],
          ["status", ASSET_STATUS[a.status]?.label ?? a.status],
          ["provedor", a.provider || "—"],
          ["velocidade", a.bandwidth || "—"],
          ["URL", a.linkUrl || "—"],
          ["observações", a.notes || "—"],
          ["atualizado em", fmtDT(a.updatedAt)],
        ],
      ),
    };
  }

  if (sub === "status") {
    const name = (args[1] ?? "").toUpperCase();
    const st = (args[2] ?? "").toLowerCase();
    if (!name || !st)
      return { ok: false, lines: [err("uso: asset status <identificação> <ativo|manutencao|defeito|inativo>")] };
    if (!ASSET_STATUS[st])
      return { ok: false, lines: [err(`status inválido. use: ${Object.keys(ASSET_STATUS).join(", ")}`)] };
    const r = await db.select().from(assetsTable).where(eq(assetsTable.name, name)).limit(1);
    if (!r[0]) return { ok: false, lines: [err(`equipamento "${name}" não encontrado`)] };
    await db
      .update(assetsTable)
      .set({ status: st, updatedAt: new Date() })
      .where(eq(assetsTable.id, r[0].id));
    return { ok: true, lines: [ok(`${name} → ${ASSET_STATUS[st].label}`)] };
  }

  return { ok: false, lines: [err(`subcomando "${sub ?? ""}" inválido`), dim("use: asset show <nome> | asset status <nome> <status>")] };
}

async function devicesBy(field: "ip" | "mac", value: string): Promise<CliResult> {
  const v = value.trim();
  if (!v) return { ok: false, lines: [err(`uso: ${field} <endereço>`)] };
  if (field === "ip" && !isIP(v))
    return { ok: false, lines: [err("IP inválido. Informe um endereço IPv4 ou IPv6 válido.")] };

  const rows = await db
    .select({
      a: assetsTable,
      facilityName: facilitiesTable.name,
      facilityKind: facilitiesTable.kind,
    })
    .from(assetsTable)
    .leftJoin(facilitiesTable, eq(assetsTable.facilityId, facilitiesTable.id))
    .where(field === "ip" ? eq(assetsTable.ip, v) : eq(assetsTable.mac, normMac(v)))
    .limit(5);

  if (!rows.length)
    return { ok: false, lines: [warn(`nenhum equipamento com ${field.toUpperCase()} ${v} no inventário`)] };

  return {
    ok: true,
    lines: [
      info(`${rows.length} equipamento(s) encontrado(s)`),
      ...table(
        ["IDENTIFICAÇÃO", "TIPO", "IP", "MAC", "UNIDADE", "SALA", "STATUS"],
        rows.map(({ a, facilityName, facilityKind }) => [
          a.name,
          ASSET_KINDS[a.kind]?.label ?? a.kind,
          a.ip || "—",
          a.mac || "—",
          facilityName ? `${facilityKind} · ${facilityName}` : "—",
          a.room || "—",
          ASSET_STATUS[a.status]?.label ?? a.status,
        ]),
      ),
    ],
  };
}

async function units(): Promise<CliResult> {
  const [as, fs] = await Promise.all([
    db.select().from(assetsTable),
    db.select().from(facilitiesTable).orderBy(asc(facilitiesTable.name)),
  ]);
  const lines: CliLine[] = [];
  for (const kind of ["ESCOLA", "CMEI"] as const) {
    const group = fs.filter((f) => f.kind === kind);
    lines.push(info(`${kind === "ESCOLA" ? "ESCOLAS" : "CMEIs"} — ${group.length} unidade(s)`));
    lines.push(
      ...table(
        ["UNIDADE", "IMPR.", "MESINHAS", "PCs", "NOTEBOOKS", "IPs", "LINKS", "EQUIP.", "ATIVOS"],
        group.map((f) => {
          const of = as.filter((a) => a.facilityId === f.id);
          const equipment = of.filter((a) => ["impressora", "mesinha", "computador", "notebook"].includes(a.kind));
          return [
            f.name,
            String(of.filter((a) => a.kind === "impressora").length),
            String(of.filter((a) => a.kind === "mesinha").length),
            String(of.filter((a) => a.kind === "computador").length),
            String(of.filter((a) => a.kind === "notebook").length),
            String(of.filter((a) => a.ip).length),
            String(of.filter((a) => a.kind === "link").length),
            String(equipment.length),
            String(equipment.filter((a) => a.status === "ativo").length),
          ];
        }),
      ),
    );
    const totalEq = as.filter((a) => group.some((f) => f.id === a.facilityId) && ["impressora", "mesinha", "computador", "notebook"].includes(a.kind)).length;
    lines.push(dim(`subtotal: ${totalEq} equipamento(s) · IPs incluem endereços de equipamentos e links`));
  }
  return { ok: true, lines };
}

async function logsCmd(args: string[]): Promise<CliResult> {
  const n = Math.min(100, Math.max(1, Number(args[0] ?? 15) || 15));
  const rows = await db.select().from(logsTable).orderBy(desc(logsTable.createdAt)).limit(n);
  return {
    ok: true,
    lines: [
      info(`últimos ${rows.length} evento(s) de auditoria`),
      ...table(
        ["DATA/HORA", "USUÁRIO", "AÇÃO", "DETALHES"],
        rows.map((l) => [
          fmtDT(l.createdAt),
          l.username,
          l.action,
          l.details.length > 52 ? l.details.slice(0, 51) + "…" : l.details,
        ]),
      ),
    ],
  };
}

async function report(args: string[]): Promise<CliResult> {
  if ((args[0] ?? "") !== "summary")
    return { ok: false, lines: [err("uso: report summary [dias]")] };
  const dias = Math.min(365, Math.max(1, Number(args[1] ?? 15) || 15));
  const cutoff = new Date(Date.now() - dias * 864e5);
  const [tk, as] = await Promise.all([
    db.select().from(ticketsTable),
    db.select().from(assetsTable),
  ]);
  const period = tk.filter((t) => t.createdAt >= cutoff);
  const count = (s: string) => period.filter((t) => t.status === s).length;
  const resolved = period.filter((t) => t.resolvedAt);
  const avgH = resolved.length
    ? Math.round(
        resolved.reduce((a, t) => a + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) /
          resolved.length /
          36e5,
      )
    : 0;
  return {
    ok: true,
    lines: [
      info(`resumo operacional — últimos ${dias} dias`),
      ...table(
        ["MÉTRICA", "VALOR"],
        [
          ["chamados no período", String(period.length)],
          ["abertos", String(count("aberto"))],
          ["em andamento", String(count("andamento"))],
          ["resolvidos", String(count("resolvido"))],
          ["fechados", String(count("fechado"))],
          ["tempo médio de resolução", avgH ? `${avgH} h` : "—"],
          ["equipamentos no inventário", String(as.length)],
        ],
      ),
      dim("use: export pdf | export xlsx | export doc para baixar o relatório completo"),
    ],
  };
}

async function search(term: string): Promise<CliResult> {
  if (!term) return { ok: false, lines: [err("uso: search <termo>")] };
  const q = `%${term.toLowerCase()}%`;
  const [tk, as, fs] = await Promise.all([
    db
      .select()
      .from(ticketsTable)
      .where(
        or(
          like(sql`lower(${ticketsTable.title})`, q),
          like(sql`lower(${ticketsTable.code})`, q),
          like(sql`lower(${ticketsTable.requester})`, q),
        ),
      )
      .limit(8),
    db
      .select()
      .from(assetsTable)
      .where(
        or(
          like(sql`lower(${assetsTable.name})`, q),
          like(sql`lower(${assetsTable.ip})`, q),
          like(sql`lower(${assetsTable.mac})`, q),
          like(sql`lower(${assetsTable.room})`, q),
          like(sql`lower(${assetsTable.provider})`, q),
          like(sql`lower(${assetsTable.linkUrl})`, q),
        ),
      )
      .limit(8),
    db.select().from(facilitiesTable).where(like(sql`lower(${facilitiesTable.name})`, q)).limit(8),
  ]);

  if (!tk.length && !as.length && !fs.length)
    return { ok: false, lines: [warn(`nenhum resultado para "${term}"`)] };

  const lines: CliLine[] = [info(`resultados para "${term}"`)];
  if (tk.length) {
    lines.push({ text: "chamados:", tone: "accent" });
    tk.forEach((t) =>
      lines.push({ text: `  ${t.code}  [${TICKET_STATUS[t.status]?.label}]  ${t.title}` }),
    );
  }
  if (as.length) {
    lines.push({ text: "equipamentos:", tone: "accent" });
    as.forEach((a) =>
      lines.push({ text: `  ${a.name}  ${a.ip || "—"}  ${a.mac || "—"}  ${ASSET_KINDS[a.kind]?.label}` }),
    );
  }
  if (fs.length) {
    lines.push({ text: "unidades:", tone: "accent" });
    fs.forEach((f) => lines.push({ text: `  ${f.kind}  ${f.name}` }));
  }
  return { ok: true, lines };
}

async function settings(): Promise<CliResult> {
  const st = await getSettings();
  return {
    ok: true,
    lines: table(
      ["PARÂMETRO", "VALOR"],
      [
        ["órgão", st.orgName],
        ["e-mail do suporte", st.supportEmail],
        ["telefone", st.supportPhone || "—"],
        ["horário de atendimento", st.workHours],
        ["prefixo dos chamados", st.codePrefix],
        ["uptime da rede", `${st.networkUptime}%`],
      ],
    ),
  };
}

/* -------------------------------- dispatcher -------------------------------- */
export async function runCommand(input: string, me: SessionUser): Promise<CliResult> {
  const raw = input.trim();
  if (!raw) return { ok: true, lines: [] };
  const tokens = tokenize(raw);
  const cmd = (tokens[0] ?? "").toLowerCase();
  const args = tokens.slice(1);

  try {
    switch (cmd) {
      case "help":
        return help();
      case "clear":
        return { ok: true, lines: [], clear: true };
      case "status":
        return await status();
      case "whoami":
        return {
          ok: true,
          lines: [
            {
              text: `${me.name} · ${me.username} · perfil ${me.role === "superadmin" ? "superadmin" : "tecnico"}`,
              tone: "text",
            },
            dim(`sessão do console NOC · ${new Date().toLocaleString("pt-BR")}`),
          ],
        };
      case "date":
        return {
          ok: true,
          lines: [{ text: new Date().toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "medium" }) }],
        };
      case "uptime": {
        const st = await getSettings();
        const up = process.uptime();
        const h = Math.floor(up / 3600);
        const m = Math.floor((up % 3600) / 60);
        return {
          ok: true,
          lines: [
            ok(`rede operacional · uptime ${st.networkUptime}%`),
            { text: `servidor do console no ar há ${h}h ${m}min`, tone: "text" },
            dim(`fuso: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`),
          ],
        };
      }
      case "users":
        return await usersCmd(["list"], me);
      case "user":
        return await usersCmd(args, me);
      case "tickets":
      case "ticket":
        return await ticketsCmd(args);
      case "assets":
        return await assetsCmd(args);
      case "asset":
        return await assetCmd(args);
      case "ip":
        return await devicesBy("ip", args[0] ?? "");
      case "mac":
        return await devicesBy("mac", args[0] ?? "");
      case "units":
        return await units();
      case "logs":
        return await logsCmd(args);
      case "report":
        return await report(args);
      case "export": {
        const f = (args[0] ?? "").toLowerCase();
        if (!["pdf", "xlsx", "doc"].includes(f))
          return { ok: false, lines: [err("uso: export <pdf|xlsx|doc>")] };
        return {
          ok: true,
          lines: [
            ok(`relatório ${f.toUpperCase()} gerado para download`),
            dim("clique no link abaixo — o arquivo inclui chamados e inventário"),
          ],
          link: [{ label: `baixar relatorio-dtic.${f}`, href: `/api/relatorios/export?formato=${f}&periodo=15` }],
        };
      }
      case "search":
        return await search(args.join(" "));
      case "settings":
        return await settings();
      case "theme": {
        const t = (args[0] ?? "").toLowerCase();
        if (t !== "light" && t !== "dark")
          return { ok: false, lines: [err("uso: theme <dark|light>")] };
        return { ok: true, lines: [ok(`tema ${t === "light" ? "claro" : "escuro"} aplicado`)], theme: t };
      }
      default:
        return {
          ok: false,
          lines: [
            err(`comando não encontrado: ${cmd}`),
            dim('digite "help" para ver os comandos disponíveis'),
          ],
        };
    }
  } catch (e) {
    return {
      ok: false,
      lines: [
        err("erro ao executar o comando"),
        dim(e instanceof Error ? e.message.slice(0, 160) : "falha desconhecida"),
      ],
    };
  }
}

/* ----------------------------- sugestões / apoio ----------------------------- */
export async function cliBanner(me: SessionUser): Promise<CliLine[]> {
  const st = await getSettings();
  return [
    { text: "DTIC/SUPORTE · CLI administrativa v2.4", tone: "accent" },
    dim(`operador: ${me.name} (${me.username}) · perfil: superadmin`),
    dim(`${st.orgName}`),
    dim(`sessão iniciada em ${fmtDT(new Date())} · todas as ações são auditadas`),
    { text: 'digite "help" para listar os comandos, ou "status" para a visão geral', tone: "info" },
    { text: "", tone: "text" },
  ];
}
