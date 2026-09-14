import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const money = (name: string) =>
  numeric(name, { precision: 12, scale: 2, mode: "number" }).notNull().default(0);

export const locationsTable = pgTable("staytrack_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  description: text("description"),
  totalUnits: integer("total_units").notNull().default(1),
  nightlyRate: money("nightly_rate"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingsTable = pgTable("staytrack_bookings", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  guestName: text("guest_name").notNull(),
  checkIn: date("check_in", { mode: "string" }).notNull(),
  checkOut: date("check_out", { mode: "string" }).notNull(),
  guests: integer("guests").notNull().default(1),
  amount: money("amount"),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incomeTable = pgTable("staytrack_income", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  bookingId: integer("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  amount: money("amount"),
  receivedOn: date("received_on", { mode: "string" }).notNull(),
  category: text("category").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expensesTable = pgTable("staytrack_expenses", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: money("amount"),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("paid"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceTable = pgTable("staytrack_maintenance", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("scheduled"),
  cost: money("cost"),
  notes: text("notes"),
});

export const budgetsTable = pgTable("staytrack_budgets", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  category: text("category").notNull(),
  amount: money("amount"),
  note: text("note"),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export const insertIncomeSchema = createInsertSchema(incomeTable).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export const insertMaintenanceSchema = createInsertSchema(maintenanceTable).omit({ id: true });
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true });

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;