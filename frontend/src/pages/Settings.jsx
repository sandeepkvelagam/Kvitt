import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Wallet,
  CreditCard,
  Moon,
  Globe,
  Bell,
  Shield,
  Zap,
  MessageSquare,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Mic,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

function SettingRow({ icon: Icon, label, description, onClick, tag, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
        destructive
          ? "hover:bg-destructive/10 text-destructive"
          : "hover:bg-secondary/50"
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
        destructive ? "bg-destructive/10" : "bg-secondary/50"
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {tag && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {tag}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {!destructive && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useLanguage();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        <h1 className="font-heading text-2xl font-bold mb-6">{t.settings?.title || "Preferences"}</h1>

        {/* Profile & Account — matching mobile "Account & Financial" */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t.settings?.accountFinancial || "Account & Financial"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={User} label={t.settings?.profile || "Profile"} description={t.settings?.profileDesc || "Personal information & game statistics"} onClick={() => navigate("/profile")} />
            <SettingRow icon={CreditCard} label={t.settings?.billing || "Billing"} description={t.settings?.billingDesc || "Subscription & payment methods"} tag="Coming Soon" onClick={() => navigate("/settings/billing")} />
            <SettingRow icon={Wallet} label={t.nav?.wallet || "Wallet"} description={t.settings?.walletDesc || "Balance, transfers & deposits"} onClick={() => navigate("/wallet")} />
            <SettingRow icon={CreditCard} label={t.nav?.requestPay || "Request & Pay"} description={t.settings?.requestPayDesc || "Send and request payments"} onClick={() => navigate("/request-pay")} />
          </CardContent>
        </Card>

        {/* Preferences & Settings — matching mobile section */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t.settings?.preferencesSettings || "Preferences & Settings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={Moon} label={t.settings?.appearance || "Appearance"} description={t.settings?.appearanceDesc || "Customise your visual experience"} onClick={() => navigate("/settings/appearance")} />
            <SettingRow icon={Globe} label={t.settings?.language || "Language"} description={t.settings?.languageDesc || "Select your preferred language"} onClick={() => navigate("/settings/language")} />
            <SettingRow icon={Mic} label={t.settings?.voiceCommands || "Voice Commands"} description={t.settings?.voiceDesc || "Control the app with your voice"} onClick={() => navigate("/settings/voice-commands")} />
            <SettingRow icon={Bell} label={t.settings?.notifications || "Alerts"} description={t.settings?.notificationsDesc || "Manage your alerts"} onClick={() => navigate("/settings/notifications")} />
            <SettingRow icon={Shield} label={t.settings?.privacy || "Privacy"} description={t.settings?.privacyDesc || "Data & permissions"} onClick={() => navigate("/privacy")} />
            <SettingRow icon={Zap} label={t.nav?.automations || "Smart Flows"} description={t.settings?.automationsDesc || "Automation rules & scheduled actions"} onClick={() => navigate("/automations")} />
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t.settings?.support || "Support"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={Sparkles} label={t.nav?.aiAssistant || "Ask Kvitt"} description={t.settings?.aiDesc || "Intelligent game insights & assistance"} onClick={() => navigate("/ai")} />
            <SettingRow icon={MessageSquare} label={t.settings?.reportIssue || "Report an Issue"} description={t.settings?.reportDesc || "Submit feedback & bug reports"} onClick={() => navigate("/feedback")} />
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="bg-card border-border/50 mb-4">
          <CardContent className="px-2 py-2">
            <SettingRow
              icon={LogOut}
              label={t.settings?.signOut || "Sign Out"}
              destructive
              onClick={handleLogout}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Kvitt v1.0.0
        </p>
      </main>
    </div>
  );
}
