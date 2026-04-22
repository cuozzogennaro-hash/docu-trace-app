import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { Building2, Upload, Loader2, Save } from "lucide-react";

export default function CompanyTab() {
  const { company, reload, loading } = useCompany();
  const [form, setForm] = useState(company);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setForm(company), [company]);

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
          email: form.email,
          phone: form.phone,
          logo_url: form.logo_url,
        },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Impostazioni salvate");
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
      toast.success("Logo caricato — ricordati di salvare");
    } catch (err: any) {
      toast.error(err.message ?? "Errore upload");
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
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-gradient-primary gap-2">
        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        Salva impostazioni
      </Button>
    </Card>
  );
}