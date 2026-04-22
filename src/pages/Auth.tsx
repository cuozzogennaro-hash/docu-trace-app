import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

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
          <div className="flex gap-2 p-1 bg-muted rounded-lg mb-6">
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
        </Card>
      </div>
    </div>
  );
}