import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SUPPORT_PHONE = "393451688273"; // +39 345 168 8273
const SUPPORT_DISPLAY = "+39 345 168 8273";
const EMAIL_BUGS = "Cuozzogennaro@gmail.com";

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
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="text-primary" size={24} />
            </div>
            <div>
              <div className="font-semibold">Segnalazioni &amp; richieste</div>
              <div className="text-sm text-muted-foreground">Email</div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Scrivici per segnalare un bug o proporre una nuova funzionalità. Rispondiamo in 1-2 giorni lavorativi.
          </p>

          <Button asChild variant="outline" className="w-full">
            <a href={`mailto:${EMAIL_BUGS}?subject=HACCP%20Pro%20-%20Segnalazione`}>
              <Mail size={18} /> Scrivi a Cuozzogennaro@gmail.com
            </a>
          </Button>
        </Card>
      </div>
    </>
  );
}
