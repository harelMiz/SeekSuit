import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { he } from "../locales/he";
import { en } from "../locales/en";
import api from "../services/api";

export type Language = "he" | "en";

const base: Record<Language, Record<string, string>> = { he, en };

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
  setOverride: (key: string, heVal: string, enVal: string) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("seeksuit-lang") as Language) ?? "he";
  });

  const [overrides, setOverrides] = useState<Record<string, { he: string; en: string }>>({});

  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    localStorage.setItem("seeksuit-lang", lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  // Fetch DB overrides on startup and merge on top of static translations
  useEffect(() => {
    api.get<Record<string, { he: string; en: string }>>("/content")
      .then((res) => setOverrides(res.data))
      .catch(() => {});
  }, []);

  function setLang(l: Language) {
    setLangState(l);
  }

  const setOverride = useCallback((key: string, heVal: string, enVal: string) => {
    setOverrides((prev) => ({ ...prev, [key]: { he: heVal, en: enVal } }));
  }, []);

  function t(key: string): string {
    const override = overrides[key];
    if (override) return override[lang] ?? key;
    return base[lang][key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir, setOverride }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
