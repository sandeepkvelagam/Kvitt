import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
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
} from "lucide-react";
import Navbar from "@/components/Navbar";

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
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <h1 className="font-heading text-2xl font-bold mb-6">Settings</h1>

        {/* Profile & Account */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Profile & Account
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={User} label="Profile" description="Name, stats & balances" onClick={() => navigate("/profile")} />
            <SettingRow icon={Wallet} label="Wallet" description="Balance, transfers & deposits" onClick={() => navigate("/wallet")} />
            <SettingRow icon={CreditCard} label="Request & Pay" description="Send and request payments" onClick={() => navigate("/request-pay")} />
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={Bell} label="Notifications" description="Push & category preferences" onClick={() => navigate("/settings/notifications")} />
            <SettingRow icon={Zap} label="Smart Flows" description="Automations & scheduled actions" onClick={() => navigate("/automations")} />
            <SettingRow icon={Shield} label="Privacy" description="Data & account privacy" onClick={() => navigate("/privacy")} />
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SettingRow icon={Sparkles} label="AI Assistant" description="Get help with games & stats" onClick={() => navigate("/ai")} />
            <SettingRow icon={MessageSquare} label="Report an Issue" description="Bug reports & feedback" onClick={() => navigate("/feedback")} />
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="bg-card border-border/50 mb-4">
          <CardContent className="px-2 py-2">
            <SettingRow
              icon={LogOut}
              label="Sign Out"
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
