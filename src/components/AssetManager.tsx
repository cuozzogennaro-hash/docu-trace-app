import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export type Asset = {
  id: string;
  name: string;
  asset_type: string;
  target_temp_min: number | null;
  target_temp_max: number | null;
};

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const refresh = async () => {
    const { data } = await supabase.from("assets").select("*").order("name");
    setAssets((data as Asset[]) ?? []);
  };
  useEffect(() => {
    refresh();
  }, []);
  return { assets, refresh };
}

export default function AssetManager({ onChange }: { onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("equipment");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  async function save() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("assets").insert({
      user_id: user.id,
      name,
      asset_type: type,
      target_temp_min: min ? Number(min) : null,
      target_temp_max: max ? Number(max) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Asset creato");
    setName("");
    setMin("");
    setMax("");
    setOpen(false);
    onChange?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus size={16} /> Nuovo asset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Frigo cucina 1" />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fridge">Frigorifero</SelectItem>
                <SelectItem value="freezer">Congelatore</SelectItem>
                <SelectItem value="blast_chiller">Abbattitore</SelectItem>
                <SelectItem value="equipment">Attrezzatura</SelectItem>
                <SelectItem value="surface">Superficie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Temp. min °C</Label>
              <Input type="number" step="0.1" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Temp. max °C</Label>
              <Input type="number" step="0.1" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} disabled={!name} className="w-full bg-gradient-primary">Salva</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}