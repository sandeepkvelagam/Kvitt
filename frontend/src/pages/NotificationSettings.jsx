import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Gamepad2,
  Wallet,
  Users,
  Sparkles,
  Calendar,
  Trophy,
  Flame,
  BarChart3,
  VolumeX,
  Volume2,
  BellOff,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function NotificationSettings() {
  const navigate = useNavigate();

  // Notification preferences
  const [pushEnabled, setPushEnabled] = useState(true);
  const [gameUpdates, setGameUpdates] = useState(true);
  const [settlements, setSettlements] = useState(true);
  const [groupInvites, setGroupInvites] = useState(true);
  const [loading, setLoading] = useState(true);

  // Engagement preferences
  const [engPrefs, setEngPrefs] = useState(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const [notifRes, engRes] = await Promise.all([
        axios.get(`${API}/notifications/preferences`).catch(() => ({ data: null })),
        axios.get(`${API}/engagement/preferences`).catch(() => ({ data: null })),
      ]);

      if (notifRes.data) {
        setPushEnabled(notifRes.data.push_enabled ?? true);
        setGameUpdates(notifRes.data.game_updates_enabled ?? true);
        setSettlements(notifRes.data.settlements_enabled ?? true);
        setGroupInvites(notifRes.data.group_invites_enabled ?? true);
      }
      if (engRes.data) {
        setEngPrefs(engRes.data);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const updateNotifPref = async (key, value) => {
    try {
      await axios.put(`${API}/notifications/preferences`, { [key]: value });
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const updateEngPref = async (key, value) => {
    const updated = { ...engPrefs, [key]: value };
    setEngPrefs(updated);
    try {
      await axios.put(`${API}/engagement/preferences`, { [key]: value });
    } catch {
      toast.error("Failed to update preference");
      setEngPrefs(engPrefs);
    }
  };

  const toggleMutedCategory = (category) => {
    const current = engPrefs?.muted_categories || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateEngPref("muted_categories", updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2">Notification Settings</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage which notifications you receive</p>

        {/* Push Notifications */}
        <Card className="bg-card border-border/50 mb-4">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Alerts for games, settlements & more</p>
                </div>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={(v) => {
                  setPushEnabled(v);
                  updateNotifPref("push_enabled", v);
                }}
              />
            </div>

            <div className="border-t border-border/50 pt-4 space-y-3">
              {[
                { key: "game_updates_enabled", icon: Gamepad2, color: "text-blue-400", bgColor: "bg-blue-400/10", label: "Game Updates", desc: "Buy-ins, cash-outs, game status", value: gameUpdates, setter: setGameUpdates },
                { key: "settlements_enabled", icon: Wallet, color: "text-green-400", bgColor: "bg-green-400/10", label: "Settlements & Wallet", desc: "Payment requests & wallet activity", value: settlements, setter: setSettlements },
                { key: "group_invites_enabled", icon: Users, color: "text-purple-400", bgColor: "bg-purple-400/10", label: "Group Invites", desc: "Invitations to join groups", value: groupInvites, setter: setGroupInvites },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.bgColor}`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={item.value}
                    onCheckedChange={(v) => {
                      item.setter(v);
                      updateNotifPref(item.key, v);
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Notifications */}
        {engPrefs && (
          <Card className="bg-card border-border/50 mb-4">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Engagement Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Mute All Engagement</p>
                  <p className="text-xs text-muted-foreground">Pause all nudges, celebrations & digests</p>
                </div>
                <button
                  onClick={() => updateEngPref("muted_all", !engPrefs.muted_all)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    engPrefs.muted_all
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {engPrefs.muted_all ? (
                    <><VolumeX className="w-4 h-4" /> Muted</>
                  ) : (
                    <><Volume2 className="w-4 h-4" /> Active</>
                  )}
                </button>
              </div>

              {!engPrefs.muted_all && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Mute specific categories</p>
                  {[
                    { key: "inactive_group", label: "Inactive Group Nudges", desc: "Reminders to schedule a game", icon: Calendar, color: "text-blue-400" },
                    { key: "milestone", label: "Milestone Celebrations", desc: "Game count achievements", icon: Trophy, color: "text-yellow-400" },
                    { key: "big_winner", label: "Winner Celebrations", desc: "Big win announcements", icon: Flame, color: "text-orange-400" },
                    { key: "digest", label: "Weekly Digests", desc: "Group activity summaries", icon: BarChart3, color: "text-purple-400" },
                  ].map(({ key, label, desc, icon: Icon, color }) => {
                    const isMuted = (engPrefs.muted_categories || []).includes(key);
                    return (
                      <div key={key} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isMuted ? "text-muted-foreground" : color}`} />
                          <div>
                            <p className={`text-sm font-medium ${isMuted ? "text-muted-foreground" : ""}`}>{label}</p>
                            <p className="text-[10px] text-muted-foreground">{desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleMutedCategory(key)}
                          className={`p-1.5 rounded-full transition-colors ${
                            isMuted
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {isMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!engPrefs.muted_all && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Quiet Hours (no notifications)</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">From</label>
                      <select
                        value={engPrefs.quiet_start ?? 22}
                        onChange={(e) => updateEngPref("quiet_start", parseInt(e.target.value))}
                        className="bg-secondary/50 border border-border rounded px-2 py-1 text-xs"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-xs text-muted-foreground">to</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={engPrefs.quiet_end ?? 8}
                        onChange={(e) => updateEngPref("quiet_end", parseInt(e.target.value))}
                        className="bg-secondary/50 border border-border rounded px-2 py-1 text-xs"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground mt-4">
          Manage which notifications you receive. You can also configure notifications in your browser settings.
        </p>
      </main>
    </div>
  );
}
