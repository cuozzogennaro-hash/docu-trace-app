import { Card } from "@/components/ui/card";
import { ACTIVITY_LABELS, ActivityProfile, useActivityProfile } from "@/hooks/useActivityProfile";
import { Check } from "lucide-react";
import { toast } from "sonner";

export default function ActivityProfileTab() {
  const { profile, setProfile } = useActivityProfile();

  function pick(p: ActivityProfile) {
    setProfile(p);
    toast.success(`Profilo aggiornato: ${ACTIVITY_LABELS[p].label}`);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="font-display text-lg font-semibold">Profilo attività</h3>
        <p className="text-sm text-muted-foreground">
          Personalizza il menu in base al tuo lavoro. Le voci non pertinenti vengono nascoste dalla sidebar
          (le rotte rimangono accessibili). Le logiche delle etichette non vengono modificate.
        </p>
      </div>

      <div className="space-y-2">
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
    </div>
  );
}