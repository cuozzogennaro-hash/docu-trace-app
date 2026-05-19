import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hashPin } from "@/hooks/useOperators";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Layers, Refrigerator, UserPlus, ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void; onCompleted: () => void };

const STEPS = [
  { key: "company", title: "Dati azienda", icon: Building2 },
  { key: "departments", title: "Reparti", icon: Layers },
  { key: "assets", title: "Attrezzature", icon: Refrigerator },
  { key: "operators", title: "Operatori", icon: UserPlus },
] as const;

type DraftAsset = { name: string; asset_type: "fridge" | "freezer" | "equipment" | "area"; target_temp_min: string; target_temp_max: string; cleaning_product: string };
type DraftOperator = { name: string; role: string; pin: string; is_admin: boolean };

export default function OnboardingWizard({ open, onClose, onCompleted }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — company
  const [company, setCompany] = useState({ business_name: "", vat: "", address: "", city: "", phone: "", email: "" });

  // Step 2 — departments
  const [departments, setDepartments] = useState<string[]>(["Macelleria", "Salumeria", "Ortofrutta"]);
  const [newDept, setNewDept] = useState("");

  // Step 3 — assets
  const [assets, setAssets] = useState<DraftAsset[]>([
    { name: "Frigo banco", asset_type: "fridge", target_temp_min: "0", target_temp_max: "4", cleaning_product: "" },
  ]);

  // Step 4 — operators
  const [operators, setOperators] = useState<DraftOperator[]>([
    { name: "", role: "", pin: "", is_admin: true },
  ]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [c, d] = await Promise.all([
        supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("departments").select("name").eq("user_id", user.id).order("sort_order"),
      ]);
      if (c.data) {
        setCompany({
          business_name: c.data.business_name ?? "",
          vat: c.data.vat ?? "",
          address: c.data.address ?? "",
          city: c.data.city ?? "",
          phone: c.data.phone ?? "",
          email: c.data.email ?? "",
        });
      }
      if (d.data && d.data.length > 0) {
        setDepartments(d.data.map((r: any) => r.name));
      }
    })();
  }, [open, user]);

  function next() { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function prev() { setStep((s) => Math.max(0, s - 1)); }

  async function saveCompany() {
    if (!user) return false;
    if (!company.business_name.trim()) { toast.error("Inserisci almeno la ragione sociale"); return false; }
    setBusy(true);
    const { data: existing } = await supabase.from("company_settings").select("id").eq("user_id", user.id).maybeSingle();
    const payload = {
      user_id: user.id,
      business_name: company.business_name.trim() || null,
      vat: company.vat.trim() || null,
      address: company.address.trim() || null,
      city: company.city.trim() || null,
      phone: company.phone.trim() || null,
      email: company.email.trim() || null,
    };
    const res = existing
      ? await supabase.from("company_settings").update(payload).eq("id", existing.id)
      : await supabase.from("company_settings").insert(payload);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return false; }
    return true;
  }

  async function saveDepartments() {
    if (!user) return false;
    const clean = Array.from(new Set(departments.map((d) => d.trim()).filter(Boolean)));
    if (clean.length === 0) { toast.error("Aggiungi almeno un reparto"); return false; }
    setBusy(true);
    const { data: existing } = await supabase.from("departments").select("name").eq("user_id", user.id);
    const existingNames = new Set((existing ?? []).map((r: any) => r.name));
    const toInsert = clean
      .filter((n) => !existingNames.has(n))
      .map((name, i) => ({ user_id: user.id, name, sort_order: i }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("departments").insert(toInsert);
      if (error) { setBusy(false); toast.error(error.message); return false; }
    }
    setBusy(false);
    return true;
  }

  async function saveAssets() {
    if (!user) return false;
    const clean = assets.filter((a) => a.name.trim());
    if (clean.length === 0) return true; // skippable
    setBusy(true);
    const rows = clean.map((a) => ({
      user_id: user.id,
      name: a.name.trim(),
      asset_type: a.asset_type,
      target_temp_min: a.target_temp_min ? Number(a.target_temp_min) : null,
      target_temp_max: a.target_temp_max ? Number(a.target_temp_max) : null,
      cleaning_product: a.cleaning_product.trim() || null,
    }));
    const { error } = await supabase.from("assets").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  }

  async function saveOperators() {
    if (!user) return false;
    const clean = operators.filter((o) => o.name.trim() && o.pin.trim().length >= 4);
    if (clean.length === 0) {
      toast.error("Aggiungi almeno un operatore con PIN di almeno 4 cifre");
      return false;
    }
    setBusy(true);
    for (const o of clean) {
      const pin_hash = await hashPin(o.pin, user.id);
      const { error } = await supabase.from("operators").insert({
        user_id: user.id,
        name: o.name.trim(),
        role: o.role.trim() || null,
        pin_hash,
        is_admin: o.is_admin,
        login_handle: "",
      });
      if (error) { setBusy(false); toast.error(`${o.name}: ${error.message}`); return false; }
    }
    setBusy(false);
    return true;
  }

  async function handleNext() {
    let ok = false;
    if (step === 0) ok = await saveCompany();
    else if (step === 1) ok = await saveDepartments();
    else if (step === 2) ok = await saveAssets();
    else if (step === 3) {
      ok = await saveOperators();
      if (ok) await finish();
      return;
    }
    if (ok) next();
  }

  async function finish() {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
    toast.success("Configurazione completata! Benvenuto.");
    onCompleted();
    onClose();
  }

  async function skipAll() {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
    onCompleted();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && skipAll()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            Configurazione iniziale
          </DialogTitle>
          <DialogDescription>
            Bastano pochi minuti per preparare l'app al primo utilizzo. Potrai modificare tutto in seguito dalle Impostazioni.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 my-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg flex-1 min-w-0 ${active ? "bg-primary/10 text-primary" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                    {done ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span className="text-xs font-medium truncate hidden sm:inline">{s.title}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="py-2 space-y-3">
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Ragione sociale *</Label>
                <Input value={company.business_name} onChange={(e) => setCompany({ ...company, business_name: e.target.value })} placeholder="Macelleria Rossi S.r.l." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>P.IVA</Label>
                  <Input value={company.vat} onChange={(e) => setCompany({ ...company, vat: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Indirizzo</Label>
                <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} placeholder="Via Roma, 12" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Città</Label>
                  <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Il logo potrai caricarlo successivamente da Impostazioni › Azienda.</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Sono già stati suggeriti tre reparti. Rimuovi quelli che non ti servono o aggiungine di nuovi.</p>
              <div className="space-y-2">
                {departments.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={d} onChange={(e) => setDepartments(departments.map((x, j) => j === i ? e.target.value : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setDepartments(departments.filter((_, j) => j !== i))}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Aggiungi reparto…" onKeyDown={(e) => {
                  if (e.key === "Enter" && newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(""); }
                }} />
                <Button variant="outline" onClick={() => { if (newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(""); } }}>
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Aggiungi frigoriferi, banchi, celle o aree. Per i frigo indica il range di temperatura consigliato. Puoi saltare e farlo dopo.</p>
              {assets.map((a, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input value={a.name} onChange={(e) => setAssets(assets.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Es. Frigo banco macelleria" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={a.asset_type} onValueChange={(v: any) => setAssets(assets.map((x, j) => j === i ? { ...x, asset_type: v } : x))}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fridge">Frigo</SelectItem>
                          <SelectItem value="freezer">Congelatore</SelectItem>
                          <SelectItem value="equipment">Attrezzatura</SelectItem>
                          <SelectItem value="area">Area</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setAssets(assets.filter((_, j) => j !== i))}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                  {(a.asset_type === "fridge" || a.asset_type === "freezer") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Temp. min (°C)</Label>
                        <Input type="number" step="0.1" value={a.target_temp_min} onChange={(e) => setAssets(assets.map((x, j) => j === i ? { ...x, target_temp_min: e.target.value } : x))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Temp. max (°C)</Label>
                        <Input type="number" step="0.1" value={a.target_temp_max} onChange={(e) => setAssets(assets.map((x, j) => j === i ? { ...x, target_temp_max: e.target.value } : x))} />
                      </div>
                    </div>
                  )}
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={() => setAssets([...assets, { name: "", asset_type: "fridge", target_temp_min: "0", target_temp_max: "4", cleaning_product: "" }])}>
                <Plus size={14} className="mr-1" /> Aggiungi attrezzatura
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Crea almeno un operatore con PIN. Gli operatori contrassegnati come <strong>Admin</strong> potranno accedere a tutte le funzioni gestionali.</p>
              {operators.map((o, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input value={o.name} onChange={(e) => setOperators(operators.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Mario Rossi" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mansione</Label>
                      <Input value={o.role} onChange={(e) => setOperators(operators.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="Banco carni" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">PIN (min. 4 cifre) *</Label>
                      <Input type="password" inputMode="numeric" maxLength={6} value={o.pin}
                        onChange={(e) => setOperators(operators.map((x, j) => j === i ? { ...x, pin: e.target.value.replace(/\D/g, "") } : x))}
                        className="font-mono tracking-widest" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer pb-2">
                      <input type="checkbox" checked={o.is_admin} onChange={(e) => setOperators(operators.map((x, j) => j === i ? { ...x, is_admin: e.target.checked } : x))} />
                      Admin
                    </label>
                    <Button size="icon" variant="ghost" onClick={() => setOperators(operators.filter((_, j) => j !== i))}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={() => setOperators([...operators, { name: "", role: "", pin: "", is_admin: false }])}>
                <Plus size={14} className="mr-1" /> Aggiungi operatore
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={prev} disabled={busy}>
                <ArrowLeft size={16} className="mr-1" /> Indietro
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={skipAll} disabled={busy}>Salta tutto</Button>
          </div>
          <Button onClick={handleNext} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="animate-spin mr-1" size={16} /> : null}
            {step === STEPS.length - 1 ? "Completa" : "Avanti"}
            {step !== STEPS.length - 1 && <ArrowRight size={16} className="ml-1" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}