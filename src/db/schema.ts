import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Device-connection sessions ("connect another device" remote control).
 * The host device pushes its player state; remote devices push commands
 * which the host consumes.
 */
export const deviceSessions = pgTable("device_sessions", {
  code: varchar("code", { length: 12 }).primaryKey(),
  state: jsonb("state").$type<Record<string, unknown> | null>(),
  commands: jsonb("commands").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});