const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Sei un assistente OCR per documenti italiani (fatture, DDT, scontrini). Estrai TUTTI i prodotti/articoli presenti nel documento con le relative quantità. Rispondi SOLO chiamando il tool extract_document_data.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Estrai fornitore, data documento, numero documento e TUTTI i prodotti da questa fattura/DDT/etichetta. Per ogni riga prodotto indica: nome, quantità con unità di misura, SOLO il codice lotto del fornitore (senza altri dati), l'origine/provenienza se indicata, e la lista ingredienti SOLO se scritta in italiano (ignora liste in altre lingue come EN/FR/DE/ES). Se l'unica lista ingredienti presente è in lingua straniera, lascia il campo ingredients vuoto." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract structured data including ALL line items from an Italian invoice/DDT/receipt image.",
              parameters: {
                type: "object",
                properties: {
                  supplier_name: { type: "string", description: "Ragione sociale del fornitore/emittente" },
                  document_date: { type: "string", description: "Data del documento in formato YYYY-MM-DD" },
                  document_number: { type: "string", description: "Numero del documento/fattura/DDT" },
                  products: {
                    type: "array",
                    description: "Elenco di TUTTI i prodotti/articoli presenti nel documento",
                    items: {
                      type: "object",
                      properties: {
                        product_name: { type: "string", description: "Nome/descrizione del prodotto" },
                        quantity: { type: "string", description: "Quantità con unità di misura (es. '5 kg', '10 pz', '2 lt')" },
                        supplier_lot: { type: "string", description: "Solo il codice/numero di lotto del fornitore, senza altre informazioni. Stringa vuota se non presente." },
                        origin: { type: "string", description: "Origine/provenienza del prodotto (es. Italia, UE, Allevato in Italia, ecc.). Stringa vuota se non indicata." },
                        ingredients: { type: "string", description: "Lista ingredienti del prodotto SOLO se in lingua italiana, come riportata in etichetta (es. 'carne di suino, sale, spezie, destrosio'). Stringa vuota se non presente o se è in altra lingua." },
                      },
                      required: ["product_name", "quantity", "supplier_lot", "origin", "ingredients"],
                    },
                  },
                },
                required: ["supplier_name", "document_date", "document_number", "products"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi crediti al workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Errore servizio AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    return new Response(JSON.stringify({ data: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});