import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  Users,
  MessageCircle,
  Gamepad2,
  Receipt,
  Bell,
  FileText,
  Settings,
  Sparkles,
  ChevronLeft,
  Menu,
  Shield,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: Home },
  { path: "/groups", label: "Groups", icon: Users },
  { path: "/chats", label: "Chats", icon: MessageCircle },
  { path: "/history", label: "Settlements", icon: Receipt },
  { path: "/pending-requests", label: "View Requests", icon: FileText },
];

function SidebarContent({ collapsed, onNavigate, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isSuperAdmin } = useAuth();

  const isActive = (path) => location.pathname === path;

  const handleNav = (path) => {
    navigate(path);
    if (onNavigate) onNavigate();
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
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
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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
            {!collapsed && <span>{item.label}</span>}
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
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-border/50 space-y-1">
        {/* AI Assistant */}
        <Button
          variant="ghost"
          onClick={() => handleNav("/ai")}
          className={`w-full ${collapsed ? "justify-center px-2" : "justify-start"} ${
            isActive("/ai")
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed && <span>AI Assistant</span>}
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          onClick={() => handleNav("/settings")}
          className={`w-full ${collapsed ? "justify-center px-2" : "justify-start"} ${
            location.pathname.startsWith("/settings")
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className={`w-4 h-4 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed && <span>Settings</span>}
        </Button>

        {/* Profile pill */}
        <button
          onClick={() => handleNav("/profile")}
          className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.picture} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {user?.name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// Desktop sidebar
export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-200 ${
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

// Mobile sidebar (sheet-based)
export function MobileSidebar({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-[260px]">
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
