import LegalBackHeader from "@/components/LegalBackHeader";
import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { i18n } = useTranslation();
  const isEN = i18n.language?.startsWith("en");
  const locale = isEN ? "en-GB" : "it-IT";
  const today = new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  if (isEN) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
        <LegalBackHeader />
        <h1>Privacy Policy</h1>
        <p><strong>Last updated:</strong> {today}</p>

        <h2>1. Data Controller</h2>
        <p>
          The data controller is <strong>Gennaro Cuozzo, sole proprietor</strong>, provider of the
          HACCP Pro application. For any request regarding the processing of personal data, please
          contact us via the details shown in the app.
        </p>

        <h2>2. Data Collected</h2>
        <p>We process the following categories of personal data:</p>
        <ul>
          <li><strong>Account data:</strong> email, password (hashed), business name.</li>
          <li><strong>Operational data entered by the user:</strong> HACCP records (temperatures, sanitation, raw materials, products, labels, operators with PIN), uploaded documents and images.</li>
          <li><strong>Support data:</strong> messages and requests sent to our team.</li>
          <li><strong>Technical data:</strong> IP address, device identifiers, usage logs, technical cookies.</li>
          <li><strong>Payment data:</strong> collected and processed directly by Paddle.com (see point 5); we do not store credit card details.</li>
        </ul>

        <h2>3. Purposes and Legal Bases</h2>
        <ul>
          <li>account creation and management — contract performance;</li>
          <li>provision of the Service (storage and display of HACCP data) — contract performance;</li>
          <li>security, fraud prevention, debugging — legitimate interest;</li>
          <li>product improvement and aggregate analytics — legitimate interest;</li>
          <li>customer support — contract performance;</li>
          <li>tax and legal compliance — legal obligation;</li>
          <li>marketing communications — consent (revocable at any time).</li>
        </ul>

        <h2>4. Retention</h2>
        <p>
          Account and operational data are kept for the duration of the subscription and for a
          reasonable period thereafter (up to 12 months) to allow potential service restoration.
          Billing data is kept for the period required by tax law (10 years). We delete or anonymise
          data when no longer necessary.
        </p>

        <h2>5. Recipients and Sharing</h2>
        <p>Data may be shared with:</p>
        <ul>
          <li><strong>Cloud hosting and infrastructure providers</strong> for the provision of the Service (database, storage, edge computing);</li>
          <li><strong>Paddle.com</strong>, as <em>Merchant of Record</em>, for sale of the product, subscription management, payments, tax compliance and invoicing;</li>
          <li><strong>Professional advisors</strong> (accountants, lawyers) within the limits of their assignments;</li>
          <li><strong>Competent authorities</strong>, when required by law.</li>
        </ul>

        <h2>6. International Transfers</h2>
        <p>
          Some providers may process data outside the EEA. In such cases, appropriate safeguards
          are applied, such as the EU Commission's Standard Contractual Clauses or adequacy decisions.
        </p>

        <h2>7. User Rights</h2>
        <p>Under the GDPR, the user has the right to:</p>
        <ul>
          <li>access their data;</li>
          <li>rectification;</li>
          <li>erasure ("right to be forgotten");</li>
          <li>restriction of processing;</li>
          <li>data portability;</li>
          <li>object to processing based on legitimate interest;</li>
          <li>withdraw consent at any time;</li>
          <li>lodge a complaint with the Italian Data Protection Authority (www.garanteprivacy.it) or your local supervisory authority.</li>
        </ul>
        <p>We will respond to requests within 1 month of receipt.</p>

        <h2>8. Security</h2>
        <p>
          We adopt appropriate technical and organisational measures: encryption in transit (HTTPS),
          encryption at rest for databases, role-based access controls, regular backups.
        </p>

        <h2>9. Cookies</h2>
        <p>
          We use only technical cookies required for authentication and session functionality.
          We do not use third-party profiling cookies.
        </p>

        <h2>10. Changes</h2>
        <p>
          This policy may be updated. Significant changes will be communicated via email or notice
          within the Service.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <LegalBackHeader />
      <h1>Informativa sulla Privacy</h1>
      <p><strong>Ultimo aggiornamento:</strong> {today}</p>

      <h2>1. Titolare del trattamento</h2>
      <p>
        Titolare del trattamento è <strong>Gennaro Cuozzo, ditta individuale</strong>, che fornisce
        l'applicazione HACCP Pro. Per qualsiasi richiesta relativa al trattamento dei dati personali
        è possibile contattarci tramite i recapiti indicati nell'app.
      </p>

      <h2>2. Dati raccolti</h2>
      <p>Trattiamo le seguenti categorie di dati personali:</p>
      <ul>
        <li><strong>Dati di account:</strong> email, password (cifrata), nome dell'attività.</li>
        <li><strong>Dati operativi inseriti dall'utente:</strong> registrazioni HACCP (temperature, sanificazioni, materie prime, prodotti, etichette, operatori con PIN), documenti e immagini caricati.</li>
        <li><strong>Dati di supporto:</strong> messaggi e richieste inviate al nostro team.</li>
        <li><strong>Dati tecnici:</strong> indirizzo IP, identificatori del dispositivo, log d'uso, cookie tecnici.</li>
        <li><strong>Dati di pagamento:</strong> raccolti e trattati direttamente da Paddle.com (vedi punto 5), noi non memorizziamo dati di carte di credito.</li>
      </ul>

      <h2>3. Finalità e basi giuridiche</h2>
      <ul>
        <li>creazione e gestione dell'account — esecuzione del contratto;</li>
        <li>erogazione del Servizio (archiviazione e visualizzazione dei dati HACCP) — esecuzione del contratto;</li>
        <li>sicurezza, prevenzione frodi, debug — legittimo interesse;</li>
        <li>miglioramento del prodotto e analisi aggregate — legittimo interesse;</li>
        <li>supporto clienti — esecuzione del contratto;</li>
        <li>adempimenti fiscali e legali — obbligo di legge;</li>
        <li>eventuali comunicazioni di marketing — consenso (revocabile in qualsiasi momento).</li>
      </ul>

      <h2>4. Conservazione</h2>
      <p>
        I dati di account e i dati operativi sono conservati per la durata dell'abbonamento e per
        un periodo ragionevole successivo (fino a 12 mesi) per consentire eventuale ripristino del servizio.
        I dati di fatturazione sono conservati per il periodo previsto dalla normativa fiscale (10 anni).
        Cancelliamo o anonimizziamo i dati quando non più necessari.
      </p>

      <h2>5. Destinatari e condivisione</h2>
      <p>I dati possono essere condivisi con:</p>
      <ul>
        <li><strong>Fornitori di hosting e infrastruttura cloud</strong> per l'erogazione del Servizio (database, storage, edge computing);</li>
        <li><strong>Paddle.com</strong>, in qualità di <em>Merchant of Record</em>, per la vendita del prodotto, gestione dell'abbonamento, pagamenti, conformità fiscale e fatturazione;</li>
        <li><strong>Consulenti professionali</strong> (commercialisti, legali) nei limiti dei loro incarichi;</li>
        <li><strong>Autorità competenti</strong>, quando richiesto dalla legge.</li>
      </ul>

      <h2>6. Trasferimenti internazionali</h2>
      <p>
        Alcuni fornitori possono trattare dati al di fuori dello SEE. In tali casi vengono applicate
        garanzie adeguate, quali le clausole contrattuali standard approvate dalla Commissione Europea
        o decisioni di adeguatezza.
      </p>

      <h2>7. Diritti dell'utente</h2>
      <p>Ai sensi del GDPR, l'utente ha diritto di:</p>
      <ul>
        <li>accesso ai propri dati;</li>
        <li>rettifica;</li>
        <li>cancellazione ("diritto all'oblio");</li>
        <li>limitazione del trattamento;</li>
        <li>portabilità;</li>
        <li>opposizione al trattamento basato su legittimo interesse;</li>
        <li>revoca del consenso in qualsiasi momento;</li>
        <li>proporre reclamo all'Autorità Garante per la protezione dei dati personali (www.garanteprivacy.it).</li>
      </ul>
      <p>Risponderemo alle richieste entro 1 mese dalla ricezione.</p>

      <h2>8. Sicurezza</h2>
      <p>
        Adottiamo misure tecniche e organizzative adeguate: cifratura in transito (HTTPS), cifratura
        a riposo dei database, controlli di accesso basati sui ruoli, backup regolari.
      </p>

      <h2>9. Cookie</h2>
      <p>
        Utilizziamo unicamente cookie tecnici necessari al funzionamento dell'autenticazione e
        della sessione. Non utilizziamo cookie di profilazione di terze parti.
      </p>

      <h2>10. Modifiche</h2>
      <p>
        La presente informativa può essere aggiornata. Le modifiche significative saranno comunicate
        tramite email o avviso nel Servizio.
      </p>
    </div>
  );
}