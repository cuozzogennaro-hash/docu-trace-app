import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { LayoutDashboard, Sparkles, Thermometer, Package, Factory, Users, ShoppingCart, LogOut, ShieldCheck, Archive, Settings, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorSwitcherDialog from "@/components/operator/OperatorSwitcherDialog";

const adminNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/sanificazione", icon: Sparkles, label: "Sanificazione" },
  { to: "/temperature", icon: Thermometer, label: "Temperature" },
  { to: "/ingresso", icon: Package, label: "Ingresso merci" },
  { to: "/produzione", icon: Factory, label: "Produzione" },
  { to: "/clienti", icon: Users, label: "Clienti & Vendite" },
  { to: "/acquisti", icon: ShoppingCart, label: "Lista acquisti" },
  { to: "/archivio", icon: Archive, label: "Archivio" },
  { to: "/impostazioni", icon: Settings, label: "Impostazioni" },
];

const operatorNav = [
  { to: "/", icon: LayoutDashboard, label: "I miei compiti", end: true },
];

export default function AppShell() {
  const { session, signOut } = useAuth();
  const { operator, signOut: signOutOperator } = useOperatorSession();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const nav = operator ? operatorNav : adminNav;

  async function handleLogout() {
    signOutOperator();
    if (session) await signOut();
    navigate("/auth");
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-card border-r border-border p-4 shadow-soft">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <ShieldCheck className="text-primary-foreground" size={20} />
          </div>
          <div>
            <div className="font-display font-bold">HACCP Pro</div>
            <div className="text-xs text-muted-foreground">Autocontrollo</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 pt-2 border-t border-border">
          {operator ? (
            <div className="px-2 py-2 rounded-lg bg-muted/60 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <UserCircle2 className="text-primary-foreground" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{operator.name}</div>
                <div className="text-[10px] text-muted-foreground">Operatore</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { signOutOperator(); if (!session) navigate("/auth"); }} title="Esci operatore">
                <LogOut size={14} />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setSwitcherOpen(true)} className="w-full justify-start gap-2">
              <UserCircle2 size={16} /> Accesso operatore
            </Button>
          )}
          {session && (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3"
            >
              <LogOut size={18} /> Esci titolare
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center">
            <ShieldCheck className="text-primary-foreground" size={18} />
          </div>
          <span className="font-display font-bold">HACCP Pro</span>
        </div>
        <div className="flex items-center gap-1">
          {operator ? (
            <Button variant="ghost" size="sm" onClick={signOutOperator} className="gap-1.5 px-2">
              <UserCircle2 size={16} className="text-primary" />
              <span className="text-xs font-semibold max-w-[80px] truncate">{operator.name}</span>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSwitcherOpen(true)} title="Accesso operatore">
              <UserCircle2 size={18} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <main className="lg:pl-64 pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur border-t border-border">
        <div className={`grid gap-1 px-2 py-2`} style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, minmax(0, 1fr))` }}>
          {nav.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${isActive ? "bg-primary/15" : ""}`}>
                    <item.icon size={20} />
                  </div>
                  <span className="leading-none">{item.label.split(" ")[0]}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <OperatorSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}