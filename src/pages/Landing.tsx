import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Thermometer, ClipboardList, ShieldCheck, Archive, FileText } from "lucide-react";
import logoShield from "@/assets/logo-shield.png";

export default function Landing() {
  const { session, loading } = useAuth();
  const { operator } = useOperatorSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  // Utenti già autenticati → vanno alla loro dashboard
  if (session || operator) return <Navigate to="/app" replace />;

  const features = [
    { icon: Thermometer, title: "Temperature", desc: "Registro temperature frigo, freezer, abbattitori e cottura." },
    { icon: ClipboardList, title: "Sanificazione", desc: "Piani di pulizia e sanificazione con tracciamento attività." },
    { icon: ShieldCheck, title: "Non conformità", desc: "Gestione non conformità e azioni correttive." },
    { icon: Archive, title: "Tracciabilità", desc: "Carico materie prime, lotti e scadenze sempre sotto controllo." },
    { icon: FileText, title: "Report HACCP", desc: "Esporta report completi pronti per le ispezioni." },
    { icon: CheckCircle2, title: "Multi-operatore", desc: "Ogni operatore ha il suo PIN e le proprie registrazioni." },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoShield} alt="HACCP Trace" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-xl">HACCP Trace</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Accedi</Button></Link>
            <Link to="/auth"><Button>Inizia ora</Button></Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          HACCP digitale per la tua attività alimentare
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Sostituisci i registri cartacei con un'app semplice e conforme.
          Temperature, sanificazione, tracciabilità e report sempre a portata di mano.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/auth"><Button size="lg">Prova HACCP Trace</Button></Link>
          <Link to="/abbonamento"><Button size="lg" variant="outline">Vedi i piani</Button></Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Tutto quello che serve per essere a norma</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="border rounded-lg p-6">
              <f.icon className="h-8 w-8 mb-3 text-primary" />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Piani semplici e trasparenti</h2>
        <p className="text-muted-foreground mb-8">
          Nessuna installazione, nessun hardware. Funziona da smartphone, tablet e computer.
        </p>
        <Link to="/abbonamento"><Button size="lg">Scopri i prezzi</Button></Link>
      </section>

      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} HACCP Trace</div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/termini" className="hover:text-foreground">Termini e condizioni</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/rimborsi" className="hover:text-foreground">Rimborsi</Link>
            <Link to="/abbonamento" className="hover:text-foreground">Abbonamento</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}