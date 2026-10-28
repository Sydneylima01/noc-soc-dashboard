import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* ============================== USUÁRIOS ============================== */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  /** e-mail corporativo — usado para redefinição de senha */
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  /** "superadmin" | "tecnico" */
  role: text("role").notNull().default("tecnico"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

/* ============================ UNIDADES (ESCOLA/CMEI) ============================ */
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  /** "ESCOLA" | "CMEI" */
  kind: text("kind").notNull(),
});

/* ==================== INVENTÁRIO: EQUIPAMENTOS, IPs E LINKS ==================== */
export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    /** impressora | mesinha | computador | notebook | ip | link */
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    ip: text("ip").notNull().default(""),
    mac: text("mac").notNull().default(""),
    /** Informações adicionais para links de rede ou endereços web. */
    provider: text("provider").notNull().default(""),
    bandwidth: text("bandwidth").notNull().default(""),
    linkUrl: text("link_url").notNull().default(""),
    facilityId: integer("facility_id").references(() => facilities.id, {
      onDelete: "set null",
    }),
    room: text("room").notNull().default(""),
    /** "ativo" | "manutencao" | "defeito" | "inativo" */
    status: text("status").notNull().default("ativo"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("assets_kind_idx").on(t.kind)],
);

/* ============================ CHAMADOS (SUPORTE) ============================ */
export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    requester: text("requester").notNull(),
    contact: text("contact").notNull().default(""),
    facilityId: integer("facility_id").references(() => facilities.id, {
      onDelete: "set null",
    }),
    assetId: integer("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull().default("Outros"),
    /** "baixa" | "media" | "alta" | "critica" */
    priority: text("priority").notNull().default("media"),
    /** "aberto" | "andamento" | "resolvido" | "fechado" */
    status: text("status").notNull().default("aberto"),
    description: text("description").notNull().default(""),
    assignedTo: text("assigned_to").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [index("tickets_created_idx").on(t.createdAt)],
);

/* ============================ LOGS DE AUDITORIA ============================ */
export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    username: text("username").notNull().default("sistema"),
    action: text("action").notNull(),
    details: text("details").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("logs_created_idx").on(t.createdAt)],
);

/* ==================== RELATÓRIOS DE CAMPO (foto + texto) ==================== */
export const fieldReports = pgTable("field_reports", {
  id: serial("id").primaryKey(),
  notes: text("notes").notNull().default(""),
  photoStored: text("photo_stored").notNull().default(""),
  photoMime: text("photo_mime").notNull().default(""),
  photoSize: integer("photo_size").notNull().default(0),
  facilityId: integer("facility_id").references(() => facilities.id, {
    onDelete: "set null",
  }),
  ticketId: integer("ticket_id").references(() => tickets.id, {
    onDelete: "set null",
  }),
  createdById: integer("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdByName: text("created_by_name").notNull().default("sistema"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ============================ UPLOADS DE RELATÓRIOS ============================ */
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mime: text("mime").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
  uploadedById: integer("uploaded_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedByName: text("uploaded_by_name").notNull().default("sistema"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ============================ PARÂMETROS DO NOC ============================ */
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  orgName: text("org_name").notNull().default("DTIC"),
  supportEmail: text("support_email").notNull().default("suporte@dtic.gov.br"),
  supportPhone: text("support_phone").notNull().default(""),
  workHours: text("work_hours").notNull().default("Seg a Sex · 08h às 17h"),
  codePrefix: text("code_prefix").notNull().default("DTIC"),
  networkUptime: text("network_uptime").notNull().default("99,74"),
});
