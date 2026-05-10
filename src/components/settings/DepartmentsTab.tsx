import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Building } from "lucide-react";
import { useDepartments } from "@/hooks/useDepartments";

export default function DepartmentsTab() {
  const { departments, hiddenIds, setHidden } = useDepartments();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Reparti</h3>
        <p className="text-sm text-muted-foreground">
          I reparti sono predefiniti per garantire la tracciabilità. Scegli quali rendere visibili nel menu di Ingresso merci.
        </p>
      </div>

      {departments.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nessun reparto disponibile.</Card>
      ) : (
        <div className="space-y-2">
          {departments.map((d) => {
            const visible = !hiddenIds.includes(d.id);
            return (
              <Card key={d.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center text-primary">
                    <Building size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {visible ? "Visibile in Ingresso merci" : "Nascosto in Ingresso merci"}
                    </div>
                  </div>
                </div>
                <Switch checked={visible} onCheckedChange={(v) => setHidden(d.id, !v)} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}