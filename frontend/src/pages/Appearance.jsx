import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sun, Moon, Monitor, Check } from "lucide-react";

const THEMES = [
  { id: "light", label: "Light", description: "A clean, bright interface", icon: Sun },
  { id: "dark", label: "Dark", description: "Easier on the eyes in low light", icon: Moon },
  { id: "system", label: "System", description: "Follows your device preferences", icon: Monitor },
];

export default function Appearance() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("light");

  useEffect(() => {
    const saved = localStorage.getItem("kvitt-theme");
    if (saved === "dark") setSelected("dark");
    else if (saved === "system") setSelected("system");
    else setSelected("light");
  }, []);

  const handleSelect = (themeId) => {
    setSelected(themeId);
    if (themeId === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
      localStorage.setItem("kvitt-theme", "system");
    } else {
      document.documentElement.classList.toggle("dark", themeId === "dark");
      localStorage.setItem("kvitt-theme", themeId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Appearance</h1>
            <p className="text-sm text-muted-foreground">Customise your visual experience</p>
          </div>
        </div>

        <div className="space-y-3">
          {THEMES.map((theme) => (
            <Card
              key={theme.id}
              className={`cursor-pointer transition-all ${
                selected === theme.id
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleSelect(theme.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selected === theme.id ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}>
                  <theme.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{theme.label}</p>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>
                {selected === theme.id && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
