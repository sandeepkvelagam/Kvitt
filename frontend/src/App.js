import React, { useEffect, useState, useRef, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AIAssistant from "@/components/AIAssistant";
import AppLayout from "@/components/AppLayout";
import { NavigationProvider } from "@/context/NavigationContext";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Groups from "@/pages/Groups";
import GroupHub from "@/pages/GroupHub";
import GameNight from "@/pages/GameNight";
import Settlement from "@/pages/Settlement";
import Profile from "@/pages/Profile";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Press from "@/pages/Press";
import GameHistory from "@/pages/GameHistory";
import Premium from "@/pages/Premium";
import SpotifyCallback from "@/pages/SpotifyCallback";
import Wallet from "@/pages/Wallet";
import Automations from "@/pages/Automations";
import DashboardRedesign from "@/pages/DashboardRedesign";
import SettingsPage from "@/pages/Settings";
import NotificationSettings from "@/pages/NotificationSettings";
import Chats from "@/pages/Chats";
import GroupChat from "@/pages/GroupChat";
import PendingRequests from "@/pages/PendingRequests";
import RequestAndPay from "@/pages/RequestAndPay";
import AIAssistantPage from "@/pages/AIAssistantPage";
import FeedbackPage from "@/pages/Feedback";
import AppearancePage from "@/pages/Appearance";
import LanguagePage from "@/pages/Language";
import VoiceCommandsPage from "@/pages/VoiceCommands";
import BillingPage from "@/pages/Billing";
import SchedulerPage from "@/pages/SchedulerPage";
import CreateEventPage from "@/pages/CreateEventPage";
import EventDashboardPage from "@/pages/EventDashboard";
import RSVPPage from "@/pages/RSVPPage";
import DashboardLab from "@/pages/DashboardLab";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Setup axios interceptor to add Supabase JWT to every request
import { supabase } from "@/lib/supabase";

axios.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute - isLoading:', isLoading, 'user:', user?.email);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <NavigationProvider>
      <AppLayout>{children}</AppLayout>
    </NavigationProvider>
  );
};

// Public Route (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Super Admin Route (requires super_admin role)
const SuperAdminRoute = ({ children }) => {
  const { user, isLoading, userDataReady, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait for backend user data (app_role) before checking super admin
  if (!userDataReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Lazy load admin components
const AdminDashboard = React.lazy(() => import('@/pages/admin/AdminDashboard'));
const AlertsPage = React.lazy(() => import('@/pages/admin/AlertsPage'));
const IncidentDetail = React.lazy(() => import('@/pages/admin/IncidentDetail'));
const UserReportsPage = React.lazy(() => import('@/pages/admin/UserReportsPage'));
const UserReportDetail = React.lazy(() => import('@/pages/admin/UserReportDetail'));

function App() {
  return (
    <div className="App min-h-screen bg-background">
      <BrowserRouter>
        <LanguageProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/press" element={<Press />} />
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/signup" element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            } />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard-redesign" element={
              <ProtectedRoute>
                <DashboardRedesign />
              </ProtectedRoute>
            } />
            <Route path="/dashboard-lab" element={
              <ProtectedRoute>
                <DashboardLab />
              </ProtectedRoute>
            } />
            <Route path="/groups" element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            } />
            <Route path="/groups/:groupId" element={
              <ProtectedRoute>
                <GroupHub />
              </ProtectedRoute>
            } />
            <Route path="/games/:gameId" element={
              <ProtectedRoute>
                <GameNight />
              </ProtectedRoute>
            } />
            <Route path="/games/:gameId/settlement" element={
              <ProtectedRoute>
                <Settlement />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute>
                <GameHistory />
              </ProtectedRoute>
            } />
            <Route path="/premium" element={
              <ProtectedRoute>
                <Premium />
              </ProtectedRoute>
            } />
            <Route path="/premium/success" element={
              <ProtectedRoute>
                <Premium />
              </ProtectedRoute>
            } />
            <Route path="/wallet" element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            } />
            <Route path="/automations" element={
              <ProtectedRoute>
                <Automations />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings/notifications" element={
              <ProtectedRoute>
                <NotificationSettings />
              </ProtectedRoute>
            } />
            <Route path="/chats" element={
              <ProtectedRoute>
                <Chats />
              </ProtectedRoute>
            } />
            <Route path="/chats/:groupId" element={
              <ProtectedRoute>
                <GroupChat />
              </ProtectedRoute>
            } />
            <Route path="/pending-requests" element={
              <ProtectedRoute>
                <PendingRequests />
              </ProtectedRoute>
            } />
            <Route path="/request-pay" element={
              <ProtectedRoute>
                <RequestAndPay />
              </ProtectedRoute>
            } />
            <Route path="/ai" element={
              <ProtectedRoute>
                <AIAssistantPage />
              </ProtectedRoute>
            } />
            <Route path="/feedback" element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            } />
            <Route path="/settings/appearance" element={
              <ProtectedRoute>
                <AppearancePage />
              </ProtectedRoute>
            } />
            <Route path="/settings/language" element={
              <ProtectedRoute>
                <LanguagePage />
              </ProtectedRoute>
            } />
            <Route path="/settings/voice-commands" element={
              <ProtectedRoute>
                <VoiceCommandsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings/billing" element={
              <ProtectedRoute>
                <BillingPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule" element={
              <ProtectedRoute>
                <SchedulerPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule/create" element={
              <ProtectedRoute>
                <CreateEventPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule/event/:occurrenceId" element={
              <ProtectedRoute>
                <EventDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule/rsvp/:occurrenceId" element={
              <ProtectedRoute>
                <RSVPPage />
              </ProtectedRoute>
            } />

            {/* Super Admin routes */}
            <Route path="/admin" element={
              <SuperAdminRoute>
                <Suspense fallback={
                  <div className="min-h-screen bg-[#060918] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <AdminDashboard />
                </Suspense>
              </SuperAdminRoute>
            } />
            <Route path="/admin/alerts" element={
              <SuperAdminRoute>
                <Suspense fallback={
                  <div className="min-h-screen bg-[#060918] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <AlertsPage />
                </Suspense>
              </SuperAdminRoute>
            } />
            <Route path="/admin/incidents/:incidentId" element={
              <SuperAdminRoute>
                <Suspense fallback={
                  <div className="min-h-screen bg-[#060918] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <IncidentDetail />
                </Suspense>
              </SuperAdminRoute>
            } />
            <Route path="/admin/feedback" element={
              <SuperAdminRoute>
                <Suspense fallback={
                  <div className="min-h-screen bg-[#060918] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <UserReportsPage />
                </Suspense>
              </SuperAdminRoute>
            } />
            <Route path="/admin/feedback/:feedbackId" element={
              <SuperAdminRoute>
                <Suspense fallback={
                  <div className="min-h-screen bg-[#060918] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <UserReportDetail />
                </Suspense>
              </SuperAdminRoute>
            } />

            {/* Spotify OAuth Callback */}
            <Route path="/spotify/callback" element={<SpotifyCallback />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <AppContent />
        </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

// Separate component to access auth context
function AppContent() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Only show AI assistant for logged-in users
  if (!user) return null;
  
  return <AIAssistant currentPage={location.pathname} />;
}

export default App;
