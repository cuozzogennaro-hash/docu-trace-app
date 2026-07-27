import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BadgeCheck, FileDown, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { generateHaccpDeclarationPdf } from "@/lib/haccpDeclaration";

export default function HaccpDeclarationCard() {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [legalRep, setLegalRep] = useState("");
  const [sector, setSector] = useState("");
  const [province, setProvince] = useState("");
  const [hygieneManager, setHygieneManager] = useState("");
  const [recipient, setRecipient] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pest, setPest] = useState(true);
  const [trace, setTrace] = useState(true);
  const [allergens, setAllergens] = useState(true);
  const [water, setWater] = useState(true);
  const [suppliers, setSuppliers] = useState(true);

  async function download() {
    setBusy(true);
    try {
      await generateHaccpDeclarationPdf(company, {
        legalRep,
        sector,
        province,
        hygieneManager,
        recipient,
        place,
        date,
        includePestControl: pest,
        includeTraceability: trace,
        includeAllergens: allergens,
        includeWater: water,
        includeSupplierChecks: suppliers,
      });
      toast.success("Dichiarazione generata");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore nella generazione");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 mb-6 shadow-soft border-emerald-500/30">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
          <BadgeCheck className="text-primary-foreground" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold">Dichiarazione di Conformità HACCP</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Certificato da consegnare ai clienti B2B: attesta il piano di autocontrollo HACCP, la formazione del
            personale, la rintracciabilità dei lotti e la gestione degli allergeni. Precompilato con i dati aziendali.
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={download} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
              Scarica PDF
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOpen((v) => !v)}>
              <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
              {open ? "Nascondi dettagli" : "Personalizza"}
            </Button>
          </div>

          {open && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Legale rappresentante</Label>
                  <Input value={legalRep} onChange={(e) => setLegalRep(e.target.value)} placeholder="Nome e cognome" />
                </div>
                <div className="space-y-1.5">
                  <Label>Settore di attività</Label>
                  <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Es. Gastronomia / Macelleria" />
                </div>
                <div className="space-y-1.5">
                  <Label>Provincia</Label>
                  <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Es. MI" />
                </div>
                <div className="space-y-1.5">
                  <Label>Responsabile autocontrollo</Label>
                  <Input value={hygieneManager} onChange={(e) => setHygieneManager(e.target.value)} placeholder="Nome e cognome" />
                </div>
                <div className="space-y-1.5">
                  <Label>Destinatario (cliente B2B)</Label>
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Ragione sociale cliente" />
                </div>
                <div className="space-y-1.5">
                  <Label>Luogo</Label>
                  <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={company.city ?? "Città"} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Clausole da includere</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ["Rintracciabilità lotti (Reg. CE 178/2002)", trace, setTrace],
                    ["Gestione allergeni (Reg. UE 1169/2011)", allergens, setAllergens],
                    ["Qualifica e controllo fornitori", suppliers, setSuppliers],
                    ["Sanificazione e lotta infestanti", pest, setPest],
                    ["Potabilità dell'acqua", water, setWater],
                  ] as const).map(([label, value, set]) => (
                    <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={value} onCheckedChange={(c) => (set as any)(!!c)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
