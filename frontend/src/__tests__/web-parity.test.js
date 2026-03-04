/**
 * Web-Mobile Parity Tests
 *
 * Validates that all new pages, routes, and navigation exist.
 */

const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "..");

function fileExists(relPath) {
  return fs.existsSync(path.join(srcDir, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(srcDir, relPath), "utf8");
}

function fileHasExport(relPath) {
  const content = readFile(relPath);
  return content.includes("export default") || content.includes("export {") || content.includes("export function");
}

describe("Web-Mobile Parity - New Pages Exist", () => {
  const pages = [
    "pages/Settings.jsx",
    "pages/NotificationSettings.jsx",
    "pages/Chats.jsx",
    "pages/GroupChat.jsx",
    "pages/PendingRequests.jsx",
    "pages/RequestAndPay.jsx",
    "pages/AIAssistantPage.jsx",
    "pages/Feedback.jsx",
  ];

  pages.forEach((page) => {
    test(`${page} exists and has export`, () => {
      expect(fileExists(page)).toBe(true);
      expect(fileHasExport(page)).toBe(true);
    });
  });
});

describe("Web-Mobile Parity - Sidebar Component", () => {
  test("Sidebar.jsx exists", () => {
    expect(fileExists("components/Sidebar.jsx")).toBe(true);
  });

  test("Sidebar exports DesktopSidebar, MobileSidebar, SidebarTrigger", () => {
    const content = readFile("components/Sidebar.jsx");
    expect(content).toContain("export function DesktopSidebar");
    expect(content).toContain("export function MobileSidebar");
    expect(content).toContain("export function SidebarTrigger");
  });

  test("Sidebar has all nav items matching mobile drawer", () => {
    const content = readFile("components/Sidebar.jsx");
    expect(content).toContain("Dashboard");
    expect(content).toContain("Groups");
    expect(content).toContain("Chats");
    expect(content).toContain("Settlements");
    expect(content).toContain("View Requests");
    expect(content).toContain("AI Assistant");
    expect(content).toContain("Settings");
  });
});

describe("Web-Mobile Parity - Route Configuration", () => {
  test("App.js imports all new pages", () => {
    const content = readFile("App.js");

    expect(content).toContain('import SettingsPage from "@/pages/Settings"');
    expect(content).toContain('import NotificationSettings from "@/pages/NotificationSettings"');
    expect(content).toContain('import Chats from "@/pages/Chats"');
    expect(content).toContain('import GroupChat from "@/pages/GroupChat"');
    expect(content).toContain('import PendingRequests from "@/pages/PendingRequests"');
    expect(content).toContain('import RequestAndPay from "@/pages/RequestAndPay"');
    expect(content).toContain('import AIAssistantPage from "@/pages/AIAssistantPage"');
    expect(content).toContain('import FeedbackPage from "@/pages/Feedback"');
  });

  test("App.js has all new routes", () => {
    const content = readFile("App.js");

    expect(content).toContain('path="/settings"');
    expect(content).toContain('path="/settings/notifications"');
    expect(content).toContain('path="/chats"');
    expect(content).toContain('path="/chats/:groupId"');
    expect(content).toContain('path="/pending-requests"');
    expect(content).toContain('path="/request-pay"');
    expect(content).toContain('path="/ai"');
    expect(content).toContain('path="/feedback"');
  });

  test("All new routes are protected", () => {
    const content = readFile("App.js");

    // Each new route should be wrapped in ProtectedRoute
    const routes = ["/settings", "/settings/notifications", "/chats", "/pending-requests", "/request-pay", "/ai", "/feedback"];
    for (const route of routes) {
      const idx = content.indexOf(`path="${route}"`);
      expect(idx).toBeGreaterThan(-1);
      // Check that ProtectedRoute appears between this route and the next
      const after = content.substring(idx, idx + 200);
      expect(after).toContain("ProtectedRoute");
    }
  });
});

describe("Web-Mobile Parity - Navigation Updates", () => {
  test("Navbar has expanded nav links", () => {
    const content = readFile("components/Navbar.jsx");

    expect(content).toContain('"/chats"');
    expect(content).toContain('"Chats"');
    expect(content).toContain('"/history"');
    expect(content).toContain('"Settlements"');
    expect(content).toContain('"/pending-requests"');
    expect(content).toContain('"Requests"');
  });

  test("Navbar user dropdown has Settings", () => {
    const content = readFile("components/Navbar.jsx");
    expect(content).toContain("'/settings'");
  });

  test("Navbar user dropdown has Request & Pay", () => {
    const content = readFile("components/Navbar.jsx");
    expect(content).toContain("'/request-pay'");
  });
});

describe("Web-Mobile Parity - Page Content", () => {
  test("Settings page has all sections matching mobile", () => {
    const content = readFile("pages/Settings.jsx");
    expect(content).toContain("Profile & Account");
    expect(content).toContain("Preferences");
    expect(content).toContain("Support");
    expect(content).toContain("Sign Out");
    expect(content).toContain("/settings/notifications");
    expect(content).toContain("/automations");
    expect(content).toContain("/wallet");
    expect(content).toContain("/request-pay");
    expect(content).toContain("/ai");
    expect(content).toContain("/feedback");
  });

  test("NotificationSettings has push toggles and engagement prefs", () => {
    const content = readFile("pages/NotificationSettings.jsx");
    expect(content).toContain("push_enabled");
    expect(content).toContain("game_updates_enabled");
    expect(content).toContain("settlements_enabled");
    expect(content).toContain("group_invites_enabled");
    expect(content).toContain("/notifications/preferences");
    expect(content).toContain("/engagement/preferences");
    expect(content).toContain("Engagement Notifications");
    expect(content).toContain("Quiet Hours");
  });

  test("GroupChat has socket connection and message sending", () => {
    const content = readFile("pages/GroupChat.jsx");
    expect(content).toContain("join_group");
    expect(content).toContain("leave_group");
    expect(content).toContain("group_message");
    expect(content).toContain("group_typing");
    expect(content).toContain("/groups/${groupId}/messages");
    expect(content).toContain("handleSend");
  });

  test("PendingRequests handles invites", () => {
    const content = readFile("pages/PendingRequests.jsx");
    expect(content).toContain("/users/invites");
    expect(content).toContain("accept");
    expect(content).toContain("decline");
  });

  test("RequestAndPay has pay and request actions", () => {
    const content = readFile("pages/RequestAndPay.jsx");
    expect(content).toContain("/ledger/consolidated-detailed");
    expect(content).toContain("/ledger/pay-net/prepare");
    expect(content).toContain("request-payment");
    expect(content).toContain("handlePayNet");
    expect(content).toContain("handleRequestPayment");
  });

  test("Feedback page has form, success, and history views", () => {
    const content = readFile("pages/Feedback.jsx");
    expect(content).toContain("feedback_type");
    expect(content).toContain("/feedback");
    expect(content).toContain("/feedback/my");
    expect(content).toContain("bug");
    expect(content).toContain("feature_request");
    expect(content).toContain("severity");
  });

  test("AIAssistantPage has chat interface", () => {
    const content = readFile("pages/AIAssistantPage.jsx");
    expect(content).toContain("/ai/chat");
    expect(content).toContain("conversation_history");
    expect(content).toContain("GradientOrb");
  });
});
