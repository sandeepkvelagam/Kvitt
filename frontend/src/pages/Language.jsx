import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";

const LANGUAGES = [
  { code: "en", flag: "\u{1F1FA}\u{1F1F8}", name: "English" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}", name: "Espa\u00f1ol", native: "Spanish" },
  { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", name: "Fran\u00e7ais", native: "French" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}", name: "Deutsch", native: "German" },
  { code: "hi", flag: "\u{1F1EE}\u{1F1F3}", name: "\u0939\u093f\u0928\u094d\u0926\u0940", native: "Hindi" },
  { code: "pt", flag: "\u{1F1E7}\u{1F1F7}", name: "Portugu\u00eas", native: "Portuguese" },
  { code: "zh", flag: "\u{1F1E8}\u{1F1F3}", name: "\u4e2d\u6587", native: "Chinese" },
];

export default function Language() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("kvitt-language");
    if (saved) setSelected(saved);
  }, []);

  const handleSelect = (code) => {
    setSelected(code);
    localStorage.setItem("kvitt-language", code);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Language</h1>
            <p className="text-sm text-muted-foreground">Select your preferred language</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">Available Languages</p>

        <div className="space-y-2">
          {LANGUAGES.map((lang) => (
            <Card
              key={lang.code}
              className={`cursor-pointer transition-all ${
                selected === lang.code
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleSelect(lang.code)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <p className="font-medium">{lang.name}</p>
                  {lang.native && (
                    <p className="text-sm text-muted-foreground">{lang.native}</p>
                  )}
                </div>
                {selected === lang.code && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Language affects all text in the application. A reload may be required for full effect.
        </p>
      </div>
    </div>
  );
}
