import { useCompany } from "@/hooks/useCompany";
import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function CompanyHeader() {
  const { company, loading } = useCompany();
  if (loading) return null;

  const empty = !company.business_name && !company.logo_url;
  if (empty) {
    return (
      <Link to="/impostazioni" className="block mb-6">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 flex items-center gap-3 hover:border-primary hover:bg-primary/5 transition">
          <Building2 className="text-muted-foreground" size={20} />
          <div className="text-sm">
            <div className="font-medium">Configura la tua azienda</div>
            <div className="text-xs text-muted-foreground">Aggiungi ragione sociale e logo per i tuoi documenti</div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-card border border-border p-4 flex items-center gap-4 shadow-soft">
      {company.logo_url ? (
        <img src={company.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-contain bg-muted" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Building2 className="text-primary-foreground" size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-lg leading-tight truncate">{company.business_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground truncate">
          {[company.vat && `P.IVA ${company.vat}`, company.address].filter(Boolean).join(" • ") || "—"}
        </div>
      </div>
    </div>
  );
}