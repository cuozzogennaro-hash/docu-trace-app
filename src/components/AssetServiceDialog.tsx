import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

type Props = {
  assetId: string;
  assetName: string;
  area?: "temperatura" | "pulizia" | "attrezzatura";
  onDone?: () => void;
  trigger?: React.ReactNode;
};

export default function AssetServiceDialog({
  assetId,
  assetName,
  area = "attrezzatura",
  onDone,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [createNc, setCreateNc] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return toast.error("Sessione scaduta");
    }

    const { error: e1 } = await supabase
      .from("assets")
      .update({
        out_of_service: true,
        out_of_service_reason: reason || null,
        out_of_service_since: new Date().toISOString(),
      } as any)
      .eq("id", assetId);
    if (e1) {
      setSaving(false);
      return toast.error(e1.message);
    }

    if (createNc) {
      const { error: e2 } = await supabase.from("non_conformities" as any).insert({
        user_id: user.id,
        asset_id: assetId,
        area,
        severity: "medium",
        title: `Attrezzatura fuori servizio: ${assetName}`,
        description: reason || "Dichiarata fuori servizio dal Titolare in attesa di intervento tecnico.",
        status: "open",
      });
      if (e2) {
        setSaving(false);
        return toast.error(`Asset aggiornato, ma errore NC: ${e2.message}`);
      }
    }

    setSaving(false);
    setOpen(false);
    setReason("");
    setCreateNc(false);
    toast.success(
      createNc
        ? "Attrezzatura fuori servizio e non conformità aperta"
        : "Attrezzatura messa fuori servizio",
    );
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Wrench size={14} /> Fuori servizio
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metti fuori servizio: {assetName}</DialogTitle>
          <DialogDescription>
            L'attrezzatura non sarà più richiesta nei controlli (temperatura/sanificazione) finché non la rimetti in servizio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo (opzionale)</Label>
            <Input
              placeholder="Es. Guasto compressore, In attesa di installazione, Non in uso..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border bg-muted/40">
            <Checkbox
              checked={createNc}
              onCheckedChange={(v) => setCreateNc(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="font-medium text-sm">Apri una non conformità</div>
              <div className="text-xs text-muted-foreground">
                Spunta se l'attrezzatura è guasta e attendi un tecnico: verrà aperta una NC tracciabile.
              </div>
            </div>
          </label>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={submit} disabled={saving} className="bg-gradient-primary">
              {saving ? "Salvataggio..." : "Conferma"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function reactivateAsset(assetId: string): Promise<boolean> {
  const { error } = await supabase
    .from("assets")
    .update({
      out_of_service: false,
      out_of_service_reason: null,
      out_of_service_since: null,
    } as any)
    .eq("id", assetId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success("Attrezzatura rimessa in servizio");
  return true;
}