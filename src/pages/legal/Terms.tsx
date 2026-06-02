import LegalBackHeader from "@/components/LegalBackHeader";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <LegalBackHeader />
      <h1>Termini e Condizioni</h1>
      <p><strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2>1. Venditore</h2>
      <p>
        Il servizio HACCP Pro (di seguito "il Servizio") è fornito da
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
        HACCP Pro è un'applicazione SaaS per la gestione dell'autocontrollo alimentare:
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
        L'abbonamento HACCP Pro è di 19,99 € al mese, con 30 giorni di prova gratuita.
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