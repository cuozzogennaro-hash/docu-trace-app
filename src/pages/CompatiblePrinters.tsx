import { Link } from "react-router-dom";
import { Printer, CheckCircle2, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CompatiblePrinters() {
  const { t } = useTranslation();

  const tsplBrands = [
    { name: "Xprinter", models: "XP-P3xx, XP- series" },
    { name: "Munbyn", models: "MTP-, MPT-, MUNBYN" },
    { name: "Rongta", models: "RPP series" },
    { name: "Gainscha", models: "GP- series" },
    { name: "HOIN", models: "HM- series" },
    { name: "HPRT", models: "HPRT series" },
    { name: "Generic", models: "POS, PT-, PRT-, PRINTER, BT-, BLE-, BT_SPP, ESC-POS, Thermal" },
  ];

  const phomemoModels = [
    "M02 / M02S",
    "M03",
    "M04",
    "M110",
    "M120",
    "M220",
    "T02",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-bold text-xl">HACCP Trace</div>
          <Link to="/">
            <span className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t("Indietro")}
            </span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <Printer className="h-10 w-10 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            {t("Stampanti compatibili")}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              "HACCP Trace supporta la stampa di etichette termiche tramite Bluetooth Low Energy (BLE). Ecco i modelli attualmente supportati."
            )}
          </p>
        </div>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t("Stampanti ESC/POS e TSPL (etichette termiche)")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "Queste stampanti usano il protocollo ESC/POS o TSPL e supportano etichette di varie dimensioni personalizzabili dall'app."
            )}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tsplBrands.map((b) => (
              <div key={b.name} className="border rounded-lg p-4 bg-card">
                <div className="font-semibold mb-1">{b.name}</div>
                <div className="text-sm text-muted-foreground">{b.models}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t("Stampanti Phomemo M-series (rotolo continuo)")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "Le stampanti Phomemo usano un protocollo raster proprietario e un rotolo continuo largo 48 mm. Supportano la stampa ruotata 90° per sfruttare al meglio l'etichetta."
            )}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {phomemoModels.map((m) => (
              <div key={m} className="border rounded-lg p-4 bg-card text-center">
                <div className="font-semibold">{m}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border rounded-lg p-6 bg-muted/40">
          <h3 className="font-semibold mb-2">{t("Non trovi la tua stampante?")}</h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "La lista viene aggiornata regolarmente. Se la tua stampante supporta BLE ESC/POS o TSPL, probabilmente è già compatibile. Contattaci per verificarlo."
            )}
          </p>
        </section>
      </main>

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} HACCP Trace</div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/termini" className="hover:text-foreground">{t("Termini e condizioni")}</Link>
            <Link to="/privacy" className="hover:text-foreground">{t("Privacy")}</Link>
            <Link to="/rimborsi" className="hover:text-foreground">{t("Rimborsi")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
