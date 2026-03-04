import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Square, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const EXAMPLES = [
  "Buy in for $20",
  "Rebuy $10",
  "Cash out 45 chips",
  "Help me with my hand",
];

const COMMAND_TYPES = {
  "buy in": "buy_in",
  "rebuy": "rebuy",
  "cash out": "cash_out",
  "help": "assistance",
};

function detectCommandType(text) {
  const lower = text.toLowerCase();
  for (const [keyword, type] of Object.entries(COMMAND_TYPES)) {
    if (lower.includes(keyword)) return type;
  }
  return null;
}

export default function VoiceCommands() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [status, setStatus] = useState("idle"); // idle | listening | processing
  const [transcript, setTranscript] = useState("");
  const [commandType, setCommandType] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setStatus("listening");

    recognition.onresult = (event) => {
      setStatus("processing");
      const text = event.results[0][0].transcript;
      setTimeout(() => {
        setTranscript(text);
        setCommandType(detectCommandType(text));
        setStatus("idle");
      }, 500);
    };

    recognition.onerror = () => {
      setStatus("idle");
      setTranscript("Could not recognise speech. Please try again.");
      setCommandType(null);
    };

    recognition.onend = () => {
      if (status === "listening") setStatus("idle");
    };

    setTranscript("");
    setCommandType(null);
    recognition.start();
  }, [status]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setStatus("idle");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{t.voice?.title || "Voice Commands"}</h1>
            <p className="text-sm text-muted-foreground">{t.settings?.voiceDesc || "Control the app with your voice"}</p>
          </div>
        </div>

        {/* Mic Button */}
        <div className="flex flex-col items-center gap-4 py-8">
          <button
            onClick={status === "listening" ? stopListening : startListening}
            disabled={status === "processing"}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
              status === "listening"
                ? "bg-red-500 hover:bg-red-600 scale-110"
                : status === "processing"
                ? "bg-muted cursor-not-allowed"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {status === "listening" ? (
              <Square className="w-8 h-8 text-white" />
            ) : status === "processing" ? (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : (
              <Mic className="w-8 h-8 text-primary-foreground" />
            )}
          </button>
          <p className="text-sm text-muted-foreground">
            {status === "idle" && "Tap to speak"}
            {status === "listening" && "Listening\u2026"}
            {status === "processing" && "Processing\u2026"}
          </p>
        </div>

        {/* Transcript Result */}
        {transcript && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Command recognised
              </p>
              <p className="text-lg italic">&ldquo;{transcript}&rdquo;</p>
              {commandType && (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                    {commandType.replace("_", " ")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Try saying:
          </p>
          <div className="grid gap-2">
            {EXAMPLES.map((example, i) => (
              <Card key={i} className="bg-secondary/30">
                <CardContent className="p-3">
                  <p className="text-sm">&ldquo;{example}&rdquo;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
