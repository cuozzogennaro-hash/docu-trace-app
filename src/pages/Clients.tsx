import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UserPlus, ShoppingBag } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  const [cName, setCName] = useState("");
  const [cVat, setCVat] = useState("");
  const [cContact, setCContact] = useState("");

  const [sClient, setSClient] = useState("");
  const [sProduct, setSProduct] = useState("");
  const [sDate, setSDate] = useState(new Date().toISOString().slice(0, 10));
  const [sQty, setSQty] = useState("");
  const [sDoc, setSDoc] = useState("");

  async function load() {
    const [{ data: c }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("products").select("id, name, internal_lot").order("production_date", { ascending: false }),
      supabase.from("sales").select("*, clients(name), products(name, internal_lot)").order("sale_date", { ascending: false }).limit(30),
    ]);
    setClients(c ?? []);
    setProducts(p ?? []);
    setSales(s ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addClient() {
    if (!cName) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("clients").insert({ user_id: user!.id, name: cName, vat: cVat, contact: cContact });
    if (error) return toast.error(error.message);
    toast.success("Cliente aggiunto");
    setCName(""); setCVat(""); setCContact("");
    load();
  }

  async function addSale() {
    if (!sClient || !sProduct) return toast.error("Cliente e prodotto obbligatori");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("sales").insert({
      user_id: user!.id, client_id: sClient, product_id: sProduct,
      sale_date: sDate, quantity: sQty, document_number: sDoc,
    });
    if (error) return toast.error(error.message);
    toast.success("Vendita registrata");
    setSQty(""); setSDoc("");
    load();
  }

  return (
    <>
      <PageHeader title="Clienti & Vendite B2B" subtitle="Traccia le uscite dei prodotti verso i tuoi clienti" />
      <Tabs defaultValue="sales">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Vendite</TabsTrigger>
          <TabsTrigger value="clients">Clienti</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <Card className="p-5 shadow-soft">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={sClient} onValueChange={setSClient}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prodotto</Label>
                <Select value={sProduct} onValueChange={setSProduct}>
                  <SelectTrigger><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} • {p.internal_lot}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Quantità</Label><Input value={sQty} onChange={(e) => setSQty(e.target.value)} /></div>
              <div className="space-y-2 lg:col-span-2"><Label>Numero documento/DDT</Label><Input value={sDoc} onChange={(e) => setSDoc(e.target.value)} /></div>
            </div>
            <Button onClick={addSale} className="mt-5 bg-gradient-primary gap-2"><ShoppingBag size={16} /> Registra vendita</Button>
          </Card>

          <div className="space-y-2">
            {sales.map((s) => (
              <Card key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.clients?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.products?.name} • <span className="font-mono">{s.products?.internal_lot}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{s.sale_date}</div>
                  <div className="text-xs text-muted-foreground">{s.document_number || "—"}</div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <Card className="p-5 shadow-soft">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} /></div>
              <div className="space-y-2"><Label>P.IVA</Label><Input value={cVat} onChange={(e) => setCVat(e.target.value)} /></div>
              <div className="space-y-2"><Label>Contatto</Label><Input value={cContact} onChange={(e) => setCContact(e.target.value)} /></div>
            </div>
            <Button onClick={addClient} className="mt-5 bg-gradient-primary gap-2"><UserPlus size={16} /> Aggiungi cliente</Button>
          </Card>
          <div className="space-y-2">
            {clients.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.vat} • {c.contact}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}