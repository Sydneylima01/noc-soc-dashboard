/* Constantes e formatações puras — seguras para uso em client e server. */

export type Tone = "slate" | "cyan" | "green" | "amber" | "red" | "violet";

export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  aberto: { label: "Aberto", tone: "red" },
  andamento: { label: "Em andamento", tone: "amber" },
  resolvido: { label: "Resolvido", tone: "green" },
  fechado: { label: "Fechado", tone: "slate" },
};

export const PRIORITIES: Record<string, { label: string; tone: Tone }> = {
  baixa: { label: "Baixa", tone: "slate" },
  media: { label: "Média", tone: "cyan" },
  alta: { label: "Alta", tone: "amber" },
  critica: { label: "Crítica", tone: "red" },
};

export const ASSET_KINDS: Record<
  string,
  { label: string; plural: string; icon: string; desc: string }
> = {
  impressora: {
    label: "Impressora",
    plural: "Impressoras",
    icon: "printer",
    desc: "Imagem e documentação nas unidades",
  },
  mesinha: {
    label: "Mesinha digital",
    plural: "Mesinhas digitais",
    icon: "cpu",
    desc: "Estações embarcadas nas mesinhas digitais",
  },
  computador: {
    label: "Computador",
    plural: "Computadores",
    icon: "monitor",
    desc: "PCs de escritório, rede e laboratórios",
  },
  notebook: {
    label: "Notebook",
    plural: "Notebooks",
    icon: "laptop",
    desc: "Notebooks cadastrados nas escolas e CMEIs",
  },
  ip: {
    label: "Endereço IP",
    plural: "IPs",
    icon: "network",
    desc: "Endereços IPv4 e IPv6 cadastrados por unidade",
  },
  link: {
    label: "Link",
    plural: "Links",
    icon: "link",
    desc: "Links de rede, provedores e endereços web das unidades",
  },
};

export const ASSET_KIND_ORDER = [
  "impressora", "mesinha", "computador", "notebook", "ip", "link",
] as const;

export const EQUIPMENT_KINDS: readonly string[] = [
  "impressora", "mesinha", "computador", "notebook",
];

export const ASSET_STATUS: Record<string, { label: string; tone: Tone }> = {
  ativo: { label: "Ativo", tone: "green" },
  manutencao: { label: "Manutenção", tone: "amber" },
  defeito: { label: "Defeito", tone: "red" },
  inativo: { label: "Inativo", tone: "slate" },
};

export const CATEGORIES = ["Impressora", "Computador", "Notebook", "Rede", "Link", "Sistema", "Outros"];

export const DEFAULT_SETTINGS = {
  orgName: "Diretoria de Tecnologia da Informação e Comunicação",
  supportEmail: "suporte@dtic.gov.br",
  supportPhone: "(11) 4002-8922",
  workHours: "Seg a Sex · 08h às 17h",
  codePrefix: "DTIC",
  networkUptime: "99,74",
};

/* ------------------------------ formatação ------------------------------ */
export function fmtDT(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtD(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR");
}

export function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export function resolutionLabel(a: Date, b: Date): string {
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h.toFixed(1).replace(".", ",")} h`;
}

export function normMac(v: string): string {
  const clean = v.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (clean.length !== 12) return v.trim().toUpperCase();
  return (clean.match(/.{1,2}/g) ?? []).join(":");
}

export function logTone(action: string): Tone {
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT"))
    return action.includes("FALHOU") ? "red" : "cyan";
  if (action.startsWith("CHAMADO")) return "violet";
  if (action.startsWith("EQUIPAMENTO")) return "amber";
  if (action.startsWith("USUÁRIO")) return "red";
  if (action.startsWith("CONFIG")) return "slate";
  return "cyan";
}
