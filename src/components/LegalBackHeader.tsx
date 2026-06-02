import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LegalBackHeader() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Indietro
    </button>
  );
}
