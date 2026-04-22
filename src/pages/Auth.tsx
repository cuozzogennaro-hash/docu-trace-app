import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Building2, UserCircle2, AtSign, Loader2 } from "lucide-react";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const { operator, signIn: signInOperator } = useOperatorSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  // operator login fields
  const [handle, setHandle] = useState("");
  const [opPin, setOpPin] = useState("");
  const [opBusy, setOpBusy] = useState(false);

  if (!loading && (session || operator)) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { business_name: businessName },
          },
        });
        if (error) throw error;
        toast.success("Account creato! Controlla l'email per confermare.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function operatorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || opPin.length < 4) {
      return toast.error("Inserisci nome utente e PIN");
    }
    setOpBusy(true);
    try {
      const { data, error } = await supabase.rpc("operator_login", {
        p_handle: handle.trim().toLowerCase(),
        p_pin: opPin,
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; operator_id?: string; name?: string; role?: string | null };
      if (!res.ok) {
        if (res.error === "not_found") toast.error("Nome utente non trovato");
        else toast.error("PIN errato");
        setOpPin("");
        return;
      }
      signInOperator({ id: res.operator_id!, name: res.name!, role: res.role ?? null });
      toast.success(`Benvenuto ${res.name}`);
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setOpBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
            <ShieldCheck className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">HACCP Pro</h1>
            <p className="text-xs text-muted-foreground">Autocontrollo alimentare smart</p>
          </div>
        </div>
        <Card className="p-6 shadow-elevated">
          <Tabs defaultValue="operator" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="operator" className="gap-2"><UserCircle2 size={16} /> Operatore</TabsTrigger>
              <TabsTrigger value="admin" className="gap-2"><Building2 size={16} /> Titolare</TabsTrigger>
            </TabsList>

            <TabsContent value="operator">
              <form onSubmit={operatorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><AtSign size={14} /> Nome utente</Label>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase())}
                    placeholder="mario-bistrotdamario"
                    className="font-mono"
                    autoCapitalize="none"
                    autoComplete="username"
                    maxLength={60}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Te lo fornisce il titolare della tua attività.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={opPin}
                    onChange={(e) => setOpPin(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="••••"
                    required
                  />
                </div>
                <Button type="submit" disabled={opBusy} className="w-full bg-gradient-primary">
                  {opBusy ? <Loader2 className="animate-spin" size={16} /> : "Accedi come operatore"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <div className="flex gap-2 p-1 bg-muted rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                    mode === "signin" ? "bg-card shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  Accedi
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                    mode === "signup" ? "bg-card shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  Registrati
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label>Nome attività</Label>
                    <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Pizzeria Da Mario" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                  {busy ? "Attendi…" : mode === "signin" ? "Accedi" : "Crea account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}