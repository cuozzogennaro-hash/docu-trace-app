import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Link2, ShieldCheck, UserCheck } from "lucide-react";

export default function ConsulenteLinkCard() {
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [code, setCode] = useState("");
  const [consulenteId, setConsulenteId] = useState<string | null>(null);
  const [studioName, setStudioName] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("consulente_id")
      .eq("id", user.id)
      .maybeSingle();

    const cid = (profile?.consulente_id as string | null) ?? null;
    setConsulenteId(cid);

    if (cid) {
      const { data: partner } = await supabase
        .from("consulenti_partner")
        .select("studio_name, codice_partner")
        .eq("user_id", cid)
        .maybeSingle();
      setStudioName(
        (partner?.studio_name as string | null) ??
          (partner?.codice_partner as string | null) ??
          "Studio HACCP",
      );
    } else {
      setStudioName(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleLink() {
    const clean = code.trim();
    if (!clean) {
      toast.error("Inserisci un codice prima di proseguire");
      return;
    }
    setLinking(true);
    try {
      const { data, error } = await supabase.rpc("link_consulente_by_code", {
        p_code: clean,
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; studio_name?: string | null };
      if (!res?.ok) {
        if (res?.error === "not_found") {
          toast.error("Codice non valido. Verifica con il tuo consulente");
        } else if (res?.error === "empty") {
          toast.error("Inserisci un codice prima di proseguire");
        } else {
          toast.error("Impossibile collegare lo studio. Riprova");
        }
        return;
      }
      toast.success("Studio collegato con successo!");
      setCode("");
      await loadStatus();
    } catch (err: any) {
      toast.error(err?.message ?? "Errore durante il collegamento");
    } finally {
      setLinking(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-5 shadow-soft">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="animate-spin" size={14} />
          Caricamento collegamento consulente…
        </div>
      </Card>
    );
  }

  if (consulenteId) {
    return (
      <Card className="p-5 shadow-soft border border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900/40">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80 font-semibold mb-0.5">
              Account supervisionato
            </p>
            <p className="font-medium text-foreground flex items-center gap-2">
              {studioName || "Studio HACCP"}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Verificato
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Il tuo consulente HACCP può consultare in sola lettura i registri di
              temperature e sanificazioni.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <UserCheck size={20} />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">
            Consulente HACCP Partner
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Opzionale — collega il tuo studio di consulenza per condividere in
            sola lettura i registri obbligatori.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="codice-partner" className="text-sm">
          Codice studio
        </Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="codice-partner"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Inserisci il codice del tuo studio di consulenza"
            disabled={linking}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !linking && code.trim()) handleLink();
            }}
            className="sm:flex-1"
          />
          <Button
            onClick={handleLink}
            disabled={linking || !code.trim()}
            className="gap-2"
          >
            {linking ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Link2 size={16} />
            )}
            Collega Studio
          </Button>
        </div>
      </div>
    </Card>
  );
}