import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assets as assetsTable,
  facilities as facilitiesTable,
  logs as logsTable,
  settings as settingsTable,
  tickets as ticketsTable,
  users as usersTable,
} from "@/db/schema";
import { hashPassword } from "./auth";
import { DEFAULT_SETTINGS } from "./util";

let running: Promise<void> | null = null;

/** Garante que a base possua usuários de acesso + dados de demonstração do NOC. */
export function ensureSeed(): Promise<void> {
  if (!running) {
    running = run().catch((err) => {
      running = null;
      throw err;
    });
  }
  return running;
}

const d = (days: number, hours = 0) =>
  new Date(Date.now() - days * 864e5 - hours * 36e5);

/** Garante e-mails padrão nos usuários de demonstração (migra bases antigas). */
async function ensureEmails() {
  const def: Record<string, string> = {
    admin: "admin@dtic.gov.br",
    carla: "carla.nunes@dtic.gov.br",
    joao: "joao.pereira@dtic.gov.br",
  };
  for (const [u, e] of Object.entries(def)) {
    await db
      .update(usersTable)
      .set({ email: e })
      .where(and(eq(usersTable.username, u), sql`${usersTable.email} is null`));
  }
}

async function run() {
  await ensureEmails();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(usersTable);
  if (Number(n) > 0) return;

  /* ------------------------- usuários de acesso ------------------------- */
  await db
    .insert(usersTable)
    .values([
      {
        name: "Ricardo Almeida",
        username: "admin",
        email: "admin@dtic.gov.br",
        role: "superadmin",
        passwordHash: hashPassword("dtic2024"),
      },
      {
        name: "Carla Nunes",
        username: "carla",
        email: "carla.nunes@dtic.gov.br",
        role: "tecnico",
        passwordHash: hashPassword("tec2024"),
      },
      {
        name: "João Pereira",
        username: "joao",
        email: "joao.pereira@dtic.gov.br",
        role: "tecnico",
        passwordHash: hashPassword("tec2024"),
      },
    ]);

  /* ------------------------------ unidades ------------------------------ */
  await db
    .insert(facilitiesTable)
    .values([
      { name: "EM Profª Maria das Graças", kind: "ESCOLA" },
      { name: "EM Dom Pedro II", kind: "ESCOLA" },
      { name: "EM São Francisco de Assis", kind: "ESCOLA" },
      { name: "CMEI Estrelinha Dourada", kind: "CMEI" },
      { name: "CMEI Pingo de Leite", kind: "CMEI" },
      { name: "CMEI Girassol", kind: "CMEI" },
    ]);

  /* --------------------------- equipamentos --------------------------- */
  const A = (
    kind: string,
    name: string,
    ip: string,
    mac: string,
    facilityId: number,
    room: string,
    status = "ativo",
    notes = "",
  ) => ({ kind, name, ip, mac, facilityId, room, status, notes });

  await db
    .insert(assetsTable)
    .values([
      // Impressoras
      A("impressora", "IMP-MDG-SAL01", "10.10.1.21", "00:1B:44:11:3A:21", 1, "Sala 01"),
      A("impressora", "IMP-MDG-DOC", "10.10.1.22", "00:1B:44:11:3A:22", 1, "Sala dos Docentes", "manutencao", "Tambor de toner com ruído"),
      A("impressora", "IMP-DPI-SEC", "10.10.2.31", "00:1B:44:12:0B:31", 2, "Secretaria"),
      A("impressora", "IMP-DPI-LAB", "10.10.2.32", "00:1B:44:12:0B:32", 2, "Laboratório", "defeito", "Falha de comunicação com o hub"),
      A("impressora", "IMP-SFA-DIR", "10.10.3.41", "00:1B:44:13:77:41", 3, "Direção"),
      A("impressora", "IMP-ED-BER", "10.10.4.51", "00:1B:44:14:5E:51", 4, "Sala Berçário"),
      A("impressora", "IMP-PL-COI", "10.10.5.61", "00:1B:44:15:02:61", 5, "Cozinha", "inativo", "Em desuso — aguardando descarte"),
      A("impressora", "IMP-GIR-ADM", "10.10.6.71", "00:1B:44:16:9D:71", 6, "Administrativo"),
      // Mesinhas digitais
      A("mesinha", "MSG-MDG-01", "10.10.1.11", "00:1C:44:11:1A:09", 1, "Sala dos Docentes"),
      A("mesinha", "MSG-DPI-01", "10.10.2.12", "00:1C:44:12:2B:0A", 2, "Secretaria"),
      A("mesinha", "MSG-SFA-01", "10.10.3.13", "00:1C:44:13:3C:0B", 3, "Coordenação", "manutencao", "Revisão agendada de hardware"),
      A("mesinha", "MSG-ED-01", "10.10.4.14", "00:1C:44:14:4D:0C", 4, "Sala de Apoio"),
      A("mesinha", "MSG-PL-01", "10.10.5.15", "00:1C:44:15:5E:0D", 5, "Administrativo"),
      A("mesinha", "MSG-GIR-01", "10.10.6.16", "00:1C:44:16:6F:0E", 6, "Recepção", "defeito", "Teclado sem resposta"),
      // Computadores
      A("computador", "PC-MDG-01", "10.10.1.41", "00:1D:44:11:D1:01", 1, "Secretaria"),
      A("computador", "PC-MDG-02", "10.10.1.42", "00:1D:44:11:D1:02", 1, "Sala 05"),
      A("computador", "PC-DPI-01", "10.10.2.43", "00:1D:44:12:D2:03", 2, "Rede"),
      A("computador", "PC-DPI-02", "10.10.2.44", "00:1D:44:12:D2:04", 2, "Laboratório"),
      A("computador", "PC-SFA-01", "10.10.3.45", "00:1D:44:13:D3:05", 3, "Direção", "manutencao"),
      A("computador", "PC-ED-01", "10.10.4.46", "00:1D:44:14:D4:06", 4, "Apoio Pedagógico"),
      A("computador", "PC-PL-01", "10.10.5.47", "00:1D:44:15:D5:07", 5, "Gestão", "defeito", "Lentidão extrema — disco em fim de vida"),
      A("computador", "PC-GIR-01", "10.10.6.48", "00:1D:44:16:D6:08", 6, "Administrativo"),
    ]);

  /* ------------------------------ chamados ------------------------------ */
  type SeedTicket = {
    title: string;
    requester: string;
    contact: string;
    facilityId: number | null;
    assetId: number | null;
    category: string;
    priority: string;
    status: string;
    description: string;
    assignedTo: string;
    createdById: number;
    createdAt: Date;
    resolvedAt: Date | null;
  };

  const T = (
    title: string,
    requester: string,
    contact: string,
    facilityId: number | null,
    assetId: number | null,
    category: string,
    priority: string,
    status: string,
    description: string,
    assignedTo: string,
    createdById: number,
    createdAt: Date,
    resolvedAt: Date | null,
  ): SeedTicket => ({
    title, requester, contact, facilityId, assetId, category, priority, status,
    description, assignedTo, createdById, createdAt, resolvedAt,
  });

  const seeds: SeedTicket[] = [
    T("Impressora IMP-ED-BER trava ao imprimir", "Prof. Ana Souza", "ana.souza@edu.br", 4, 6, "Impressora", "alta", "aberto", "A impressora da sala de berçário trava na 2ª folha e a bandeja fica travada. Interrompe o registro de atividades.", "Carla Nunes", 2, d(0, 3), null),
    T("Mesinha da recepção sem teclado", "Téc. Lúcia Prado", "luc.prado@edu.br", 6, 14, "Computador", "media", "aberto", "Teclado sem resposta na mesinha da recepção do CMEI Girassol. Reconeção não resolve.", "João Pereira", 2, d(0, 5), null),
    T("Impressora do CMEI Girassol não aparece na rede", "Dir. Marcos Vilela", "(11) 98811-2244", 6, 8, "Impressora", "media", "andamento", "Equipo sumiu do mapeamento. Verificar IP estático e porta do switch do administrativo.", "Carla Nunes", 2, d(1), null),
    T("Laboratório sem acesso à impressora", "Prof. Otávio Lima", "lab.dpi@edu.br", 2, 4, "Impressora", "alta", "andamento", "Nenhum PC do laboratório consegue imprimir. Impressor IMP-DPI-LAB fora do segmento.", "Carla Nunes", 3, d(1, 2), null),
    T("Monitor sem sinal no PC-DPI-01", "Secretária Regina", "regina@dpi.edu.br", 2, 17, "Computador", "media", "aberto", "Monitor pisca em laranja e não exibe imagem. Testar fonte e cabo de vídeo.", "João Pereira", 3, d(1, 6), null),
    T("Sem internet na sala de berçário", "Direção CMEI Estrelinha", "(11) 97700-3311", 4, null, "Rede", "critica", "resolvido", "Sala de berçário ficou sem conectividade durante a manhã. Cabos do patch painel trocados.", "João Pereira", 3, d(2), d(1, 6)),
    T("PC de gestão muito lento", "Gestora Fátima Reis", "fatima@pl.edu.br", 5, 21, "Computador", "media", "aberto", "PC-PL-01 demora mais de 4 min para abrir. Suspeita de disco em fim de vida.", "João Pereira", 2, d(3), null),
    T("Impressão colorida com falha na IMP-DPI-SEC", "Secretaria DPI", "sec.dpi@edu.br", 2, 3, "Impressora", "media", "resolvido", "Imagens coloridas saiam com faixa vertical. Limpeza do tambor e troca do fuser.", "Carla Nunes", 2, d(5), d(4)),
    T("Solicitação de acesso ao sistema de matrículas", "Coord. Paula Menezes", "paula@sfa.edu.br", 3, null, "Sistema", "baixa", "resolvido", "Criar perfil de coordenação no sistema de matrículas do 2º semestre.", "João Pereira", 3, d(6, 4), d(6)),
    T("Cabo de rede solto na sala 05", "Vigilante — MDG", "—", 1, null, "Rede", "baixa", "fechado", "Cabo do painel solto após limpeza. Reconectado e etiquetado.", "João Pereira", 3, d(7), d(6, 2)),
    T("Wi-Fi instável no pátio da EM Dom Pedro II", "Dir. Sandra Campos", "sandra@dpi.edu.br", 2, null, "Rede", "alta", "resolvido", "Quedas intermitentes no AP do pátio. Reponte do AP e nova canalização.", "Carla Nunes", 2, d(9), d(8, 1)),
    T("Perfis de usuário travados no servidor", "Rede DPI", "—", 1, null, "Sistema", "baixa", "fechado", "12 perfis travados após atualização. Senhas redefinidas em lote.", "Ricardo Almeida", 2, d(12), d(11, 3)),
  ];

  const year = new Date().getFullYear();
  const sorted = [...seeds].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  await db
    .insert(ticketsTable)
    .values(
      sorted.map((t, i) => ({
        ...t,
        code: `${DEFAULT_SETTINGS.codePrefix}-${year}-${String(i + 1).padStart(4, "0")}`,
        updatedAt: t.resolvedAt ?? t.createdAt,
      })),
    );

  const codes = new Map(
    sorted.map((t, i) => [
      t.title,
      `${DEFAULT_SETTINGS.codePrefix}-${year}-${String(i + 1).padStart(4, "0")}`,
    ]),
  );
  const codeOf = (title: string) => codes.get(title) ?? "—";

  /* -------------------------------- logs -------------------------------- */
  await db
    .insert(logsTable)
    .values([
      { userId: 1, username: "admin", action: "CONFIG", details: "Parâmetros do NOC atualizados", createdAt: d(11, 5) },
      { userId: 2, username: "carla", action: "LOGIN", details: "Sessão iniciada para Carla Nunes (tecnico)", createdAt: d(11, 5) },
      { userId: 2, username: "carla", action: "CHAMADO NOVO", details: `Chamado ${codeOf("Perfis de usuário travados no servidor")} criado — Perfis de usuário travados no servidor`, createdAt: d(12, 1) },
      { userId: 2, username: "carla", action: "CHAMADO STATUS", details: `Chamado ${codeOf("Perfis de usuário travados no servidor")} → Fechado`, createdAt: d(11, 3) },
      { userId: 3, username: "joao", action: "LOGIN", details: "Sessão iniciada para João Pereira (tecnico)", createdAt: d(9, 1) },
      { userId: 3, username: "joao", action: "CHAMADO STATUS", details: `Chamado ${codeOf("Wi-Fi instável no pátio da EM Dom Pedro II")} → Resolvido`, createdAt: d(8, 1) },
      { userId: 1, username: "admin", action: "USUÁRIO", details: "Senha redefinida para joao", createdAt: d(8, 2) },
      { userId: 3, username: "joao", action: "EQUIPAMENTO", details: "PC-PL-01 marcado como defeito — disco em fim de vida", createdAt: d(7, 4) },
      { userId: 2, username: "carla", action: "CHAMADO NOVO", details: `Chamado ${codeOf("Impressão colorida com falha na IMP-DPI-SEC")} criado`, createdAt: d(5, 1) },
      { userId: 2, username: "carla", action: "EQUIPAMENTO", details: "IMP-DPI-LAB marcado como defeito — falha de comunicação", createdAt: d(3, 2) },
      { userId: 3, username: "joao", action: "CHAMADO NOVO", details: `Chamado ${codeOf("Sem internet na sala de berçário")} criado`, createdAt: d(2, 2) },
      { userId: 3, username: "joao", action: "CHAMADO STATUS", details: `Chamado ${codeOf("Sem internet na sala de berçário")} → Resolvido`, createdAt: d(1, 6) },
      { userId: 2, username: "carla", action: "LOGIN", details: "Sessão iniciada para Carla Nunes (tecnico)", createdAt: d(0, 4) },
      { userId: 2, username: "carla", action: "CHAMADO NOVO", details: `Chamado ${codeOf("Impressora IMP-ED-BER trava ao imprimir")} criado`, createdAt: d(0, 3) },
      { userId: 1, username: "admin", action: "LOGIN", details: "Sessão iniciada para Ricardo Almeida (superadmin)", createdAt: d(0, 2) },
    ]);

  /* ------------------------------ settings ------------------------------ */
  await db.insert(settingsTable).values({
    orgName: DEFAULT_SETTINGS.orgName,
    supportEmail: DEFAULT_SETTINGS.supportEmail,
    supportPhone: DEFAULT_SETTINGS.supportPhone,
    workHours: DEFAULT_SETTINGS.workHours,
    codePrefix: DEFAULT_SETTINGS.codePrefix,
    networkUptime: DEFAULT_SETTINGS.networkUptime,
  });
}
