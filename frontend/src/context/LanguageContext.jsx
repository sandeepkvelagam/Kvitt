import { createContext, useContext, useState, useEffect, useCallback } from "react";
import translations, { SUPPORTED_LANGUAGES } from "@/i18n/translations";

const LanguageContext = createContext(undefined);

const STORAGE_KEY = "kvitt-language";

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang) => {
    localStorage.setItem(STORAGE_KEY, lang);
    setLanguageState(lang);
  }, []);

  const t = translations[language] || translations.en;

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
