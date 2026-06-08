import LegalBackHeader from "@/components/LegalBackHeader";
import { useTranslation } from "react-i18next";

export default function RefundPage() {
  const { i18n } = useTranslation();
  const isEN = i18n.language?.startsWith("en");

  if (isEN) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
        <LegalBackHeader />
        <h1>Refund Policy</h1>
        <p><strong>Seller:</strong> Gennaro Cuozzo, sole proprietor</p>

        <h2>30-day money-back guarantee</h2>
        <p>
          We offer a <strong>30-day</strong> money-back guarantee. If you are not satisfied with your
          purchase, you can request a full refund within 30 days of the order date.
        </p>

        <h2>Free trial period</h2>
        <p>
          The HACCP Trace subscription includes a 30-day free trial. No charge is made during the trial:
          you can cancel at any time before the end of the trial at no cost.
        </p>

        <h2>How to request a refund</h2>
        <p>
          Payments are handled by our partner <strong>Paddle.com</strong> (Merchant of Record).
          To request a refund, visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
          using the email address you used at purchase, or contact our support.
        </p>
        <p>
          Refunds are processed back to the original payment method. Crediting times depend on your
          card network (typically 5–10 business days).
        </p>

        <h2>Monthly renewals</h2>
        <p>
          By cancelling your subscription from the customer portal, no further charges will be made.
          Access to the Service remains active until the end of the period already paid for.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <LegalBackHeader />
      <h1>Politica di rimborso</h1>
      <p><strong>Venditore:</strong> Gennaro Cuozzo, ditta individuale</p>

      <h2>Garanzia "soddisfatti o rimborsati" — 30 giorni</h2>
      <p>
        Offriamo una garanzia di rimborso di <strong>30 giorni</strong>. Se non sei soddisfatto
        del tuo acquisto, puoi richiedere il rimborso integrale entro 30 giorni dalla data dell'ordine.
      </p>

      <h2>Periodo di prova gratuita</h2>
      <p>
        L'abbonamento HACCP Trace include 30 giorni di prova gratuita. Nessun addebito viene effettuato
        durante la prova: puoi annullare in qualsiasi momento prima del termine senza alcun costo.
      </p>

      <h2>Come richiedere un rimborso</h2>
      <p>
        I pagamenti sono gestiti dal nostro partner <strong>Paddle.com</strong> (Merchant of Record).
        Per richiedere un rimborso visita <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
        utilizzando l'email con cui hai effettuato l'acquisto, oppure contatta il nostro supporto.
      </p>
      <p>
        I rimborsi vengono processati direttamente sullo strumento di pagamento utilizzato per l'acquisto.
        I tempi di accredito dipendono dal circuito bancario (in genere 5–10 giorni lavorativi).
      </p>

      <h2>Rinnovi mensili</h2>
      <p>
        Annullando l'abbonamento dal portale clienti, non saranno effettuati ulteriori addebiti.
        L'accesso al Servizio rimane attivo fino al termine del periodo già pagato.
      </p>
    </div>
  );
}