import { useState } from "react";
import Navbar from "@/components/Navbar";
import { DesktopSidebar, MobileSidebar, SidebarTrigger } from "@/components/Sidebar";

export default function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
    </div>
  );
}
