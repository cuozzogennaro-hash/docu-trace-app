import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SUPPORT_PHONE = "393451688273"; // +39 345 168 8273
const SUPPORT_DISPLAY = "+39 345 168 8273";

export default function Support() {
  const [message, setMessage] = useState(
    "Ciao, ho bisogno di assistenza con HACCP Pro."
  );

  const waUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;

  return (
    <>
      <PageHeader
        title="Contattaci"
        subtitle="Hai bisogno di aiuto? Scrivici su WhatsApp, ti rispondiamo il prima possibile."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
              <MessageCircle className="text-[#25D366]" size={24} />
            </div>
            <div>
              <div className="font-semibold">Assistenza WhatsApp</div>
              <div className="text-sm text-muted-foreground">{SUPPORT_DISPLAY}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg">Il tuo messaggio</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Descrivi brevemente la richiesta…"
            />
          </div>

          <Button
            asChild
            className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} /> Apri WhatsApp
            </a>
          </Button>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="font-semibold">Altri contatti</div>
          <div className="space-y-3">
            <a
              href={`tel:+${SUPPORT_PHONE}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition"
            >
              <Phone className="text-primary" size={18} />
              <div>
                <div className="text-sm font-medium">Chiamaci</div>
                <div className="text-xs text-muted-foreground">{SUPPORT_DISPLAY}</div>
              </div>
            </a>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Orari di assistenza: Lun–Ven 9:00–18:00. Fuori orario rispondiamo appena possibile.
          </p>
        </Card>
      </div>
    </>
  );
}