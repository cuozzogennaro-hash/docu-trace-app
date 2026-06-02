import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_LANGUAGES, type AppLang } from "@/i18n";

type Variant = "icon" | "compact" | "full";

export default function LanguageSwitcher({
  variant = "icon",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { i18n, t } = useTranslation();
  const current =
    (APP_LANGUAGES.find((l) => i18n.language?.startsWith(l.code))?.code as AppLang) || "it";
  const currentLang = APP_LANGUAGES.find((l) => l.code === current)!;

  function change(code: AppLang) {
    i18n.changeLanguage(code);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className={className}
            title={t("Lingua")}
            aria-label={t("Lingua")}
          >
            <span className="text-base leading-none">{currentLang.flag}</span>
          </Button>
        ) : variant === "compact" ? (
          <Button variant="ghost" size="sm" className={`gap-1.5 px-2 ${className ?? ""}`}>
            <Languages size={16} />
            <span className="text-xs font-semibold uppercase">{currentLang.code}</span>
          </Button>
        ) : (
          <Button variant="outline" className={`gap-2 ${className ?? ""}`}>
            <Languages size={16} />
            <span>{currentLang.flag}</span>
            <span>{currentLang.label}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {APP_LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => change(l.code)}
            className={l.code === current ? "font-semibold" : ""}
          >
            <span className="mr-2 text-base">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}