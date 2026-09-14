import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, locationsTable, bookingsTable, incomeTable, expensesTable, maintenanceTable, budgetsTable } from "@workspace/db";
import {
  ListLocationsResponse, CreateLocationBody, CreateLocationResponse, UpdateLocationParams, UpdateLocationBody, UpdateLocationResponse, DeleteLocationParams,
  ListBookingsResponse, CreateBookingBody, CreateBookingResponse, UpdateBookingParams, UpdateBookingBody, UpdateBookingResponse, DeleteBookingParams,
  ListIncomeResponse, CreateIncomeBody, CreateIncomeResponse, UpdateIncomeParams, UpdateIncomeBody, UpdateIncomeResponse, DeleteIncomeParams,
  ListExpensesResponse, CreateExpenseBody, CreateExpenseResponse, UpdateExpenseParams, UpdateExpenseBody, UpdateExpenseResponse, DeleteExpenseParams,
  ListMaintenanceResponse, CreateMaintenanceBody, CreateMaintenanceResponse, UpdateMaintenanceParams, UpdateMaintenanceBody, UpdateMaintenanceResponse, DeleteMaintenanceParams,
  ListBudgetsQueryParams, ListBudgetsResponse, CreateBudgetBody, CreateBudgetResponse, UpdateBudgetParams, UpdateBudgetBody, UpdateBudgetResponse, DeleteBudgetParams,
  GetAnalyticsResponse, ListActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const dateOnly = (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : value;
const dateTime = (value: Date | string) => value instanceof Date ? value : new Date(value);
const parseId = (value: string | string[]) => Number(Array.isArray(value) ? value[0] : value);
const today = () => new Date().toISOString().slice(0, 10);
const dateAtStart = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;
const dateAtEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

async function locationMap() {
  const locations = await db.select().from(locationsTable);
  return new Map(locations.map((location) => [location.id, location]));
}

function dateFilter(query: Record<string, unknown>) {
  const startDate = typeof query.startDate === "string" ? query.startDate : undefined;
  const endDate = typeof query.endDate === "string" ? query.endDate : undefined;
  const locationId = typeof query.locationId === "string" && query.locationId ? Number(query.locationId) : undefined;
  return { startDate, endDate, locationId };
}

function inDateRange(value: string, startDate?: string, endDate?: string) {
  return (!startDate || value >= startDate) && (!endDate || value <= endDate);
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(1, Math.ceil((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000));
}

async function bookingRows(filters: { startDate?: string; endDate?: string; locationId?: number }) {
  const locations = await locationMap();
  const rows = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.checkIn));
  return rows
    .filter((row) => !filters.locationId || row.locationId === filters.locationId)
    .filter((row) => !filters.startDate || row.checkOut >= filters.startDate)
    .filter((row) => !filters.endDate || row.checkIn <= filters.endDate)
    .map((row) => ({ ...row, locationName: locations.get(row.locationId)?.name ?? "Unknown location" }));
}

async function incomeRows(filters: { startDate?: string; endDate?: string; locationId?: number }) {
  const locations = await locationMap();
  const rows = await db.select().from(incomeTable).orderBy(desc(incomeTable.receivedOn));
  return rows
    .filter((row) => !filters.locationId || row.locationId === filters.locationId)
    .filter((row) => inDateRange(row.receivedOn, filters.startDate, filters.endDate))
    .map((row) => ({ ...row, locationName: locations.get(row.locationId)?.name ?? "Unknown location" }));
}

async function expenseRows(filters: { startDate?: string; endDate?: string; locationId?: number }) {
  const locations = await locationMap();
  const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate));
  return rows
    .filter((row) => !filters.locationId || row.locationId === filters.locationId)
    .filter((row) => inDateRange(row.expenseDate, filters.startDate, filters.endDate))
    .map((row) => ({ ...row, locationName: locations.get(row.locationId)?.name ?? "Unknown location" }));
}

async function maintenanceRows(filters: { locationId?: number }) {
  const locations = await locationMap();
  const rows = await db.select().from(maintenanceTable).orderBy(desc(maintenanceTable.scheduledDate));
  return rows
    .filter((row) => !filters.locationId || row.locationId === filters.locationId)
    .map((row) => ({ ...row, locationName: locations.get(row.locationId)?.name ?? "Unknown location" }));
}

async function budgetRows(filters: { locationId?: number; year?: number }) {
  const locations = await locationMap();
  const rows = await db.select().from(budgetsTable).orderBy(desc(budgetsTable.year), desc(budgetsTable.month));
  return rows
    .filter((row) => !filters.locationId || row.locationId === filters.locationId)
    .filter((row) => !filters.year || row.year === filters.year)
    .map((row) => ({ ...row, locationName: locations.get(row.locationId)?.name ?? "Unknown location" }));
}

router.get("/locations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(locationsTable).orderBy(desc(locationsTable.createdAt));
  res.json(ListLocationsResponse.parse(rows));
});

router.post("/locations", async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(locationsTable).values({ ...parsed.data, status: parsed.data.status ?? "active" }).returning();
  res.status(201).json(CreateLocationResponse.parse(row));
});

router.patch("/locations/:id", async (req, res): Promise<void> => {
  const params = UpdateLocationParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateLocationBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(locationsTable).set(parsed.data).where(eq(locationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Location not found" }); return; }
  res.json(UpdateLocationResponse.parse(row));
});

router.delete("/locations/:id", async (req, res): Promise<void> => {
  const params = DeleteLocationParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(locationsTable).where(eq(locationsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Location not found" }); return; }
  res.sendStatus(204);
});

router.get("/bookings", async (req, res): Promise<void> => {
  const rows = await bookingRows(dateFilter(req.query));
  res.json(ListBookingsResponse.parse(rows.map((row) => ({ ...row, checkIn: dateTime(row.checkIn), checkOut: dateTime(row.checkOut) }))));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(bookingsTable).values({ ...parsed.data, checkIn: dateOnly(parsed.data.checkIn), checkOut: dateOnly(parsed.data.checkOut), status: parsed.data.status ?? "confirmed" }).returning();
  const [withLocation] = await bookingRows({ locationId: row.locationId });
  res.status(201).json(CreateBookingResponse.parse({ ...withLocation, checkIn: dateTime(row.checkIn), checkOut: dateTime(row.checkOut) }));
});

router.patch("/bookings/:id", async (req, res): Promise<void> => {
  const params = UpdateBookingParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateBookingBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { checkIn, checkOut, ...bookingValues } = parsed.data;
  const values = { ...bookingValues, ...(checkIn ? { checkIn: dateOnly(checkIn) } : {}), ...(checkOut ? { checkOut: dateOnly(checkOut) } : {}) };
  const [row] = await db.update(bookingsTable).set(values).where(eq(bookingsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Booking not found" }); return; }
  const all = await bookingRows({});
  const mapped = all.find((item) => item.id === row.id);
  res.json(UpdateBookingResponse.parse({ ...mapped, checkIn: dateTime(row.checkIn), checkOut: dateTime(row.checkOut) }));
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  const params = DeleteBookingParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(bookingsTable).where(eq(bookingsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Booking not found" }); return; }
  res.sendStatus(204);
});

router.get("/income", async (req, res): Promise<void> => {
  res.json(ListIncomeResponse.parse(await incomeRows(dateFilter(req.query))));
});

router.post("/income", async (req, res): Promise<void> => {
  const parsed = CreateIncomeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(incomeTable).values({ ...parsed.data, receivedOn: dateOnly(parsed.data.receivedOn) }).returning();
  const mapped = (await incomeRows({})).find((item) => item.id === row.id);
  res.status(201).json(CreateIncomeResponse.parse(mapped));
});

router.patch("/income/:id", async (req, res): Promise<void> => {
  const params = UpdateIncomeParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateIncomeBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { receivedOn, ...incomeValues } = parsed.data;
  const values = { ...incomeValues, ...(receivedOn ? { receivedOn: dateOnly(receivedOn) } : {}) };
  const [row] = await db.update(incomeTable).set(values).where(eq(incomeTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Income record not found" }); return; }
  const mapped = (await incomeRows({})).find((item) => item.id === row.id);
  res.json(UpdateIncomeResponse.parse(mapped));
});

router.delete("/income/:id", async (req, res): Promise<void> => {
  const params = DeleteIncomeParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(incomeTable).where(eq(incomeTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Income record not found" }); return; }
  res.sendStatus(204);
});

router.get("/expenses", async (req, res): Promise<void> => {
  res.json(ListExpensesResponse.parse(await expenseRows(dateFilter(req.query))));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(expensesTable).values({ ...parsed.data, expenseDate: dateOnly(parsed.data.expenseDate), status: parsed.data.status ?? "paid" }).returning();
  const mapped = (await expenseRows({})).find((item) => item.id === row.id);
  res.status(201).json(CreateExpenseResponse.parse(mapped));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { expenseDate, ...expenseValues } = parsed.data;
  const values = { ...expenseValues, ...(expenseDate ? { expenseDate: dateOnly(expenseDate) } : {}) };
  const [row] = await db.update(expensesTable).set(values).where(eq(expensesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Expense record not found" }); return; }
  const mapped = (await expenseRows({})).find((item) => item.id === row.id);
  res.json(UpdateExpenseResponse.parse(mapped));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(expensesTable).where(eq(expensesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Expense record not found" }); return; }
  res.sendStatus(204);
});

router.get("/maintenance", async (req, res): Promise<void> => {
  res.json(ListMaintenanceResponse.parse(await maintenanceRows(dateFilter(req.query))));
});

router.post("/maintenance", async (req, res): Promise<void> => {
  const parsed = CreateMaintenanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(maintenanceTable).values({ ...parsed.data, scheduledDate: dateOnly(parsed.data.scheduledDate), priority: parsed.data.priority ?? "medium", status: parsed.data.status ?? "scheduled", cost: parsed.data.cost ?? 0 }).returning();
  const mapped = (await maintenanceRows({})).find((item) => item.id === row.id);
  res.status(201).json(CreateMaintenanceResponse.parse(mapped));
});

router.patch("/maintenance/:id", async (req, res): Promise<void> => {
  const params = UpdateMaintenanceParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateMaintenanceBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { scheduledDate, ...maintenanceValues } = parsed.data;
  const values = { ...maintenanceValues, ...(scheduledDate ? { scheduledDate: dateOnly(scheduledDate) } : {}) };
  const [row] = await db.update(maintenanceTable).set(values).where(eq(maintenanceTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Maintenance record not found" }); return; }
  const mapped = (await maintenanceRows({})).find((item) => item.id === row.id);
  res.json(UpdateMaintenanceResponse.parse(mapped));
});

router.delete("/maintenance/:id", async (req, res): Promise<void> => {
  const params = DeleteMaintenanceParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(maintenanceTable).where(eq(maintenanceTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Maintenance record not found" }); return; }
  res.sendStatus(204);
});

router.get("/budgets", async (req, res): Promise<void> => {
  const parsed = ListBudgetsQueryParams.safeParse({ locationId: req.query.locationId ? Number(req.query.locationId) : undefined, year: req.query.year ? Number(req.query.year) : undefined });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  res.json(ListBudgetsResponse.parse(await budgetRows(parsed.data)));
});

router.post("/budgets", async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(budgetsTable).values(parsed.data).returning();
  const mapped = (await budgetRows({})).find((item) => item.id === row.id);
  res.status(201).json(CreateBudgetResponse.parse(mapped));
});

router.patch("/budgets/:id", async (req, res): Promise<void> => {
  const params = UpdateBudgetParams.safeParse({ id: parseId(req.params.id) });
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(budgetsTable).set(parsed.data).where(eq(budgetsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Budget not found" }); return; }
  const mapped = (await budgetRows({})).find((item) => item.id === row.id);
  res.json(UpdateBudgetResponse.parse(mapped));
});

router.delete("/budgets/:id", async (req, res): Promise<void> => {
  const params = DeleteBudgetParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(budgetsTable).where(eq(budgetsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Budget not found" }); return; }
  res.sendStatus(204);
});

router.get("/analytics", async (req, res): Promise<void> => {
  const filters = dateFilter(req.query);
  const now = new Date();
  const startDate = filters.startDate ?? `${now.getUTCFullYear()}-01-01`;
  const endDate = filters.endDate ?? `${now.getUTCFullYear()}-12-31`;
  const locations = (await db.select().from(locationsTable)).filter((location) => !filters.locationId || location.id === filters.locationId);
  const [bookings, income, expenses] = await Promise.all([bookingRows(filters), incomeRows(filters), expenseRows(filters)]);
  const validBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const totalRevenue = income.reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const rangeNights = Math.max(1, Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1);
  const occupiedNights = validBookings.reduce((sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut), 0);
  const totalUnits = locations.reduce((sum, location) => sum + location.totalUnits, 0);
  const occupancyRate = totalUnits ? Math.min(100, (occupiedNights / (totalUnits * rangeNights)) * 100) : 0;
  const monthly = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const monthStart = dateAtStart(year, month);
    const monthEnd = dateAtEnd(year, month);
    const monthIncome = income.filter((row) => inDateRange(row.receivedOn, monthStart, monthEnd)).reduce((sum, row) => sum + Number(row.amount), 0);
    const monthExpenses = expenses.filter((row) => inDateRange(row.expenseDate, monthStart, monthEnd)).reduce((sum, row) => sum + Number(row.amount), 0);
    const monthBookings = validBookings.filter((row) => row.checkIn <= monthEnd && row.checkOut >= monthStart);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const units = locations.reduce((sum, location) => sum + location.totalUnits, 0);
    const monthOccupied = monthBookings.reduce((sum, row) => sum + nightsBetween(row.checkIn, row.checkOut), 0);
    monthly.push({ month: `${year}-${String(month).padStart(2, "0")}`, revenue: monthIncome, expenses: monthExpenses, profit: monthIncome - monthExpenses, bookings: monthBookings.length, occupancyRate: units ? Math.min(100, (monthOccupied / (units * days)) * 100) : 0 });
  }
  const locationBreakdown = locations.map((location) => {
    const locBookings = validBookings.filter((row) => row.locationId === location.id);
    const revenue = income.filter((row) => row.locationId === location.id).reduce((sum, row) => sum + Number(row.amount), 0);
    const expensesTotal = expenses.filter((row) => row.locationId === location.id).reduce((sum, row) => sum + Number(row.amount), 0);
    const occupied = locBookings.reduce((sum, row) => sum + nightsBetween(row.checkIn, row.checkOut), 0);
    return { locationId: location.id, locationName: location.name, revenue, expenses: expensesTotal, profit: revenue - expensesTotal, bookings: locBookings.length, occupancyRate: location.totalUnits ? Math.min(100, (occupied / (location.totalUnits * rangeNights)) * 100) : 0 };
  });
  const categoryMap = new Map<string, number>();
  expenses.forEach((row) => categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + Number(row.amount)));
  const expected = monthly.length ? monthly.reduce((sum, row) => sum + row.revenue, 0) / monthly.length : 0;
  const projections = Array.from({ length: 3 }, (_, index) => {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index + 1, 1));
    const month = monthDate.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    return { month, conservative: expected * 0.75, expected, optimistic: expected * 1.25 };
  });
  res.json(GetAnalyticsResponse.parse({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, occupancyRate, activeBookings: validBookings.length, totalUnits, monthly, locationBreakdown, expenseBreakdown: [...categoryMap.entries()].map(([category, amount]) => ({ category, amount })), projections }));
});

router.get("/activity", async (_req, res): Promise<void> => {
  const [bookings, income, expenses, maintenance, locations] = await Promise.all([
    db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)).limit(5),
    db.select().from(incomeTable).orderBy(desc(incomeTable.createdAt)).limit(5),
    db.select().from(expensesTable).orderBy(desc(expensesTable.createdAt)).limit(5),
    db.select().from(maintenanceTable).orderBy(desc(maintenanceTable.scheduledDate)).limit(5),
    db.select().from(locationsTable).orderBy(desc(locationsTable.createdAt)).limit(5),
  ]);
  const activity = [
    ...bookings.map((row) => ({ id: row.id, type: "booking" as const, title: `Booking for ${row.guestName}`, detail: `₱${Number(row.amount).toLocaleString()} reservation recorded`, occurredAt: dateTime(row.createdAt) })),
    ...income.map((row) => ({ id: 100000 + row.id, type: "income" as const, title: `Income recorded`, detail: `${row.source} · ₱${Number(row.amount).toLocaleString()}`, occurredAt: dateTime(row.createdAt) })),
    ...expenses.map((row) => ({ id: 200000 + row.id, type: "expense" as const, title: `Expense recorded`, detail: `${row.category} · ₱${Number(row.amount).toLocaleString()}`, occurredAt: dateTime(row.createdAt) })),
    ...maintenance.map((row) => ({ id: 300000 + row.id, type: "maintenance" as const, title: row.title, detail: `${row.status} · ${row.scheduledDate}`, occurredAt: dateTime(`${row.scheduledDate}T00:00:00Z`) })),
    ...locations.map((row) => ({ id: 400000 + row.id, type: "location" as const, title: `${row.name} added`, detail: row.city, occurredAt: dateTime(row.createdAt) })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 10);
  res.json(ListActivityResponse.parse(activity));
});

export default router;