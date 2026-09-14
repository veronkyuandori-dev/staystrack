import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity as ActivityIcon, ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3,
  CalendarDays, ChevronDown, CircleDollarSign, ClipboardList, FileBarChart, Home,
  LayoutDashboard, LogOut, Menu, Pencil, Plus, Receipt, Settings as SettingsIcon,
  SlidersHorizontal, Trash2, TrendingUp, Wrench, X, WalletCards, Waves,
} from 'lucide-react';
import {
  getGetAnalyticsQueryKey, getListActivityQueryKey, getListBookingsQueryKey,
  getListExpensesQueryKey, getListIncomeQueryKey, getListLocationsQueryKey,
  getListMaintenanceQueryKey, getListBudgetsQueryKey, useCreateBooking, useCreateExpense, useCreateIncome,
  useCreateBudget, useDeleteBudget, useUpdateBudget, useListBudgets,
  useCreateLocation, useCreateMaintenance, useDeleteBooking, useDeleteExpense,
  useDeleteIncome, useDeleteLocation, useDeleteMaintenance, useGetAnalytics,
  useListActivity, useListBookings, useListExpenses, useListIncome, useListLocations,
  useListMaintenance, useUpdateBooking, useUpdateExpense, useUpdateIncome,
  useUpdateLocation, useUpdateMaintenance,
} from '@workspace/api-client-react';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import type { Analytics, Booking, Expense, Income, Location, Maintenance, Budget } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import '@/index.css';
import logoAsset from '@assets/1789169750135_1789298619762.jpg';
import backgroundAsset from '@assets/1789169738953_1789298632186.jpg';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const apiUrl = import.meta.env.VITE_API_URL?.trim() || null;

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c8664d', colorForeground: '#173f42', colorMutedForeground: '#6a7770',
    colorDanger: '#b84e47', colorBackground: '#fbfaf5', colorInput: '#f4f0e8',
    colorInputForeground: '#173f42', colorNeutral: '#d9d2c4', fontFamily: 'Manrope',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf5] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-float',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#173f42] font-bold',
    headerSubtitle: 'text-[#6a7770]',
    socialButtonsBlockButtonText: 'text-[#173f42]',
    formFieldLabel: 'text-[#173f42] font-semibold',
    footerActionLink: 'text-[#c8664d] font-semibold',
    footerActionText: 'text-[#6a7770]',
    dividerText: 'text-[#6a7770]',
    logoBox: 'h-14',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'border-[#d9d2c4] bg-[#f4f0e8]',
    formButtonPrimary: 'bg-[#c8664d] hover:bg-[#b75840] text-[#fbfaf5]',
    formFieldInput: 'bg-[#f4f0e8] border-[#d9d2c4] text-[#173f42]',
    footerAction: 'border-[#d9d2c4]',
    dividerLine: 'bg-[#d9d2c4]',
    alert: 'bg-[#f6e7df]',
    alertText: 'text-[#8f4034]',
    otpCodeFieldInput: 'border-[#d9d2c4] bg-[#f4f0e8]',
    formFieldRow: 'gap-1',
    main: 'gap-5',
  },
};

const nav = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Locations', href: '/locations', icon: Home },
  { label: 'Bookings', href: '/bookings', icon: CalendarDays },
  { label: 'Income', href: '/income', icon: CircleDollarSign },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench },
];
const analysisNav = [
  { label: 'Cash flow', href: '/cash-flow', icon: WalletCards },
  { label: 'Budget vs actual', href: '/budget-vs-actual', icon: BarChart3 },
  { label: 'Projection', href: '/projection', icon: TrendingUp },
  { label: 'Profitability', href: '/profitability', icon: FileBarChart },
  { label: 'Location analysis', href: '/location-analysis', icon: SlidersHorizontal },
  { label: 'Peak / off-peak', href: '/peak-off-peak', icon: Waves },
  { label: 'Monthly summary', href: '/monthly-summary', icon: ClipboardList },
  { label: 'Scenario analysis', href: '/scenario-analysis', icon: ActivityIcon },
];

const money = (value = 0) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
const date = (value?: string) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const compactDate = () => new Date().toISOString().slice(0, 10);
const tone = (value: string) => value === 'urgent' || value === 'overdue' || value === 'cancelled' ? 'red' : value === 'completed' || value === 'paid' || value === 'confirmed' ? 'green' : 'amber';

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Landing />;
}

function Landing() {
  return (
    <main className="min-h-[100dvh] bg-[#f4f0e8] text-[#173f42]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <img src={logoAsset} alt="StayTrack Property Operations" className="h-12 w-auto mix-blend-multiply object-contain" data-testid="img-brand-logo" />
        <Link href="/sign-in" className="rounded-full border border-[#173f42]/20 px-5 py-2 text-sm font-bold hover:bg-[#173f42] hover:text-[#fbfaf5]" data-testid="link-landing-sign-in">Sign in</Link>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.02fr_.98fr] md:px-10 md:pb-28 md:pt-20">
        <div className="animate-rise">
          <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[.22em] text-[#c8664d]">Property operations / one trusted view</p>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[.98] tracking-[-.06em] md:text-7xl">Run the stay.<br /><span className="text-[#c8664d]">Know the numbers.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#48605c]">StayTrack brings reservations, money movement, maintenance, and profitability into a calm, decisive operations desk for staycation managers.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/sign-in" className="group inline-flex items-center gap-3 rounded-full bg-[#173f42] px-6 py-3.5 text-sm font-bold text-[#fbfaf5] shadow-float hover:bg-[#c8664d]" data-testid="link-landing-primary">Open your operations desk <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></Link>
            <span className="text-xs text-[#6a7770]">Built for the first location and the next twenty.</span>
          </div>
        </div>
        <div className="relative animate-rise delay-2">
          <div className="absolute -inset-3 rounded-[2rem] bg-[#c8664d]/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.7rem] border border-[#fbfaf5]/70 bg-[#173f42] p-2 shadow-float">
            <img src={backgroundAsset} alt="Staycation property courtyard" className="h-[420px] w-full rounded-[1.35rem] object-cover opacity-90 md:h-[500px]" />
            <div className="absolute bottom-7 left-7 right-7 rounded-2xl border border-white/20 bg-[#173f42]/90 p-5 text-[#fbfaf5] backdrop-blur">
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f4c0a5]">The desk is clear</span><span className="h-2 w-2 rounded-full bg-[#dca96c]" /></div>
              <p className="mt-3 text-lg font-bold">Start with one location.</p>
              <p className="mt-1 text-sm text-[#d5e0d9]">Every report gets sharper as your records grow.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#d9d2c4] bg-[#fbfaf5]">
        <div className="mx-auto grid max-w-7xl gap-px md:grid-cols-3">
          {['Reservations without the scramble', 'Money movement you can explain', 'Profitability that holds up'].map((item, index) => <div className="p-8 md:p-12" key={item}><span className="font-mono text-xs text-[#c8664d]">0{index + 1}</span><h2 className="mt-6 text-xl font-bold tracking-tight">{item}</h2><p className="mt-3 max-w-xs text-sm leading-6 text-[#6a7770]">{['Keep arrivals, occupancy, and guest details in one working view.', 'Record every income and expense against the place it belongs to.', 'Move from instinct to a clear view of margin, scenarios, and break-even.'][index]}</p></div>)}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 text-xs text-[#6a7770] md:px-10"><span>STAYTRACK / PROPERTY OPERATIONS</span><span>Clarity for the work behind the stay.</span></footer>
    </main>
  );
}

function LoadingScreen() { return <div className="grid min-h-[100dvh] place-items-center bg-[#f4f0e8]"><div className="w-48 space-y-3"><div className="h-2 animate-pulse rounded bg-[#d9d2c4]" /><div className="h-2 w-3/4 animate-pulse rounded bg-[#d9d2c4]" /><div className="h-2 w-1/2 animate-pulse rounded bg-[#d9d2c4]" /></div></div>; }

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#173f42] px-4 py-8" style={{ backgroundImage: `linear-gradient(120deg,rgba(23,63,66,.95),rgba(23,63,66,.78)),url(${backgroundAsset})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
    <div className="w-full max-w-[1020px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#f4f0e8] shadow-float md:grid md:grid-cols-[.78fr_1.22fr]">
      <div className="hidden flex-col justify-between p-10 text-[#fbfaf5] md:flex" style={{ background: 'linear-gradient(160deg,#173f42,#25595a)' }}>
        <img src={logoAsset} alt="StayTrack Property Operations" className="w-56 mix-blend-screen" data-testid="img-auth-logo" />
        <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#f4c0a5]">A clearer operating rhythm</p><h1 className="mt-4 text-4xl font-extrabold leading-tight">The property is moving.<br />Stay ahead of it.</h1><p className="mt-5 max-w-xs text-sm leading-6 text-[#d5e0d9]">One desk for the decisions that keep a staycation business healthy.</p></div>
        <p className="text-xs text-[#9ab0a7]">STAYTRACK / 2025</p>
      </div>
      <div className="flex items-center justify-center p-3 md:p-8">{mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div>
    </div>
  </main>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const initials = (user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'S').toUpperCase();
  return <div className="min-h-[100dvh] bg-[#f4f0e8] text-[#173f42]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col bg-[#173f42] px-4 py-5 text-[#f4f0e8] transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-3"><Link href="/dashboard" className="text-xl font-extrabold tracking-[-.06em]" data-testid="link-sidebar-brand">stay<span className="text-[#d98264]">track</span><span className="ml-1 text-[9px] font-medium uppercase tracking-[.2em] text-[#9ab0a7]">ops</span></Link><button className="rounded-lg p-2 hover:bg-white/10 md:hidden" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="mt-8 flex-1 overflow-y-auto">
        <NavGroup label="Workspace" items={nav} location={location} onNavigate={() => setOpen(false)} />
        <NavGroup label="Analysis & reports" items={analysisNav} location={location} onNavigate={() => setOpen(false)} />
      </div>
      <div className="border-t border-white/10 pt-4"><Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${location === '/settings' ? 'bg-[#c8664d] text-white' : 'text-[#c4d1c9] hover:bg-white/10'}`} data-testid="link-settings"><SettingsIcon size={16} />Settings</Link><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c4d1c9] hover:bg-white/10" data-testid="button-log-out"><LogOut size={16} />Log out</button><div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#d98264] text-sm font-bold text-white">{initials}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user?.firstName || 'Operations lead'}</p><p className="truncate text-[10px] text-[#9ab0a7]">{user?.emailAddresses?.[0]?.emailAddress || 'StayTrack account'}</p></div></div></div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-[#173f42]/40 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-dismiss-menu" />}
    <div className="md:pl-[272px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#d9d2c4] bg-[#f4f0e8]/90 px-5 backdrop-blur md:px-9"><button className="rounded-lg p-2 hover:bg-[#e9e2d6] md:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={20} /></button><div className="hidden text-xs text-[#6a7770] md:block">Property operations / <span className="font-bold text-[#173f42]">{nav.find(item => item.href === location)?.label || analysisNav.find(item => item.href === location)?.label || (location === '/settings' ? 'Settings' : 'Overview')}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#6a7770] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6b9b72]" />Live workspace</span><Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full border border-[#d9d2c4] bg-[#fbfaf5] text-xs font-bold" data-testid="link-header-profile">{initials}</Link></div></header><main className="mx-auto max-w-[1520px] px-5 py-7 md:px-9 md:py-10">{children}</main></div>
  </div>;
}

function NavGroup({ label, items, location, onNavigate }: { label: string; items: typeof nav; location: string; onNavigate: () => void }) {
  return <div className="mb-7"><p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[.17em] text-[#78928a]">{label}</p><div className="space-y-0.5">{items.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${location === item.href ? 'bg-[#c8664d] text-white shadow-sm' : 'text-[#c4d1c9] hover:bg-white/10 hover:text-white'}`} data-testid={`link-nav-${item.href.slice(1).replace('/', '-')}`}><Icon size={16} strokeWidth={1.8} /><span>{item.label}</span></Link>; })}</div></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#c8664d]">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em] md:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6a7770]">{description}</p>}</div>{action}</div>;
}

function PrimaryButton({ children, onClick, type = 'button', testId = 'button-primary' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; testId?: string }) {
  return <button type={type} onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-[#173f42] px-4 py-2.5 text-sm font-bold text-[#fbfaf5] shadow-sm hover:bg-[#c8664d]" data-testid={testId}>{children}</button>;
}
function EmptyState({ title, body, href = '/locations', action = 'Add a location' }: { title: string; body: string; href?: string; action?: string }) {
  return <div className="grid min-h-[240px] place-items-center rounded-2xl border border-dashed border-[#cfc5b6] bg-[#fbfaf5]/60 p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e9e2d6] text-[#c8664d]"><Plus size={21} /></div><h3 className="mt-4 text-base font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6a7770]">{body}</p><Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#c8664d] hover:text-[#173f42]" data-testid={`link-empty-${action.toLowerCase().replaceAll(' ', '-')}`}>{action}<ArrowRight size={15} /></Link></div></div>;
}
function StatCard({ label, value, note, accent = false }: { label: string; value: string; note?: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 shadow-soft ${accent ? 'border-[#c8664d]/30 bg-[#c8664d]' : 'border-[#d9d2c4] bg-[#fbfaf5]'}`}><div className={`font-mono text-[10px] uppercase tracking-[.17em] ${accent ? 'text-[#f8d1bf]' : 'text-[#6a7770]'}`}>{label}</div><div className={`mt-4 text-2xl font-extrabold tracking-[-.05em] ${accent ? 'text-white' : ''}`}>{value}</div>{note && <div className={`mt-2 text-xs ${accent ? 'text-[#f8d1bf]' : 'text-[#6a7770]'}`}>{note}</div>}</div>;
}
function StatusPill({ value }: { value: string }) { const c = tone(value); return <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${c === 'green' ? 'bg-[#e0eee3] text-[#477452]' : c === 'red' ? 'bg-[#f5dfd9] text-[#9d493d]' : 'bg-[#f5ead3] text-[#906a2d]'}`}>{value.replace('-', ' ')}</span>; }

function Dashboard() {
  const [locationId, setLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const analyticsParams = locationId || startDate || endDate ? { ...(locationId ? { locationId: Number(locationId) } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) } : undefined;
  const { data: analytics, isLoading: loadingAnalytics, isError: errorAnalytics } = useGetAnalytics(analyticsParams, { query: { queryKey: getGetAnalyticsQueryKey(analyticsParams) } });
  const { data: activity, isLoading: loadingActivity } = useListActivity({ query: { queryKey: getListActivityQueryKey() } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: maintenance } = useListMaintenance(undefined, { query: { queryKey: getListMaintenanceQueryKey() } });
  const a = analytics as Analytics | undefined;
  return <><PageIntro eyebrow="Operations desk" title="Good morning. Here's the shape of the business." description="A live read on reservations, money movement, and the work keeping each location guest-ready." action={<div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-sm"><SlidersHorizontal size={15} className="text-[#c8664d]" /><select value={locationId} onChange={event => setLocationId(event.target.value)} className="max-w-[140px] bg-transparent font-semibold outline-none" data-testid="select-dashboard-location"><option value="">All locations</option>{(locations || []).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-xs" aria-label="Analytics start date" data-testid="input-dashboard-start-date" /><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-xs" aria-label="Analytics end date" data-testid="input-dashboard-end-date" /><Link href="/locations" className="inline-flex items-center gap-2 rounded-xl bg-[#c8664d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173f42]" data-testid="link-dashboard-add-location"><Plus size={17} />Add location</Link></div>} />
     {errorAnalytics && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#e9b8ae] bg-[#f8e5df] p-4 text-sm text-[#93483d]" data-testid="status-dashboard-error"><span>Analytics could not be loaded right now.</span><button onClick={() => window.location.reload()} className="font-bold underline" data-testid="button-retry-analytics">Retry</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{loadingAnalytics ? [1,2,3,4,5].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#e9e2d6]" />) : <><StatCard label="Revenue to date" value={money(a?.totalRevenue)} note="Across all locations" accent /><StatCard label="Expenses to date" value={money(a?.totalExpenses)} note="Recorded spend" /><StatCard label="Net profit" value={money(a?.netProfit)} note="Revenue less expenses" /><StatCard label="Occupancy" value={`${(a?.occupancyRate || 0).toFixed(1)}%`} note={`${a?.activeBookings || 0} active bookings`} /><StatCard label="Units tracked" value={String(a?.totalUnits || 0)} note={`${locations?.length || 0} locations`} /></>}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft md:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#6a7770]">Performance pulse</p><h2 className="mt-1 text-lg font-bold">Revenue and profit</h2></div><Link href="/monthly-summary" className="text-xs font-bold text-[#c8664d]" data-testid="link-dashboard-monthly-summary">View report <ArrowRight className="ml-1 inline" size={13} /></Link></div><MonthlyChart data={a?.monthly || []} /></section><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft md:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#6a7770]">Recent activity</p><h2 className="mt-1 text-lg font-bold">What moved</h2></div><ActivityIcon size={18} className="text-[#c8664d]" /></div>{loadingActivity ? <div className="mt-6 space-y-4">{[1,2,3].map(i => <div key={i} className="h-9 animate-pulse rounded bg-[#e9e2d6]" />)}</div> : activity?.length ? <div className="mt-5 space-y-4">{activity.slice(0, 5).map(item => <div className="flex gap-3" key={item.id} data-testid={`activity-item-${item.id}`}><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c8664d]" /><div className="min-w-0"><p className="text-sm font-bold">{item.title}</p><p className="truncate text-xs text-[#6a7770]">{item.detail}</p><p className="mt-1 font-mono text-[10px] text-[#9b9f95]">{date(item.occurredAt)}</p></div></div>)}</div> : <p className="mt-6 text-sm text-[#6a7770]" data-testid="empty-activity">Activity will appear here as your desk gets moving.</p>}</section></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#6a7770]">Locations</p><h2 className="mt-1 text-lg font-bold">Your operating footprint</h2></div><Link href="/locations" className="text-xs font-bold text-[#c8664d]" data-testid="link-dashboard-locations">Manage <ArrowRight className="ml-1 inline" size={13} /></Link></div>{locations?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{locations.slice(0,4).map(loc => <div key={loc.id} className="rounded-xl border border-[#e3ddd2] p-4" data-testid={`card-location-${loc.id}`}><div className="flex items-center justify-between"><p className="font-bold">{loc.name}</p><StatusPill value={loc.status} /></div><p className="mt-2 text-xs text-[#6a7770]">{loc.city} · {loc.totalUnits} units</p></div>)}</div> : <EmptyState title="Your first location is the unlock." body="Add the place you operate to start tracking the work and the economics." />}</section><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#6a7770]">Operational watch</p><h2 className="mt-1 text-lg font-bold">Maintenance queue</h2></div><Link href="/maintenance" className="text-xs font-bold text-[#c8664d]" data-testid="link-dashboard-maintenance">Open schedule <ArrowRight className="ml-1 inline" size={13} /></Link></div>{maintenance?.length ? <div className="mt-5 space-y-3">{maintenance.slice(0,4).map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#e3ddd2] p-3"><div><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-[#6a7770]">{item.locationName} · {date(item.scheduledDate)}</p></div><StatusPill value={item.priority} /></div>)}</div> : <EmptyState title="No repairs on the board." body="When something needs doing, schedule it here so nothing gets lost between stays." href="/maintenance" action="Schedule maintenance" />}</section></div>
  </>;
}

function MonthlyChart({ data }: { data: Analytics['monthly'] }) {
  if (!data.length) return <div className="grid h-56 place-items-center text-center text-sm text-[#6a7770]"><div><BarChart3 className="mx-auto mb-3 text-[#c8664d]" size={25} /><p>No monthly data yet.</p><p className="mt-1 text-xs">Record a booking or income entry to see the trend.</p></div></div>;
  const max = Math.max(...data.map(item => Math.max(item.revenue, item.expenses)), 1);
  return <div className="mt-6"><div className="flex h-52 items-end gap-2 border-b border-[#d9d2c4] px-1">{data.slice(-10).map(item => <div className="flex flex-1 items-end justify-center gap-1" key={item.month} title={`${item.month}: ${money(item.revenue)}`}><div className="w-2 rounded-t bg-[#c8664d] md:w-4" style={{ height: `${Math.max(3, item.revenue / max * 100)}%` }} /><div className="w-2 rounded-t bg-[#9ab0a7] md:w-4" style={{ height: `${Math.max(3, item.expenses / max * 100)}%` }} /></div>)}</div><div className="mt-3 flex justify-between gap-2 text-[9px] font-mono text-[#6a7770]">{data.slice(-10).map(item => <span key={item.month}>{item.month.slice(0, 3)}</span>)}</div><div className="mt-4 flex gap-4 text-[10px] text-[#6a7770]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#c8664d]" />Revenue</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#9ab0a7]" />Expenses</span></div></div>;
}

type Kind = 'locations' | 'bookings' | 'income' | 'expenses' | 'maintenance';
const kindLabels: Record<Kind, { title: string; singular: string; description: string }> = {
  locations: { title: 'Locations', singular: 'location', description: 'The properties that anchor your operating picture.' },
  bookings: { title: 'Bookings', singular: 'booking', description: 'Reservations and occupancy records, kept close to the work.' },
  income: { title: 'Income', singular: 'income record', description: 'Revenue entries that make every dollar traceable.' },
  expenses: { title: 'Expenses', singular: 'expense', description: 'The spend required to keep each stay moving.' },
  maintenance: { title: 'Maintenance', singular: 'maintenance item', description: 'A repair schedule that protects the guest experience.' },
};

function ResourcePage({ kind }: { kind: Kind }) {
  const meta = kindLabels[kind]; const qc = useQueryClient();
  const { data: locations, isLoading: loadingLocations, isError: locationError } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: bookings, isLoading: loadingBookings, isError: bookingsError } = useListBookings(undefined, { query: { queryKey: getListBookingsQueryKey() } });
  const { data: income, isLoading: loadingIncome, isError: incomeError } = useListIncome(undefined, { query: { queryKey: getListIncomeQueryKey() } });
  const { data: expenses, isLoading: loadingExpenses, isError: expensesError } = useListExpenses(undefined, { query: { queryKey: getListExpensesQueryKey() } });
  const { data: maintenance, isLoading: loadingMaintenance, isError: maintenanceError } = useListMaintenance(undefined, { query: { queryKey: getListMaintenanceQueryKey() } });
  const createLocation = useCreateLocation(); const updateLocation = useUpdateLocation(); const deleteLocation = useDeleteLocation();
  const createBooking = useCreateBooking(); const updateBooking = useUpdateBooking(); const deleteBooking = useDeleteBooking();
  const createIncome = useCreateIncome(); const updateIncome = useUpdateIncome(); const deleteIncome = useDeleteIncome();
  const createExpense = useCreateExpense(); const updateExpense = useUpdateExpense(); const deleteExpense = useDeleteExpense();
  const createMaintenance = useCreateMaintenance(); const updateMaintenance = useUpdateMaintenance(); const deleteMaintenance = useDeleteMaintenance();
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState<any>(null); const [confirming, setConfirming] = useState<any>(null); const [form, setForm] = useState<Record<string, string>>({});
  const allData: Record<Kind, any[]> = { locations: locations || [], bookings: bookings || [], income: income || [], expenses: expenses || [], maintenance: maintenance || [] };
  const loading: Record<Kind, boolean> = { locations: loadingLocations, bookings: loadingBookings, income: loadingIncome, expenses: loadingExpenses, maintenance: loadingMaintenance };
  const error = { locations: locationError, bookings: bookingsError, income: incomeError, expenses: expensesError, maintenance: maintenanceError }[kind];
  const rows = allData[kind]; const hasLocations = !!locations?.length;
  const openForm = (record?: any) => { setEditing(record || null); setForm(record ? Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? '')])) : { locationId: locations?.[0]?.id ? String(locations[0].id) : '', status: kind === 'locations' ? 'active' : kind === 'maintenance' ? 'scheduled' : kind === 'expenses' ? 'planned' : kind === 'bookings' ? 'confirmed' : '', priority: 'medium', checkIn: compactDate(), checkOut: compactDate(), receivedOn: compactDate(), expenseDate: compactDate(), scheduledDate: compactDate() }); setModal(true); };
  const closeForm = () => { setModal(false); setEditing(null); };
  const invalidate = () => { [getListLocationsQueryKey(), getListBookingsQueryKey(), getListIncomeQueryKey(), getListExpensesQueryKey(), getListMaintenanceQueryKey(), getGetAnalyticsQueryKey(), getListActivityQueryKey()].forEach(queryKey => qc.invalidateQueries({ queryKey })); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); const f = form; let payload: any = {}; if (kind === 'locations') payload = { name: f.name, city: f.city, address: f.address, description: f.description, totalUnits: Number(f.totalUnits), nightlyRate: Number(f.nightlyRate), status: f.status || 'active' }; if (kind === 'bookings') payload = { locationId: Number(f.locationId), guestName: f.guestName, checkIn: f.checkIn, checkOut: f.checkOut, guests: Number(f.guests), amount: Number(f.amount), status: f.status || 'confirmed', notes: f.notes }; if (kind === 'income') payload = { locationId: Number(f.locationId), bookingId: f.bookingId ? Number(f.bookingId) : undefined, source: f.source, amount: Number(f.amount), receivedOn: f.receivedOn, category: f.category, note: f.note }; if (kind === 'expenses') payload = { locationId: Number(f.locationId), category: f.category, amount: Number(f.amount), expenseDate: f.expenseDate, status: f.status || 'planned', description: f.description }; if (kind === 'maintenance') payload = { locationId: Number(f.locationId), title: f.title, scheduledDate: f.scheduledDate, priority: f.priority || 'medium', status: f.status || 'scheduled', cost: Number(f.cost || 0), notes: f.notes }; const mutation: any = editing ? ({ locations: updateLocation, bookings: updateBooking, income: updateIncome, expenses: updateExpense, maintenance: updateMaintenance }[kind]) : ({ locations: createLocation, bookings: createBooking, income: createIncome, expenses: createExpense, maintenance: createMaintenance }[kind]); mutation.mutate(editing ? { id: editing.id, data: payload } : { data: payload }, { onSuccess: () => { invalidate(); closeForm(); } }); };
  const remove = () => { const mutation: any = { locations: deleteLocation, bookings: deleteBooking, income: deleteIncome, expenses: deleteExpense, maintenance: deleteMaintenance }[kind]; mutation.mutate({ id: confirming.id }, { onSuccess: () => { invalidate(); setConfirming(null); } }); };
  const columns = kind === 'locations' ? ['Location', 'Units', 'Nightly rate', 'Status'] : kind === 'bookings' ? ['Guest', 'Location', 'Stay', 'Amount', 'Status'] : kind === 'income' ? ['Source', 'Location', 'Received', 'Category', 'Amount'] : kind === 'expenses' ? ['Category', 'Location', 'Date', 'Status', 'Amount'] : ['Work item', 'Location', 'Scheduled', 'Priority', 'Status'];
  return <><PageIntro eyebrow={`Workspace / ${kind}`} title={meta.title} description={meta.description} action={<PrimaryButton onClick={() => openForm()} testId={`button-add-${kind}`}><Plus size={17} />Add {meta.singular}</PrimaryButton>} />
    {error && <div className="mb-5 rounded-xl border border-[#e9b8ae] bg-[#f8e5df] p-4 text-sm text-[#93483d]" data-testid={`status-${kind}-error`}>We couldn't load these records. Refresh and try again.</div>}
    {!hasLocations && kind !== 'locations' ? <EmptyState title="Add a location before recording operations." body="Every booking, dollar, and repair needs a home. Add your first location to unlock this workspace." /> : loading[kind] ? <div className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-6">{[1,2,3,4].map(i => <div key={i} className="mb-4 h-10 animate-pulse rounded bg-[#e9e2d6]" />)}</div> : !rows.length ? <EmptyState title={`No ${kind} yet.`} body={`This is a clean slate. Add your first ${meta.singular} and the desk will start building a useful history.`} href={kind === 'locations' ? '/locations' : `/${kind}`} action={`Add ${meta.singular}`} /> : <div className="overflow-hidden rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] shadow-soft"><div className="flex items-center justify-between border-b border-[#e3ddd2] px-5 py-4"><p className="text-sm font-bold">{rows.length} {rows.length === 1 ? 'record' : 'records'}</p><button className="rounded-lg p-2 text-[#6a7770] hover:bg-[#e9e2d6]" data-testid={`button-filter-${kind}`}><SlidersHorizontal size={16} /></button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f4f0e8] font-mono text-[10px] uppercase tracking-wider text-[#6a7770]"><tr>{columns.map(col => <th className="whitespace-nowrap px-5 py-3 font-normal" key={col}>{col}</th>)}<th className="px-5 py-3 font-normal"> </th></tr></thead><tbody className="divide-y divide-[#e9e2d6]">{rows.map(record => <ResourceRow key={record.id} kind={kind} record={record} onEdit={() => openForm(record)} onDelete={() => setConfirming(record)} />)}</tbody></table></div></div>}
    {modal && <RecordModal kind={kind} meta={meta} form={form} setForm={setForm} editing={editing} onClose={closeForm} onSubmit={submit} locations={locations || []} bookings={bookings || []} pending={createLocation.isPending || updateLocation.isPending || createBooking.isPending || updateBooking.isPending || createIncome.isPending || updateIncome.isPending || createExpense.isPending || updateExpense.isPending || createMaintenance.isPending || updateMaintenance.isPending} />}
    {confirming && <ConfirmModal label={meta.singular} name={confirming.name || confirming.title || confirming.guestName || confirming.category || 'this record'} onCancel={() => setConfirming(null)} onConfirm={remove} pending={deleteLocation.isPending || deleteBooking.isPending || deleteIncome.isPending || deleteExpense.isPending || deleteMaintenance.isPending} />}
  </>;
}

function ResourceRow({ kind, record, onEdit, onDelete }: { kind: Kind; record: any; onEdit: () => void; onDelete: () => void }) {
  const menu = <td className="px-5 py-3 text-right"><button onClick={onEdit} className="rounded-lg p-2 text-[#6a7770] hover:bg-[#e9e2d6] hover:text-[#173f42]" data-testid={`button-edit-${kind}-${record.id}`}><Pencil size={15} /></button><button onClick={onDelete} className="rounded-lg p-2 text-[#6a7770] hover:bg-[#f5dfd9] hover:text-[#9d493d]" data-testid={`button-delete-${kind}-${record.id}`}><Trash2 size={15} /></button></td>;
  if (kind === 'locations') return <tr data-testid={`row-location-${record.id}`}><td className="px-5 py-4"><p className="font-bold">{record.name}</p><p className="text-xs text-[#6a7770]">{record.city}{record.address ? ` · ${record.address}` : ''}</p></td><td className="px-5 py-4">{record.totalUnits}</td><td className="px-5 py-4">{money(record.nightlyRate)}</td><td className="px-5 py-4"><StatusPill value={record.status} /></td>{menu}</tr>;
  if (kind === 'bookings') return <tr data-testid={`row-booking-${record.id}`}><td className="px-5 py-4"><p className="font-bold">{record.guestName}</p><p className="text-xs text-[#6a7770]">{record.guests} guests</p></td><td className="px-5 py-4">{record.locationName}</td><td className="whitespace-nowrap px-5 py-4 text-xs">{date(record.checkIn)} → {date(record.checkOut)}</td><td className="px-5 py-4 font-bold">{money(record.amount)}</td><td className="px-5 py-4"><StatusPill value={record.status} /></td>{menu}</tr>;
  if (kind === 'income') return <tr data-testid={`row-income-${record.id}`}><td className="px-5 py-4 font-bold">{record.source}</td><td className="px-5 py-4">{record.locationName}</td><td className="px-5 py-4 text-xs">{date(record.receivedOn)}</td><td className="px-5 py-4"><span className="rounded bg-[#e9e2d6] px-2 py-1 text-xs">{record.category}</span></td><td className="px-5 py-4 font-bold text-[#477452]">{money(record.amount)}</td>{menu}</tr>;
  if (kind === 'expenses') return <tr data-testid={`row-expense-${record.id}`}><td className="px-5 py-4"><p className="font-bold">{record.category}</p><p className="text-xs text-[#6a7770]">{record.description || 'No description'}</p></td><td className="px-5 py-4">{record.locationName}</td><td className="px-5 py-4 text-xs">{date(record.expenseDate)}</td><td className="px-5 py-4"><StatusPill value={record.status} /></td><td className="px-5 py-4 font-bold text-[#9d493d]">{money(record.amount)}</td>{menu}</tr>;
  return <tr data-testid={`row-maintenance-${record.id}`}><td className="px-5 py-4 font-bold">{record.title}</td><td className="px-5 py-4">{record.locationName}</td><td className="px-5 py-4 text-xs">{date(record.scheduledDate)}</td><td className="px-5 py-4"><StatusPill value={record.priority} /></td><td className="px-5 py-4"><StatusPill value={record.status} /></td>{menu}</tr>;
}

function Field({ label, name, form, setForm, type = 'text', required = true, placeholder }: { label: string; name: string; form: Record<string,string>; setForm: (updater: (prev: Record<string,string>) => Record<string,string>) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#48605c]">{label}</span><input type={type} required={required} value={form[name] || ''} placeholder={placeholder} onChange={event => setForm(prev => ({ ...prev, [name]: event.target.value }))} className="w-full rounded-xl border border-[#d9d2c4] bg-[#f4f0e8] px-3 py-2.5 text-sm outline-none focus:border-[#c8664d] focus:ring-2 focus:ring-[#c8664d]/15" data-testid={`input-${name}`} /></label>;
}
function SelectField({ label, name, options, form, setForm, required = true }: { label: string; name: string; options: { value: string; label: string }[]; form: Record<string,string>; setForm: (updater: (prev: Record<string,string>) => Record<string,string>) => void; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#48605c]">{label}</span><select required={required && name !== 'bookingId'} value={form[name] || ''} onChange={event => setForm(prev => ({ ...prev, [name]: event.target.value }))} className="w-full rounded-xl border border-[#d9d2c4] bg-[#f4f0e8] px-3 py-2.5 text-sm outline-none focus:border-[#c8664d]" data-testid={`select-${name}`}><option value="">Select {label.toLowerCase()}</option>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}
function RecordModal({ kind, meta, form, setForm, editing, onClose, onSubmit, locations, bookings, pending }: { kind: Kind; meta: typeof kindLabels[Kind]; form: Record<string,string>; setForm: (updater: (prev: Record<string,string>) => Record<string,string>) => void; editing: any; onClose: () => void; onSubmit: (event: React.FormEvent) => void; locations: Location[]; bookings: Booking[]; pending: boolean }) {
  const fields = kind === 'locations' ? <><Field label="Name" name="name" form={form} setForm={setForm} placeholder="e.g. Harbor House" /><Field label="City" name="city" form={form} setForm={setForm} placeholder="e.g. Cebu City" /><Field label="Address" name="address" form={form} setForm={setForm} required={false} /><Field label="Total units" name="totalUnits" form={form} setForm={setForm} type="number" /><Field label="Nightly rate" name="nightlyRate" form={form} setForm={setForm} type="number" /><SelectField label="Status" name="status" form={form} setForm={setForm} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></> : kind === 'bookings' ? <><SelectField label="Location" name="locationId" form={form} setForm={setForm} options={locations.map(item => ({ value: String(item.id), label: item.name }))} /><Field label="Guest name" name="guestName" form={form} setForm={setForm} /><div className="grid grid-cols-2 gap-3"><Field label="Check in" name="checkIn" form={form} setForm={setForm} type="date" /><Field label="Check out" name="checkOut" form={form} setForm={setForm} type="date" /></div><div className="grid grid-cols-2 gap-3"><Field label="Guests" name="guests" form={form} setForm={setForm} type="number" /><Field label="Amount" name="amount" form={form} setForm={setForm} type="number" /></div><SelectField label="Status" name="status" form={form} setForm={setForm} options={['confirmed','pending','checked-in','checked-out','cancelled'].map(value => ({ value, label: value }))} /></> : kind === 'income' ? <><SelectField label="Location" name="locationId" form={form} setForm={setForm} options={locations.map(item => ({ value: String(item.id), label: item.name }))} /><Field label="Source" name="source" form={form} setForm={setForm} placeholder="e.g. Direct booking" /><div className="grid grid-cols-2 gap-3"><Field label="Amount" name="amount" form={form} setForm={setForm} type="number" /><Field label="Received on" name="receivedOn" form={form} setForm={setForm} type="date" /></div><Field label="Category" name="category" form={form} setForm={setForm} placeholder="e.g. Accommodation" /><SelectField label="Booking (optional)" name="bookingId" form={form} setForm={setForm} options={bookings.map(item => ({ value: String(item.id), label: `${item.guestName} · ${date(item.checkIn)}` }))} /></> : kind === 'expenses' ? <><SelectField label="Location" name="locationId" form={form} setForm={setForm} options={locations.map(item => ({ value: String(item.id), label: item.name }))} /><Field label="Category" name="category" form={form} setForm={setForm} placeholder="e.g. Utilities" /><div className="grid grid-cols-2 gap-3"><Field label="Amount" name="amount" form={form} setForm={setForm} type="number" /><Field label="Expense date" name="expenseDate" form={form} setForm={setForm} type="date" /></div><SelectField label="Status" name="status" form={form} setForm={setForm} options={['paid','planned','overdue'].map(value => ({ value, label: value }))} /><Field label="Description" name="description" form={form} setForm={setForm} required={false} /></> : <><SelectField label="Location" name="locationId" form={form} setForm={setForm} options={locations.map(item => ({ value: String(item.id), label: item.name }))} /><Field label="Title" name="title" form={form} setForm={setForm} placeholder="e.g. Service air conditioner" /><div className="grid grid-cols-2 gap-3"><Field label="Scheduled date" name="scheduledDate" form={form} setForm={setForm} type="date" /><Field label="Estimated cost" name="cost" form={form} setForm={setForm} type="number" required={false} /></div><div className="grid grid-cols-2 gap-3"><SelectField label="Priority" name="priority" form={form} setForm={setForm} options={['low','medium','high','urgent'].map(value => ({ value, label: value }))} /><SelectField label="Status" name="status" form={form} setForm={setForm} options={['scheduled','in-progress','completed','cancelled'].map(value => ({ value, label: value }))} /></div><Field label="Notes" name="notes" form={form} setForm={setForm} required={false} /></>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#173f42]/45 p-4"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-6 shadow-float"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#c8664d]">{editing ? 'Edit record' : 'New record'}</p><h2 className="mt-1 text-xl font-bold">{editing ? 'Update' : 'Add'} {meta.singular}</h2></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-[#e9e2d6]" data-testid="button-close-modal"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><div className="grid gap-4 sm:grid-cols-2">{fields}</div><div className="flex justify-end gap-3 border-t border-[#e9e2d6] pt-5"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#6a7770] hover:bg-[#e9e2d6]" data-testid="button-cancel-form">Cancel</button><PrimaryButton type="submit" testId="button-save-record">{pending ? 'Saving…' : editing ? 'Save changes' : `Add ${meta.singular}`}</PrimaryButton></div></form></div></div>;
}
function ConfirmModal({ label, name, onCancel, onConfirm, pending }: { label: string; name: string; onCancel: () => void; onConfirm: () => void; pending: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#173f42]/45 p-4"><div className="w-full max-w-md rounded-2xl border border-[#e9b8ae] bg-[#fbfaf5] p-6 shadow-float"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f5dfd9] text-[#9d493d]"><Trash2 size={19} /></div><h2 className="mt-5 text-xl font-bold">Delete this {label}?</h2><p className="mt-2 text-sm leading-6 text-[#6a7770]"><strong className="text-[#173f42]">{name}</strong> will be removed from your workspace. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#6a7770] hover:bg-[#e9e2d6]" data-testid="button-cancel-delete">Keep it</button><button onClick={onConfirm} className="rounded-xl bg-[#9d493d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#7f3830]" data-testid="button-confirm-delete">{pending ? 'Deleting…' : 'Delete'}</button></div></div></div>;
}

function BudgetActualPage() {
  const qc = useQueryClient();
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useGetAnalytics(undefined, { query: { queryKey: getGetAnalyticsQueryKey() } });
  const { data: budgets, isLoading: budgetsLoading } = useListBudgets(undefined, { query: { queryKey: getListBudgetsQueryKey() } });
  const { data: expenses } = useListExpenses(undefined, { query: { queryKey: getListExpensesQueryKey() } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const createBudget = useCreateBudget(); const updateBudget = useUpdateBudget(); const deleteBudget = useDeleteBudget();
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Budget | null>(null); const [confirming, setConfirming] = useState<Budget | null>(null); const [form, setForm] = useState<Record<string, string>>({});
  const a = analytics as Analytics | undefined;
  const rows = (budgets || []).map((budget) => {
    const month = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Date.UTC(budget.year, budget.month, 0)).toISOString().slice(0, 10);
    const actual = (expenses || [])
      .filter((expense) => expense.locationId === budget.locationId && expense.category === budget.category)
      .filter((expense) => expense.expenseDate >= monthStart && expense.expenseDate <= monthEnd)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { ...budget, actual, variance: budget.amount - actual };
  }).sort((left, right) => `${right.year}-${right.month}`.localeCompare(`${left.year}-${left.month}`));
  const openForm = (record?: Budget) => { setEditing(record || null); setForm(record ? { locationId: String(record.locationId), month: String(record.month), year: String(record.year), category: record.category, amount: String(record.amount), note: record.note || '' } : { locationId: locations?.[0]?.id ? String(locations[0].id) : '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()), category: '', amount: '', note: '' }); setModal(true); };
  const save = (event: React.FormEvent) => { event.preventDefault(); const payload = { locationId: Number(form.locationId), month: Number(form.month), year: Number(form.year), category: form.category, amount: Number(form.amount), note: form.note || undefined }; const mutation: any = editing ? updateBudget : createBudget; mutation.mutate(editing ? { id: editing.id, data: payload } : { data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBudgetsQueryKey() }); setModal(false); setEditing(null); } }); };
  const remove = () => { if (!confirming) return; deleteBudget.mutate({ id: confirming.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBudgetsQueryKey() }); setConfirming(null); } }); };
  return <><PageIntro eyebrow="Analysis / budget control" title="Budget vs actual" description="Set monthly targets by location and category, then compare them with the live expense ledger." action={<PrimaryButton onClick={() => openForm()} testId="button-add-budget"><Plus size={17} />Add budget</PrimaryButton>} />
    {analyticsError && <div className="mb-5 rounded-xl border border-[#e9b8ae] bg-[#f8e5df] p-4 text-sm text-[#93483d]">Actual expenses could not be loaded right now.</div>}
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Budgeted" value={money(rows.reduce((sum, row) => sum + row.amount, 0))} note="Targets entered" accent /><StatCard label="Actual spend" value={money(rows.reduce((sum, row) => sum + row.actual, 0))} note="Live expense records" /><StatCard label="Remaining" value={money(rows.reduce((sum, row) => sum + row.variance, 0))} note="Budget less actual" /></div>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] shadow-soft"><div className="border-b border-[#e3ddd2] px-5 py-4"><h2 className="font-bold">Budget ledger</h2><p className="mt-1 text-xs text-[#6a7770]">No records are preloaded. Add the budget targets you want to track.</p></div>{analyticsLoading || budgetsLoading ? <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-11 animate-pulse rounded bg-[#e9e2d6]" />)}</div> : !rows.length ? <div className="p-5"><EmptyState title="No budget targets yet." body="Add a monthly target to make this comparison useful for your operation." href="/budget-vs-actual" action="Add budget target" /></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f4f0e8] font-mono text-[10px] uppercase tracking-wider text-[#6a7770]"><tr><th className="px-5 py-3 font-normal">Period</th><th className="px-5 py-3 font-normal">Location</th><th className="px-5 py-3 font-normal">Category</th><th className="px-5 py-3 text-right font-normal">Budget</th><th className="px-5 py-3 text-right font-normal">Actual</th><th className="px-5 py-3 text-right font-normal">Variance</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-[#e9e2d6]">{rows.map(row => <tr key={row.id} data-testid={`row-budget-${row.id}`}><td className="px-5 py-4 font-bold">{row.year}-{String(row.month).padStart(2, '0')}</td><td className="px-5 py-4">{row.locationName}</td><td className="px-5 py-4">{row.category}</td><td className="px-5 py-4 text-right">{money(row.amount)}</td><td className="px-5 py-4 text-right">{money(row.actual)}</td><td className={`px-5 py-4 text-right font-bold ${row.variance >= 0 ? 'text-[#477452]' : 'text-[#9d493d]'}`}>{money(row.variance)}</td><td className="whitespace-nowrap px-5 py-3 text-right"><button onClick={() => openForm(row)} className="rounded-lg p-2 text-[#6a7770] hover:bg-[#e9e2d6]" data-testid={`button-edit-budget-${row.id}`}><Pencil size={15} /></button><button onClick={() => setConfirming(row)} className="rounded-lg p-2 text-[#6a7770] hover:bg-[#f5dfd9] hover:text-[#9d493d]" data-testid={`button-delete-budget-${row.id}`}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>}</section>
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-[#173f42]/45 p-4"><div className="w-full max-w-xl rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-6 shadow-float"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#c8664d]">{editing ? 'Edit budget' : 'New budget'}</p><h2 className="mt-1 text-xl font-bold">{editing ? 'Update' : 'Add'} budget target</h2></div><button onClick={() => setModal(false)} className="rounded-lg p-2 hover:bg-[#e9e2d6]" data-testid="button-close-budget-modal"><X size={18} /></button></div><form onSubmit={save} className="mt-6 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Location" name="locationId" form={form} setForm={setForm} options={(locations || []).map(item => ({ value: String(item.id), label: item.name }))} /><Field label="Category" name="category" form={form} setForm={setForm} placeholder="e.g. Utilities" /><Field label="Month" name="month" form={form} setForm={setForm} type="number" /><Field label="Year" name="year" form={form} setForm={setForm} type="number" /><Field label="Budget amount" name="amount" form={form} setForm={setForm} type="number" /><Field label="Note" name="note" form={form} setForm={setForm} required={false} /></div><div className="flex justify-end gap-3 border-t border-[#e9e2d6] pt-5"><button type="button" onClick={() => setModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#6a7770] hover:bg-[#e9e2d6]">Cancel</button><PrimaryButton type="submit" testId="button-save-budget">{createBudget.isPending || updateBudget.isPending ? 'Saving…' : 'Save budget'}</PrimaryButton></div></form></div></div>}
    {confirming && <ConfirmModal label="budget target" name={`${confirming.category} · ${confirming.year}-${confirming.month}`} onCancel={() => setConfirming(null)} onConfirm={remove} pending={deleteBudget.isPending} />}
  </>;
}

function AnalyticsPage({ variant }: { variant: string }) {
  const [locationId, setLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const params = locationId || startDate || endDate ? { ...(locationId ? { locationId: Number(locationId) } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) } : undefined;
  const { data: analytics, isLoading, isError } = useGetAnalytics(params, { query: { queryKey: getGetAnalyticsQueryKey(params) } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const a = analytics as Analytics | undefined;
  const titleMap: Record<string, [string, string, string]> = { '/cash-flow': ['Cash flow', 'Track cash in against cash out, without the fog.', 'Cash movement'], '/budget-vs-actual': ['Budget vs actual', 'A monthly comparison for the plan and what actually happened.', 'Plan vs actual'], '/projection': ['Projection', 'Keep the forecast conservative, expected, and grounded in your records.', 'Forward view'], '/profitability': ['Profitability', 'Understand the return your operating choices are producing.', 'Business health'], '/location-analysis': ['Location analysis', 'Compare the places in your portfolio on the same clear lens.', 'Portfolio lens'], '/peak-off-peak': ['Peak / off-peak', 'See how seasonal movement changes occupancy and revenue.', 'Seasonality'], '/monthly-summary': ['Monthly summary', 'A concise management report built from the live operating ledger.', 'Management report'], '/scenario-analysis': ['Scenario analysis', 'Three ways the next few months could unfold.', 'Decision room'] };
  const [title, description, eyebrow] = titleMap[variant] || titleMap['/cash-flow'];
  if (isLoading) return <><PageIntro eyebrow={eyebrow} title={title} description={description} /><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <div className="h-32 animate-pulse rounded-2xl bg-[#e9e2d6]" key={i} />)}</div></>;
  if (isError) return <div className="rounded-2xl border border-[#e9b8ae] bg-[#f8e5df] p-6 text-sm text-[#93483d]" data-testid={`status-${variant.slice(1)}-error`}>This report could not be loaded. Refresh to try again.</div>;
  const monthly = a?.monthly || []; const projections = a?.projections || [];
  return <><PageIntro eyebrow={eyebrow} title={title} description={description} action={<div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-xs"><SlidersHorizontal size={15} className="text-[#c8664d]" /><select value={locationId} onChange={event => setLocationId(event.target.value)} className="max-w-[130px] bg-transparent font-semibold outline-none" data-testid="select-report-location"><option value="">All locations</option>{(locations || []).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-xs" aria-label="Report start date" data-testid="input-report-start-date" /><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-xs" aria-label="Report end date" data-testid="input-report-end-date" /></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Revenue" value={money(a?.totalRevenue)} note="Live records" accent={variant === '/profitability'} /><StatCard label="Expenses" value={money(a?.totalExpenses)} note="Live records" /><StatCard label="Net profit" value={money(a?.netProfit)} note={`${(a?.occupancyRate || 0).toFixed(1)}% occupancy`} /><StatCard label="Locations" value={String(locations?.length || 0)} note={`${a?.totalUnits || 0} units tracked`} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]"><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft md:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{variant === '/projection' || variant === '/scenario-analysis' ? 'Scenario outlook' : variant === '/location-analysis' ? 'Location comparison' : 'Monthly movement'}</h2><span className="font-mono text-[10px] uppercase tracking-widest text-[#6a7770]">{monthly.length} periods</span></div>{variant === '/projection' || variant === '/scenario-analysis' ? <ProjectionTable data={projections} /> : variant === '/location-analysis' ? <LocationTable data={a?.locationBreakdown || []} /> : monthly.length ? <MonthlyTable data={monthly} /> : <div className="py-20"><EmptyState title="No report data yet." body="Once you add operational records, this report will turn them into a useful signal." /> </div>}</section><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-5 shadow-soft md:p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-[#6a7770]">At a glance</p><h2 className="mt-1 text-lg font-bold">What this tells you</h2><div className="mt-6 space-y-4">{[ ['Revenue base', money(a?.totalRevenue), 'Money recorded as coming in.'], ['Cost base', money(a?.totalExpenses), 'Spend attached to your operating ledger.'], ['Margin signal', money(a?.netProfit), 'Net position before any other adjustments.'], ['Occupancy signal', `${(a?.occupancyRate || 0).toFixed(1)}%`, 'Booked capacity across tracked units.']].map(([label, value, note]) => <div className="border-b border-[#e9e2d6] pb-4 last:border-0" key={label}><div className="flex items-center justify-between"><span className="text-sm text-[#6a7770]">{label}</span><strong className="text-lg">{value}</strong></div><p className="mt-1 text-xs text-[#9b9f95]">{note}</p></div>)}</div></section></div>
  </>;
}
function MonthlyTable({ data }: { data: Analytics['monthly'] }) { return <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="font-mono text-[10px] uppercase tracking-wider text-[#6a7770]"><tr><th className="py-3">Period</th><th className="py-3">Revenue</th><th className="py-3">Expenses</th><th className="py-3">Profit</th><th className="py-3">Occupancy</th></tr></thead><tbody className="divide-y divide-[#e9e2d6]">{data.map(row => <tr key={row.month} data-testid={`row-monthly-${row.month}`}><td className="py-3 font-bold">{row.month}</td><td className="py-3">{money(row.revenue)}</td><td className="py-3">{money(row.expenses)}</td><td className={`py-3 font-bold ${row.profit >= 0 ? 'text-[#477452]' : 'text-[#9d493d]'}`}>{money(row.profit)}</td><td className="py-3">{row.occupancyRate.toFixed(1)}%</td></tr>)}</tbody></table></div>; }
function ProjectionTable({ data }: { data: Analytics['projections'] }) { if (!data.length) return <div className="py-16"><EmptyState title="Projection needs a little history." body="Add revenue and expense records to give the scenarios a base." href="/income" action="Record income" /></div>; return <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="font-mono text-[10px] uppercase tracking-wider text-[#6a7770]"><tr><th className="py-3">Period</th><th className="py-3">Conservative</th><th className="py-3">Expected</th><th className="py-3">Optimistic</th></tr></thead><tbody className="divide-y divide-[#e9e2d6]">{data.map(row => <tr key={row.month}><td className="py-3 font-bold">{row.month}</td><td className="py-3">{money(row.conservative)}</td><td className="py-3 font-bold text-[#c8664d]">{money(row.expected)}</td><td className="py-3">{money(row.optimistic)}</td></tr>)}</tbody></table></div>; }
function LocationTable({ data }: { data: Analytics['locationBreakdown'] }) { if (!data.length) return <div className="py-16"><EmptyState title="No locations to compare." body="Add a location and give it a few records to create a comparison." /></div>; return <div className="mt-6 space-y-3">{data.map(row => <div className="rounded-xl border border-[#e3ddd2] p-4" key={row.locationId} data-testid={`analysis-location-${row.locationId}`}><div className="flex items-center justify-between"><p className="font-bold">{row.locationName}</p><span className="font-mono text-xs">{row.occupancyRate.toFixed(1)}% occ.</span></div><div className="mt-3 grid grid-cols-3 gap-3 text-xs"><div><p className="text-[#6a7770]">Revenue</p><p className="mt-1 font-bold">{money(row.revenue)}</p></div><div><p className="text-[#6a7770]">Expenses</p><p className="mt-1 font-bold">{money(row.expenses)}</p></div><div><p className="text-[#6a7770]">Profit</p><p className="mt-1 font-bold text-[#477452]">{money(row.profit)}</p></div></div></div>)}</div>; }

function CashFlowPage() {
  const [locationId, setLocationId] = useState('');
  const params = locationId ? { locationId: Number(locationId) } : undefined;
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: income, isLoading: incomeLoading, isError: incomeError } = useListIncome(params, { query: { queryKey: getListIncomeQueryKey(params) } });
  const { data: expenses, isLoading: expenseLoading, isError: expenseError } = useListExpenses(params, { query: { queryKey: getListExpensesQueryKey(params) } });
  const rows = [...(income || []).map(item => ({ id: `in-${item.id}`, date: item.receivedOn, label: item.source, location: item.locationName, amount: item.amount, type: 'Cash in' })), ...(expenses || []).map(item => ({ id: `out-${item.id}`, date: item.expenseDate, label: item.category, location: item.locationName, amount: -item.amount, type: 'Cash out' }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cashIn = (income || []).reduce((sum, item) => sum + item.amount, 0); const cashOut = (expenses || []).reduce((sum, item) => sum + item.amount, 0);
  return <><PageIntro eyebrow="Analysis / cash flow" title="Cash flow" description="A filtered view of cash in and cash out, built from the income and expense ledger." action={<label className="flex items-center gap-2 rounded-xl border border-[#d9d2c4] bg-[#fbfaf5] px-3 py-2.5 text-sm"><SlidersHorizontal size={16} className="text-[#c8664d]" /><select value={locationId} onChange={event => setLocationId(event.target.value)} className="bg-transparent font-semibold outline-none" data-testid="select-cash-flow-location"><option value="">All locations</option>{(locations || []).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Cash in" value={money(cashIn)} note="Filtered income" accent /><StatCard label="Cash out" value={money(cashOut)} note="Filtered expenses" /><StatCard label="Net movement" value={money(cashIn - cashOut)} note="Cash in less cash out" /></div><section className="mt-6 overflow-hidden rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] shadow-soft"><div className="border-b border-[#e3ddd2] px-5 py-4"><h2 className="font-bold">Movement ledger</h2><p className="mt-1 text-xs text-[#6a7770]">{rows.length} entries in this view</p></div>{incomeLoading || expenseLoading ? <div className="space-y-3 p-5">{[1,2,3,4].map(i => <div key={i} className="h-11 animate-pulse rounded bg-[#e9e2d6]" />)}</div> : incomeError || expenseError ? <div className="p-6 text-sm text-[#93483d]" data-testid="status-cash-flow-error">Cash flow records could not be loaded.</div> : !rows.length ? <div className="p-5"><EmptyState title="No cash movement yet." body="Record income or an expense to see your first movement line." href="/income" action="Record income" /></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f4f0e8] font-mono text-[10px] uppercase tracking-wider text-[#6a7770]"><tr><th className="px-5 py-3 font-normal">Date</th><th className="px-5 py-3 font-normal">Description</th><th className="px-5 py-3 font-normal">Location</th><th className="px-5 py-3 font-normal">Type</th><th className="px-5 py-3 text-right font-normal">Amount</th></tr></thead><tbody className="divide-y divide-[#e9e2d6]">{rows.map(row => <tr key={row.id} data-testid={`row-cash-flow-${row.id}`}><td className="px-5 py-4 text-xs">{date(row.date)}</td><td className="px-5 py-4 font-bold">{row.label}</td><td className="px-5 py-4">{row.location}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 text-xs font-bold ${row.amount >= 0 ? 'text-[#477452]' : 'text-[#9d493d]'}`}>{row.amount >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{row.type}</span></td><td className={`px-5 py-4 text-right font-bold ${row.amount >= 0 ? 'text-[#477452]' : 'text-[#9d493d]'}`}>{row.amount >= 0 ? '+' : '-'}{money(Math.abs(row.amount))}</td></tr>)}</tbody></table></div>}</section></>;
}

function Settings() {
  const { user } = useUser(); const { signOut } = useClerk(); const [saved, setSaved] = useState(false);
  return <><PageIntro eyebrow="Workspace / settings" title="Settings" description="Keep your StayTrack workspace and account details close at hand." /><div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-6 shadow-soft"><div className="flex items-center gap-4 border-b border-[#e9e2d6] pb-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#173f42] text-xl font-bold text-white">{(user?.firstName?.[0] || 'S').toUpperCase()}</div><div><h2 className="font-bold">{user?.fullName || 'StayTrack operator'}</h2><p className="text-sm text-[#6a7770]">{user?.primaryEmailAddress?.emailAddress || 'Account email'}</p></div></div><div className="mt-6 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#48605c]">Workspace name</span><input defaultValue="StayTrack operations" className="w-full rounded-xl border border-[#d9d2c4] bg-[#f4f0e8] px-3 py-2.5 text-sm" data-testid="input-workspace-name" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#48605c]">Reporting currency</span><select defaultValue="PHP" className="w-full rounded-xl border border-[#d9d2c4] bg-[#f4f0e8] px-3 py-2.5 text-sm" data-testid="select-currency"><option value="PHP">PHP — Philippine Peso</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option></select></label><div className="flex justify-end"><PrimaryButton onClick={() => setSaved(true)} testId="button-save-settings">{saved ? 'Saved' : 'Save settings'}</PrimaryButton></div></div></section><section className="rounded-2xl border border-[#d9d2c4] bg-[#fbfaf5] p-6 shadow-soft"><p className="font-mono text-[10px] uppercase tracking-widest text-[#6a7770]">Account</p><h2 className="mt-1 text-lg font-bold">Session</h2><p className="mt-3 text-sm leading-6 text-[#6a7770]">Your workspace is secured by Clerk. Sign out here when you are finished for the day.</p><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#d9d2c4] px-4 py-2.5 text-sm font-bold hover:bg-[#e9e2d6]" data-testid="button-settings-log-out"><LogOut size={16} />Log out</button></section></div></>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function WorkspacePage({ children }: { children: ReactNode }) { return <Protected><AppShell>{children}</AppShell></Protected>; }
function Router() { return <RoutedErrorBoundary><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} /><Route path="/dashboard" component={() => <WorkspacePage><Dashboard /></WorkspacePage>} /><Route path="/locations" component={() => <WorkspacePage><ResourcePage kind="locations" /></WorkspacePage>} /><Route path="/bookings" component={() => <WorkspacePage><ResourcePage kind="bookings" /></WorkspacePage>} /><Route path="/income" component={() => <WorkspacePage><ResourcePage kind="income" /></WorkspacePage>} /><Route path="/expenses" component={() => <WorkspacePage><ResourcePage kind="expenses" /></WorkspacePage>} /><Route path="/maintenance" component={() => <WorkspacePage><ResourcePage kind="maintenance" /></WorkspacePage>} /><Route path="/cash-flow" component={() => <WorkspacePage><CashFlowPage /></WorkspacePage>} /><Route path="/budget-vs-actual" component={() => <WorkspacePage><BudgetActualPage /></WorkspacePage>} />{['/projection','/profitability','/location-analysis','/peak-off-peak','/monthly-summary','/scenario-analysis'].map(path => <Route key={path} path={path} component={() => <WorkspacePage><AnalyticsPage variant={path} /></WorkspacePage>} />)}<Route path="/settings" component={() => <WorkspacePage><Settings /></WorkspacePage>} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>; }

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const nextUser = user?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== nextUser) qc.clear();
      previousUser.current = nextUser;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function ApiClientAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setBaseUrl(apiUrl);
    setAuthTokenGetter(apiUrl ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

function App() {
  return <QueryClientProvider client={queryClient}><ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your operations desk is ready.' } }, signUp: { start: { title: 'Set up your desk', subtitle: 'Start with the place you operate.' } } }}><WouterRouter base={basePath}><ApiClientAuthBridge /><ClerkQueryClientCacheInvalidator /><Router /></WouterRouter></ClerkProvider></QueryClientProvider>;
}

export default App;