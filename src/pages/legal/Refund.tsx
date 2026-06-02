import LegalBackHeader from "@/components/LegalBackHeader";

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10 prose prose-sm prose-neutral">
      <h1>Politica di rimborso</h1>
      <p><strong>Venditore:</strong> Gennaro Cuozzo, ditta individuale</p>

      <h2>Garanzia "soddisfatti o rimborsati" — 30 giorni</h2>
      <p>
        Offriamo una garanzia di rimborso di <strong>30 giorni</strong>. Se non sei soddisfatto
        del tuo acquisto, puoi richiedere il rimborso integrale entro 30 giorni dalla data dell'ordine.
      </p>

      <h2>Periodo di prova gratuita</h2>
      <p>
        L'abbonamento HACCP Pro include 30 giorni di prova gratuita. Nessun addebito viene effettuato
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