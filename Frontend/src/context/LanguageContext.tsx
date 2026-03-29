import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { he } from "../locales/he";
import { en } from "../locales/en";

export type Language = "he" | "en";

const translations: Record<Language, Record<string, string>> = { he, en };

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("seeksuit-lang") as Language) ?? "he";
  });

  const dir = lang === "he" ? "rtl" : "ltr";

  // Update <html> dir and lang attributes on language change
  useEffect(() => {
    localStorage.setItem("seeksuit-lang", lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  function setLang(l: Language) {
    setLangState(l);
  }

  function t(key: string): string {
    return translations[lang][key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
