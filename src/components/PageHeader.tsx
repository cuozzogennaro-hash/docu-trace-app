import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export default function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">{t(title)}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{t(subtitle)}</p>}
      </div>
      {action}
    </div>
  );
}