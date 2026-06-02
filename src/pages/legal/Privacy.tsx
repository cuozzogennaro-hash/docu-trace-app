import LegalBackHeader from "@/components/LegalBackHeader";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <h1>Informativa sulla Privacy</h1>
      <p><strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}</p>

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