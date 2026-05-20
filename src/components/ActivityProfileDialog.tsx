import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { ACTIVITY_LABELS, ActivityProfile, useActivityProfile } from "@/hooks/useActivityProfile";
import { Check } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; allowDismiss?: boolean };

export default function ActivityProfileDialog({ open, onOpenChange, allowDismiss = true }: Props) {
  const { profile, setProfile } = useActivityProfile();

  function pick(p: ActivityProfile) {
    setProfile(p);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !allowDismiss) return; onOpenChange(v); }}>
      <DialogContent className="max-w-xl" onPointerDownOutside={(e) => { if (!allowDismiss) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (!allowDismiss) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Che tipo di attività hai?</DialogTitle>
          <DialogDescription>
            Personalizziamo il menu in base al tuo lavoro. Potrai cambiare in qualsiasi momento da Impostazioni › Profilo attività.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {(Object.keys(ACTIVITY_LABELS) as ActivityProfile[]).map((key) => {
            const meta = ACTIVITY_LABELS[key];
            const active = profile === key;
            return (
              <Card
                key={key}
                onClick={() => pick(key)}
                className={`p-4 cursor-pointer transition hover:border-primary hover:shadow-soft ${active ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl shrink-0">{meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.description}</div>
                  </div>
                  {active && <Check size={18} className="text-primary shrink-0" />}
                </div>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}