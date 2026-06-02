import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LegalBackHeader({ to = "/auth" }: { to?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      <button
        onClick={() => navigate(to)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Indietro")}
      </button>
      <LanguageSwitcher variant="compact" />
    </div>
  );
}
