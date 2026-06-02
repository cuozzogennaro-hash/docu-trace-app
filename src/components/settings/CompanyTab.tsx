import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { Building2, Upload, Loader2, Save, Trash2, AlertTriangle, Sparkles, UserX } from "lucide-react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CompanyTab() {
  const { company, reload, loading } = useCompany();
  const [form, setForm] = useState(company);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwdOpen, setDeletePwdOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("Sessione non valida");
        return;
      }
      const { error: pwdErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePwd,
      });
      if (pwdErr) {
        toast.error("Password errata");
        return;
      }
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Account eliminato");
      await supabase.auth.signOut();
      setTimeout(() => { window.location.href = "/auth"; }, 600);
    } catch (err: any) {
      toast.error(err?.message ?? "Errore durante l'eliminazione");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => setForm(company), [company]);

  async function resetAllData() {
    setResetting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setResetting(false);
      return;
    }
    const tables = [
      "sales",
      "product_ingredients",
      "products",
      "raw_materials",
      "sanitations",
      "temperatures",
      "task_assignments",
      "clients",
      "suppliers",
      "departments",
      "assets",
      "label_templates",
      "company_settings",
    ] as const;
    try {
      for (const t of tables) {
        const { error } = await supabase.from(t).delete().eq("user_id", user.id);
        if (error) throw error;
      }
      toast.success("Tutti i dati sono stati azzerati");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast.error(err.message ?? "Errore durante l'azzeramento");
    } finally {
      setResetting(false);
    }
  }

  async function verifyAndReset() {
    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error(t("Sessione non valida"));
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPwd,
      });
      if (error) {
        toast.error(t("Password amministratore errata"));
        return;
      }
      setPwdOpen(false);
      setAdminPwd("");
      await resetAllData();
    } finally {
      setVerifying(false);
    }
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setSaving(false);
    const { error } = await supabase
      .from("company_settings")
      .upsert(
        {
          user_id: user.id,
          business_name: form.business_name,
          vat: form.vat,
          address: form.address,
          city: form.city,
          email: form.email,
          phone: form.phone,
          logo_url: form.logo_url,
        },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("Impostazioni salvate"));
    reload();
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success(t("Logo caricato — ricordati di salvare"));
    } catch (err: any) {
      toast.error(err.message ?? t("Errore upload"));
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <Card className="p-6 shadow-soft">
      <div className="flex flex-col lg:flex-row gap-6 mb-6 pb-6 border-b border-border">
        <div className="flex flex-col items-center gap-3">
          <div className="h-32 w-32 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="text-muted-foreground" size={48} />
            )}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            <span className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              {form.logo_url ? "Cambia logo" : "Carica logo"}
            </span>
          </label>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ragione sociale</Label>
            <Input value={form.business_name ?? ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>P.IVA / C.F.</Label>
            <Input value={form.vat ?? ""} onChange={(e) => setForm({ ...form, vat: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefono</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Indirizzo</Label>
            <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Città</Label>
            <Input
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Es. 80100 Napoli (NA)"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary gap-2">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Salva impostazioni
        </Button>

        <Button variant="outline" className="gap-2" onClick={() => setWizardOpen(true)}>
          <Sparkles size={16} /> Riavvia tour guidato
        </Button>

        <OnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCompleted={() => { reload(); }} />

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={resetting} className="gap-2">
              {resetting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Azzera tutti i dati
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" size={20} />
                Azzerare tutti i dati?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Stai per <strong>eliminare definitivamente tutti i dati dell'app</strong>:
                anagrafica azienda, reparti, attrezzature, materie prime, prodotti, ingredienti,
                vendite, clienti, fornitori, rilevazioni di temperatura e sanificazione, etichette
                e attività assegnate.
                <br /><br />
                <strong>Gli operatori e i loro PIN verranno mantenuti.</strong>
                <br /><br />
                L'app tornerà come al primo accesso. Questa azione <strong>non può essere annullata</strong>.
                <br /><br />
                Per procedere ti verrà richiesta la <strong>password amministratore</strong>.
                Puoi annullare in qualsiasi momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  setConfirmOpen(false);
                  setAdminPwd("");
                  setPwdOpen(true);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Procedi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={pwdOpen} onOpenChange={(v) => { setPwdOpen(v); if (!v) setAdminPwd(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" size={20} />
                Conferma password amministratore
              </DialogTitle>
              <DialogDescription>
                Inserisci la password del tuo account amministratore per confermare
                l'azzeramento di tutti i dati.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                autoFocus
                value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adminPwd && !verifying && verifyAndReset()}
                placeholder="••••••••"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPwdOpen(false); setAdminPwd(""); }}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                disabled={!adminPwd || verifying || resetting}
                onClick={verifyAndReset}
                className="gap-2"
              >
                {(verifying || resetting) ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Conferma e azzera
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8 pt-6 border-t border-destructive/30">
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
          <AlertTriangle size={16} /> Zona pericolosa
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Eliminando l'account verranno cancellati definitivamente tutti i tuoi dati, gli operatori e l'abbonamento. L'azione è irreversibile.
        </p>
        <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeleteOpen(true)}>
          <UserX size={16} /> Elimina account
        </Button>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" size={20} />
                Eliminare definitivamente l'account?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Verranno cancellati: account, anagrafica azienda, operatori, attrezzature,
                materie prime, prodotti, registrazioni HACCP, etichette, abbonamento e ogni
                altro dato collegato. L'operazione <strong>non può essere annullata</strong>.
                <br /><br />
                Per procedere ti verrà richiesta la password.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteOpen(false);
                  setDeletePwd("");
                  setDeletePwdOpen(true);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Procedi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={deletePwdOpen} onOpenChange={(v) => { setDeletePwdOpen(v); if (!v) setDeletePwd(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" size={20} />
                Conferma password
              </DialogTitle>
              <DialogDescription>
                Inserisci la password del tuo account per eliminarlo definitivamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                autoFocus
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && deletePwd && !deleting && deleteAccount()}
                placeholder="••••••••"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeletePwdOpen(false); setDeletePwd(""); }}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                disabled={!deletePwd || deleting}
                onClick={deleteAccount}
                className="gap-2"
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : <UserX size={16} />}
                Elimina account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}