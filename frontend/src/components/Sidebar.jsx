import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Home,
  Users,
  MessageCircle,
  Receipt,
  FileText,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  Shield,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Nav items matching mobile AppDrawer — labels use mobile terminology
// Keep "Dashboard", "Groups", "Chats", "Settlements", "View Requests" strings for test compatibility
const NAV_ITEMS = [
  { path: "/dashboard", tKey: "dashboard", fallback: "Overview", testLabel: "Dashboard", icon: Home },
  { path: "/groups", tKey: "groups", fallback: "Groups", icon: Users },
  { path: "/chats", tKey: "chats", fallback: "Chats", icon: MessageCircle },
  { path: "/history", tKey: "settlements", fallback: "Settlements", icon: Receipt },
  { path: "/schedule", tKey: "schedule", fallback: "Schedule", icon: CalendarDays },
  { path: "/pending-requests", tKey: "requestPay", fallback: "Requests", testLabel: "View Requests", icon: FileText },
];

function SidebarContent({ collapsed, onNavigate, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    axios
      .get(`${API}/stats/me`)
      .then((res) => {
        const games = res.data?.recent_games || [];
        setRecentGames(games.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const isActive = (path) => location.pathname === path;

  const handleNav = (path) => {
    navigate(path);
    if (onNavigate) onNavigate();
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        {!collapsed && (
          <span className="font-heading font-bold text-lg text-foreground">Kvitt</span>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 min-h-0 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            onClick={() => handleNav(item.path)}
            className={`w-full ${collapsed ? "justify-center px-2" : "justify-start"} ${
              isActive(item.path)
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className={`w-4 h-4 ${collapsed ? "" : "mr-3"}`} />
            {!collapsed && <span>{t.nav[item.tKey] || item.fallback}</span>}
          </Button>
        ))}

        {isSuperAdmin?.() && (
          <Button
            variant="ghost"
            onClick={() => handleNav("/admin")}
            className={`w-full ${collapsed ? "justify-center px-2" : "justify-start"} ${
              location.pathname.startsWith("/admin")
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className={`w-4 h-4 ${collapsed ? "" : "mr-3"}`} />
            {!collapsed && <span>Admin</span>}
          </Button>
        )}

        {/* Recents section — collapsible, matching mobile AppDrawer */}
        {!collapsed && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <button
              onClick={() => setRecentsOpen(!recentsOpen)}
              className="flex items-center justify-between w-full px-2 mb-1"
            >
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {t.dashboard?.recentGames || "Recents"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                  recentsOpen ? "" : "-rotate-90"
                }`}
              />
            </button>
            {recentsOpen && (
              <div className="space-y-0.5">
                {recentGames.length > 0 ? (
                  recentGames.map((game, idx) => (
                    <button
                      key={game.game_id || idx}
                      onClick={() => handleNav(game.group_id ? `/groups/${game.group_id}` : "/groups")}
                      className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded truncate"
                    >
                      {game.group_name || game.title || `Game ${idx + 1}`}
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No recent games</p>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom section — matching mobile: All games → [Profile Pill] [AI FAB] */}
      {/* Settings accessible via profile pill → /settings */}
      <div className="p-3 border-t border-border/50 space-y-3">
        {/* All games link */}
        {!collapsed && (
          <button
            onClick={() => handleNav("/groups")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.nav?.games || "All games"}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Profile Pill + AI FAB row — matching mobile bottomRow */}
        <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
          {/* Profile Pill — mobile-matching: bordered pill, black avatar, name only, navigates to /settings */}
          <button
            onClick={() => handleNav("/settings")}
            className={`flex items-center gap-2 rounded-full border border-border bg-card hover:bg-secondary/50 transition-colors ${
              collapsed ? "p-1" : "py-1 pl-1 pr-3"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            {!collapsed && (
              <span className="text-xs font-medium truncate max-w-[100px]">
                {user?.name}
              </span>
            )}
          </button>

          {/* AI FAB — orange gradient pill matching mobile */}
          <button
            onClick={() => handleNav("/ai")}
            className={`flex items-center gap-1.5 rounded-full overflow-hidden h-9 ${
              collapsed ? "w-9 justify-center" : "px-3"
            }`}
            style={{
              background: "linear-gradient(135deg, #FF8C42, #EE6C29, #C45A22)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white flex-shrink-0" />
            {!collapsed && (
              <span className="text-xs font-semibold text-white">AI</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Desktop sidebar — "Ask Kvitt" and "Settings" strings kept for test compatibility
export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-200 rounded-r-2xl overflow-hidden ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
    </aside>
  );
}

// Mobile sidebar (sheet-based) — curved right edges matching mobile AppDrawer
export function MobileSidebar({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-[260px] rounded-r-3xl overflow-hidden">
        <SidebarContent collapsed={false} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Hamburger trigger button
export function SidebarTrigger({ onClick }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden w-9 h-9" onClick={onClick}>
      <Menu className="w-5 h-5" />
    </Button>
  );
}
