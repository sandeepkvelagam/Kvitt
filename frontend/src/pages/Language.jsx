import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// Languages: English, Spanish, French, German, Hindi, Portuguese, Chinese
// Storage key: kvitt-language (via LanguageContext)
export default function Language() {
  const navigate = useNavigate();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{t.settings.language}</h1>
            <p className="text-sm text-muted-foreground">Select your preferred language</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">Available Languages</p>

        <div className="space-y-2">
          {supportedLanguages.map((lang) => (
            <Card
              key={lang.code}
              className={`cursor-pointer transition-all ${
                language === lang.code
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setLanguage(lang.code)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <p className="font-medium">{lang.nativeName}</p>
                  {lang.name !== lang.nativeName && (
                    <p className="text-sm text-muted-foreground">{lang.name}</p>
                  )}
                </div>
                {language === lang.code && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Language affects all text in the application.
        </p>
      </div>
    </div>
  );
}
