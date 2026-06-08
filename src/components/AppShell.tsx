import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { LayoutDashboard, Sparkles, Thermometer, Package, Factory, Users, ShoppingCart, LogOut, ShieldCheck, Archive, Settings, UserCircle2, Menu, Repeat, FileText, ChevronDown, Snowflake, Flame, Droplets, AlertCircle, UtensilsCrossed, CalendarClock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import OperatorSwitcherDialog from "@/components/operator/OperatorSwitcherDialog";
import NotificationBanner from "@/components/NotificationBanner";
import ActivityProfileDialog from "@/components/ActivityProfileDialog";
import { NAV_VISIBILITY, useActivityProfile, productionLabel, recurringLabel, hasKitchen } from "@/hooks/useActivityProfile";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import logoShield from "@/assets/logo-shield.png";

type NavItem = { to: string; icon: any; label: string; end?: boolean };
type NavGroup = { key: string; label: string | null; items: NavItem[] };

function buildAdminGroups(profile: ReturnType<typeof useActivityProfile>["profile"]): NavGroup[] {
  const prodLabel = productionLabel(profile);
  const recLabel = recurringLabel(profile);
  return [
  {
    key: "home",
    label: null,
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true }],
  },
  {
    key: "haccp",
    label: "HACCP",
    items: [
      { to: "/sanificazione", icon: Sparkles, label: "Sanificazione" },
      { to: "/temperature", icon: Thermometer, label: "Temperature" },
    ],
  },
  {
    key: "magazzino",
    label: "Magazzino",
    items: [
      { to: "/ingresso", icon: Package, label: "Ingresso merci" },
      { to: "/produzione", icon: Factory, label: prodLabel },
      { to: "/archivio", icon: Archive, label: "Archivio Generale" },
      { to: "/ricorrenti", icon: Repeat, label: recLabel },
      { to: "/scadenze", icon: CalendarClock, label: "Scadenze" },
    ],
  },
  {
    key: "cucina",
    label: "Cucina",
    items: [
      { to: "/abbattimenti", icon: Snowflake, label: "Abbattimenti" },
      { to: "/mantenimento", icon: Flame, label: "Mantenimento" },
      { to: "/frittura", icon: Droplets, label: "Olio frittura" },
      { to: "/menu", icon: UtensilsCrossed, label: "Menu allergeni" },
    ],
  },
  {
    key: "produzione",
    label: "Produzione & Vendita",
    items: [
      { to: "/clienti", icon: Users, label: "Clienti & Vendite" },
      { to: "/acquisti", icon: ShoppingCart, label: "Lista acquisti" },
    ],
  },
  {
    key: "report",
    label: "Sistema",
    items: [
      { to: "/non-conformita", icon: AlertCircle, label: "Non conformità" },
      { to: "/report", icon: FileText, label: "Report HACCP" },
      { to: "/impostazioni", icon: Settings, label: "Impostazioni" },
      { to: "/contatti", icon: MessageCircle, label: "Contattaci" },
    ],
  },
  ];
}

const operatorNav = [
  { to: "/", icon: LayoutDashboard, label: "I miei compiti", end: true },
  { to: "/contatti", icon: MessageCircle, label: "Contattaci" },
];

export default function AppShell() {
  const { session, signOut, user } = useAuth();
  const { operator, signOut: signOutOperator } = useOperatorSession();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile } = useActivityProfile();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { isSuperAdmin } = useSuperAdmin();

  // Mostra il dialog scelta profilo al primo accesso (titolare loggato, profilo non ancora scelto)
  useEffect(() => {
    if (user && !profile) {
      const t = setTimeout(() => setProfileDialogOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [user, profile]);

  // Auto-seed "Cucina" department for kitchen-enabled profiles
  useEffect(() => {
    if (!user || !hasKitchen(profile)) return;
    (async () => {
      try {
        const { data: existing } = await supabase
          .from("departments")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", "cucina")
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("departments").insert({
            user_id: user.id,
            name: "Cucina",
            sort_order: 50,
          });
        }
      } catch {
        // non-blocking
      }
    })();
  }, [user, profile]);

  const isAdminOperator = operator?.is_admin === true;
  const adminGroups = buildAdminGroups(profile);
  const adminOperatorRestricted = ["/impostazioni", "/acquisti", "/clienti", "/sanificazione", "/temperature", "/report"];

  // Costruisci gruppi filtrati per profilo attività e ruolo operatore
  const visibleRoutes = profile ? NAV_VISIBILITY[profile] : null;
  const groups: NavGroup[] = !operator || isAdminOperator
    ? adminGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => {
            if (operator && isAdminOperator && adminOperatorRestricted.includes(i.to)) return false;
            if (visibleRoutes && !visibleRoutes.has(i.to)) return false;
            return true;
          }),
        }))
        .filter((g) => g.items.length > 0)
    : [{ key: "operator", label: null, items: operatorNav }];

  // La console supervisore è riservata SOLO al titolare loggato direttamente
  // (nessuna sessione operatore attiva, nemmeno admin).
  if (isSuperAdmin && !operator) {
    groups.push({
      key: "supervisor",
      label: "Supervisore",
      items: [{ to: "/admin", icon: ShieldCheck, label: "Dashboard supervisore" }],
    });
  }

  async function handleLogout() {
    signOutOperator();
    if (session) await signOut();
    navigate("/auth");
  }

  const renderNav = (onItemClick?: () => void) => (
    <div className="space-y-3">
      {groups.map((group) => (
        <NavGroupBlock key={group.key} group={group} onItemClick={onItemClick} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-card border-r border-border p-4 shadow-soft overflow-y-auto">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <img src={logoShield} alt="HACCP Trace" className="h-10 w-10 rounded-xl object-contain bg-white" />
          <div>
            <div className="font-display font-bold">HACCP Trace</div>
            <div className="text-xs text-muted-foreground">{t("Autocontrollo")}</div>
          </div>
        </div>
        <nav className="flex-1">{renderNav()}</nav>
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-end pb-1">
            <LanguageSwitcher variant="compact" />
          </div>
          {operator ? (
            <div className="px-2 py-2 rounded-lg bg-muted/60 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <UserCircle2 className="text-primary-foreground" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{operator.name}</div>
                <div className="text-[10px] text-muted-foreground">{operator.is_admin ? t("Amministratore") : t("Operatore")}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { signOutOperator(); if (!session) navigate("/auth"); }} title={t("Esci operatore")}>
                <LogOut size={14} />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setSwitcherOpen(true)} className="w-full justify-start gap-2">
              <UserCircle2 size={16} /> {t("Accesso operatore")}
            </Button>
          )}
          {session && (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3"
            >
              <LogOut size={18} /> {t("Esci titolare")}
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-border px-3 py-3 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("Menu")}>
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
                <img src={logoShield} alt="HACCP Trace" className="h-10 w-10 rounded-xl object-contain bg-white" />
                <div>
                  <div className="font-display font-bold">HACCP Trace</div>
                  <div className="text-xs text-muted-foreground">{t("Autocontrollo")}</div>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-3">
                {renderNav(() => setMobileMenuOpen(false))}
              </nav>
              <div className="px-3 py-3 space-y-2 border-t border-border">
                <div className="flex justify-end pb-1">
                  <LanguageSwitcher variant="compact" />
                </div>
                {operator ? (
                  <div className="px-2 py-2 rounded-lg bg-muted/60 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                      <UserCircle2 className="text-primary-foreground" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{operator.name}</div>
                      <div className="text-[10px] text-muted-foreground">{operator.is_admin ? t("Amministratore") : t("Operatore")}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { signOutOperator(); setMobileMenuOpen(false); if (!session) navigate("/auth"); }} title={t("Esci operatore")}>
                      <LogOut size={14} />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => { setSwitcherOpen(true); setMobileMenuOpen(false); }} className="w-full justify-start gap-2">
                    <UserCircle2 size={16} /> {t("Accesso operatore")}
                  </Button>
                )}
                {session && (
                  <Button
                    variant="ghost"
                    onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    className="w-full justify-start gap-3"
                  >
                    <LogOut size={18} /> {t("Esci titolare")}
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <img src={logoShield} alt="" className="h-7 w-7 rounded-md object-contain" />
          <span className="font-display font-bold text-sm">HACCP Trace</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher variant="icon" />
          {operator ? (
            <Button variant="ghost" size="sm" onClick={() => { signOutOperator(); if (!session) navigate("/auth"); }} className="gap-1.5 px-2">
              <UserCircle2 size={16} className="text-primary" />
              <span className="text-xs font-semibold max-w-[80px] truncate">{operator.name}</span>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSwitcherOpen(true)} title={t("Accesso operatore")}>
              <UserCircle2 size={18} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t("Esci")}>
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <main className="lg:pl-64 pb-8">
        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          <NotificationBanner />
          <Outlet />
        </div>
      </main>

      <OperatorSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
      <ActivityProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} allowDismiss={false} />
    </div>
  );
}

function NavGroupBlock({ group, onItemClick }: { group: NavGroup; onItemClick?: () => void }) {
  const { t } = useTranslation();
  const COLLAPSE_KEY = `haccp.navGroup.${group.key}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  function toggle(v: boolean) {
    setOpen(v);
    try { localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch {}
  }

  const items = (
    <div className="space-y-1">
      {group.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              isActive
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`
          }
        >
          <item.icon size={18} />
          {t(item.label)}
        </NavLink>
      ))}
    </div>
  );

  if (!group.label) return items;

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition">
        <span>{t(group.label)}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{items}</CollapsibleContent>
    </Collapsible>
  );
}