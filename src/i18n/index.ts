import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { en } from "./dict";

// Italian = source language. Keys are the Italian strings themselves.
// English is provided as a translation dictionary in ./dict.
// Falls back to the key (Italian source) when a translation is missing.

const STORAGE_KEY = "haccp.lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      it: { translation: {} },
    },
    fallbackLng: "it",
    supportedLngs: ["it", "en"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: STORAGE_KEY,
    },
    returnEmptyString: false,
  });

// Keep <html lang> in sync
const applyHtmlLang = (lng: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng.startsWith("en") ? "en" : "it";
  }
};
applyHtmlLang(i18n.language || "it");
i18n.on("languageChanged", applyHtmlLang);

export default i18n;

export type AppLang = "it" | "en";

export const APP_LANGUAGES: { code: AppLang; label: string; flag: string }[] = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
];