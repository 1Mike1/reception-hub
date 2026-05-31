import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ClientRoute } from "./components/auth/ClientRoute";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ClientsListPage from "./pages/admin/ClientsListPage";
import ClientDetailPage from "./pages/admin/ClientDetailPage";
import CallLogsPage from "./pages/admin/CallLogsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import PlansListPage from "./pages/admin/PlansListPage";
import PlanDetailPage from "./pages/admin/PlanDetailPage";
import UserFeedbackPage from "./pages/admin/UserFeedbackPage";
import ClientDashboard from "./pages/client/ClientDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
            {/* Auth */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Admin Routes - Protected with admin role */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="clients" element={<ClientsListPage />} />
              <Route path="clients/:id" element={<ClientDetailPage />} />
              <Route path="calls" element={<CallLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="plans" element={<PlansListPage />} />
              <Route path="plans/:id" element={<PlanDetailPage />} />
              <Route path="feedback" element={<UserFeedbackPage />} />
            </Route>

            {/* Client Routes - JSON-based client session OR Supabase client role */}
            <Route path="/dashboard" element={
              <ClientRoute>
                <ClientDashboard />
              </ClientRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
