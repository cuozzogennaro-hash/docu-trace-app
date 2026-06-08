import LegalBackHeader from "@/components/LegalBackHeader";
import { useTranslation } from "react-i18next";

export default function TermsPage() {
  const { i18n } = useTranslation();
  const isEN = i18n.language?.startsWith("en");
  const locale = isEN ? "en-GB" : "it-IT";
  const today = new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  if (isEN) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
        <LegalBackHeader />
        <h1>Terms and Conditions</h1>
        <p><strong>Last updated:</strong> {today}</p>

        <h2>1. Seller</h2>
        <p>
          The HACCP Trace service (the "Service") is provided by
          <strong> Gennaro Cuozzo, sole proprietor</strong> ("we", the "Seller").
          By using the Service, you fully accept these Terms.
        </p>

        <h2>2. Acceptance</h2>
        <p>
          Continued use of the Service constitutes acceptance of these Terms. The user declares
          to have the legal capacity to bind themselves or the organisation on whose behalf they act.
        </p>

        <h2>3. Description of the Service</h2>
        <p>
          HACCP Trace is a SaaS application for managing food self-monitoring: temperature logging,
          sanitation, blast chilling, production, labels, HACCP reports and audit-ready packages
          for inspections.
        </p>

        <h2>4. Account and credentials</h2>
        <p>
          The user is responsible for keeping their credentials confidential (email, password,
          operator PINs) and for any activity carried out through their account. Information provided
          must be accurate and kept up to date.
        </p>

        <h2>5. Permitted use and prohibitions</h2>
        <p>The user agrees not to:</p>
        <ul>
          <li>use the Service for unlawful purposes, fraud or spam;</li>
          <li>infringe third-party intellectual property rights;</li>
          <li>interfere with the security of the Service (malware, probing, unauthorised scraping);</li>
          <li>reverse engineer, decompile, resell or redistribute the Service;</li>
          <li>circumvent technical or plan limits.</li>
        </ul>

        <h2>6. Licence</h2>
        <p>
          A limited, non-exclusive and non-transferable licence is granted to use the Service
          within the limits of the chosen plan. The Seller retains full ownership of the Service,
          software, documentation and trademarks.
        </p>

        <h2>7. User content</h2>
        <p>
          The user retains ownership of the data and content entered into the Service and grants
          the Seller a limited licence necessary to host and process such content for the sole
          purpose of providing the Service.
        </p>

        <h2>8. Payments and subscription</h2>
        <p>
          The order process is handled by our online reseller <strong>Paddle.com</strong>.
          Paddle.com is the <em>Merchant of Record</em> for all orders. Paddle manages the commercial
          aspects of checkout, invoicing, taxes, renewals and refunds.
          Buyer terms are available here: <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle Buyer Terms</a>.
        </p>
        <p>
          The HACCP Trace subscription is €19.99 per month, with a 30-day free trial. At the end
          of the trial, the first month is automatically charged unless cancelled. Renewal is
          monthly until cancellation.
        </p>

        <h2>9. Cancellation</h2>
        <p>
          The user may cancel the subscription at any time from the customer portal. Access remains
          active until the end of the period already paid for; no pro-rata refund is provided for
          the unused period, except as set out in the Refund Policy.
        </p>

        <h2>10. Suspension and termination</h2>
        <p>The Seller may suspend or terminate access in the event of:</p>
        <ul>
          <li>material breach of the Terms;</li>
          <li>non-payment;</li>
          <li>security or fraud risk;</li>
          <li>repeated or serious policy violations.</li>
        </ul>
        <p>
          Upon termination, the user will have a reasonable period to export their data, after
          which the data may be deleted.
        </p>

        <h2>11. Warranties and limitations</h2>
        <p>
          The Service is provided "as is". To the maximum extent permitted by law, we disclaim all
          implied warranties of merchantability or fitness for a particular purpose. We do not
          warrant uninterrupted or error-free operation.
        </p>
        <p>
          The Seller's aggregate liability shall not exceed the amount of fees paid in the 12 months
          preceding the event giving rise to the claim. Liability for indirect, consequential damages,
          loss of profits, data or goodwill is excluded. Liability for fraud, wilful misconduct, gross
          negligence, death or personal injury is excluded only within the limits of the law.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          The user shall indemnify the Seller against any third-party claim arising from uploaded
          content, unlawful use of the Service or breach of these Terms.
        </p>

        <h2>13. Changes</h2>
        <p>
          These Terms may be updated. Changes will be communicated by email or through a notice
          in the Service with reasonable advance notice.
        </p>

        <h2>14. Governing law and jurisdiction</h2>
        <p>
          These Terms are governed by Italian law. For any dispute, the competent court shall be
          that of the consumer's place of residence if the user is a consumer, otherwise the
          competent court under ordinary procedural rules.
        </p>

        <h2>15. Contact</h2>
        <p>
          For any request relating to these Terms, contact the Seller via the details shown in the
          app or in purchase communications.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <LegalBackHeader />
      <h1>Termini e Condizioni</h1>
      <p><strong>Ultimo aggiornamento:</strong> {today}</p>

      <h2>1. Venditore</h2>
      <p>
        Il servizio HACCP Trace (di seguito "il Servizio") è fornito da
        <strong> Gennaro Cuozzo, ditta individuale</strong> (di seguito "noi", "il Venditore").
        Utilizzando il Servizio l'utente accetta integralmente i presenti Termini.
      </p>

      <h2>2. Accettazione</h2>
      <p>
        L'utilizzo continuato del Servizio costituisce accettazione dei presenti Termini.
        L'utente dichiara di avere la capacità giuridica per impegnare sé stesso o l'organizzazione
        per conto della quale agisce.
      </p>

      <h2>3. Descrizione del Servizio</h2>
      <p>
        HACCP Trace è un'applicazione SaaS per la gestione dell'autocontrollo alimentare:
        registrazione temperature, sanificazioni, abbattimenti, produzione, etichette, report HACCP
        e pacchetti per le visite ASL.
      </p>

      <h2>4. Account e credenziali</h2>
      <p>
        L'utente è responsabile della riservatezza delle proprie credenziali (email, password, PIN operatori)
        e di ogni attività svolta tramite il proprio account. Le informazioni fornite devono essere accurate
        e mantenute aggiornate.
      </p>

      <h2>5. Uso consentito e divieti</h2>
      <p>L'utente si impegna a non:</p>
      <ul>
        <li>utilizzare il Servizio per scopi illeciti, frodi o spam;</li>
        <li>violare diritti di proprietà intellettuale di terzi;</li>
        <li>interferire con la sicurezza del Servizio (malware, probing, scraping non autorizzato);</li>
        <li>effettuare reverse engineering, decompilazione, rivendita o ridistribuzione del Servizio;</li>
        <li>aggirare limiti tecnici o di piano.</li>
      </ul>

      <h2>6. Licenza</h2>
      <p>
        Viene concessa una licenza limitata, non esclusiva e non trasferibile per utilizzare il Servizio
        nei limiti del piano scelto. Il Venditore mantiene la piena proprietà del Servizio, del software,
        della documentazione e dei marchi.
      </p>

      <h2>7. Contenuti dell'utente</h2>
      <p>
        L'utente conserva la proprietà dei dati e contenuti inseriti nel Servizio. Concede al Venditore
        una licenza limitata necessaria ad ospitare ed elaborare tali contenuti al solo scopo di fornire il Servizio.
      </p>

      <h2>8. Pagamenti e abbonamento</h2>
      <p>
        Il processo d'ordine è gestito dal nostro rivenditore online <strong>Paddle.com</strong>.
        Paddle.com è il <em>Merchant of Record</em> per tutti gli ordini. Paddle gestisce gli aspetti
        commerciali del checkout, fatturazione, tasse, rinnovi e rimborsi.
        I termini di acquisto sono disponibili qui: <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle Buyer Terms</a>.
      </p>
      <p>
        L'abbonamento HACCP Trace è di 19,99 € al mese, con 30 giorni di prova gratuita.
        Al termine della prova viene addebitato automaticamente il primo mese, salvo annullamento.
        Il rinnovo è mensile fino a disdetta.
      </p>

      <h2>9. Annullamento</h2>
      <p>
        L'utente può annullare l'abbonamento in qualsiasi momento dal portale clienti.
        L'accesso rimane attivo fino al termine del periodo già pagato; non è previsto rimborso
        pro-rata per il periodo non utilizzato, salvo quanto previsto dalla Refund Policy.
      </p>

      <h2>10. Sospensione e risoluzione</h2>
      <p>
        Il Venditore può sospendere o terminare l'accesso in caso di:
      </p>
      <ul>
        <li>violazione sostanziale dei Termini;</li>
        <li>mancato pagamento;</li>
        <li>rischio di sicurezza o frode;</li>
        <li>violazioni ripetute o gravi delle policy.</li>
      </ul>
      <p>
        In caso di cessazione, l'utente avrà un periodo ragionevole per esportare i propri dati,
        dopo il quale gli stessi potranno essere cancellati.
      </p>

      <h2>11. Garanzie e limitazioni</h2>
      <p>
        Il Servizio è fornito "così com'è". Nella misura massima consentita dalla legge, decliniamo
        ogni garanzia implicita di commerciabilità o idoneità a uno scopo specifico. Non garantiamo
        funzionamento ininterrotto o privo di errori.
      </p>
      <p>
        La responsabilità aggregata del Venditore non potrà eccedere l'importo dei canoni pagati
        nei 12 mesi precedenti l'evento generatore. Sono escluse responsabilità per danni indiretti,
        consequenziali, perdita di profitti, dati o avviamento. Sono fatte salve le responsabilità
        per frode, dolo, colpa grave, morte o lesioni personali nei limiti di legge.
      </p>

      <h2>12. Manleva</h2>
      <p>
        L'utente manleva il Venditore da qualsiasi pretesa di terzi derivante dai contenuti caricati,
        dall'uso illecito del Servizio o dalla violazione dei presenti Termini.
      </p>

      <h2>13. Modifiche</h2>
      <p>
        I presenti Termini possono essere aggiornati. Le modifiche saranno comunicate via email
        o tramite avviso nel Servizio con ragionevole anticipo.
      </p>

      <h2>14. Legge applicabile e foro</h2>
      <p>
        I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente
        il Foro del luogo di residenza del consumatore se utente consumatore, oppure il Foro competente
        secondo le ordinarie regole di rito.
      </p>

      <h2>15. Contatti</h2>
      <p>
        Per qualsiasi richiesta relativa ai presenti Termini, contattare il Venditore tramite i recapiti
        indicati nell'app o nelle comunicazioni di acquisto.
      </p>
    </div>
  );
}