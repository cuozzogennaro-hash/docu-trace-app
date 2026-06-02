import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth";
import ResetPasswordPage from "./pages/ResetPassword";
import Sanitations from "./pages/Sanitations";
import Temperatures from "./pages/Temperatures";
import Incoming from "./pages/Incoming";
import Production from "./pages/Production";
import Clients from "./pages/Clients";
import Shopping from "./pages/Shopping";
import Settings from "./pages/Settings";
import Archive from "./pages/Archive";
import RecurringPage from "./pages/Recurring";
import Reports from "./pages/Reports";
import RawMaterialDetail from "./pages/RawMaterialDetail";
import ProductDetail from "./pages/ProductDetail";
import BlastChillings from "./pages/BlastChillings";
import Preparations from "./pages/Preparations";
import Holding from "./pages/Holding";
import OilChecks from "./pages/OilChecks";
import NonConformities from "./pages/NonConformities";
import Menu from "./pages/Menu";
import AppShell from "./components/AppShell";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { OperatorSessionProvider, useOperatorSession } from "./hooks/useOperatorSession";
import SubscriptionPage from "./pages/Subscription";
import TermsPage from "./pages/legal/Terms";
import RefundPage from "./pages/legal/Refund";
import PrivacyPage from "./pages/legal/Privacy";
import SubscriptionGate from "./components/SubscriptionGate";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner";
import { useTranslation } from "react-i18next";

const queryClient = new QueryClient();

function Protected() {
  const { session, loading } = useAuth();
  const { operator } = useOperatorSession();
  if (loading) return <LoadingScreen />;
  if (!session && !operator) return <Navigate to="/auth" replace />;
  return (
    <SubscriptionGate>
      <PaymentTestModeBanner />
      <AppShell />
    </SubscriptionGate>
  );
}

function AuthOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {t("Caricamento…")}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OperatorSessionProvider>
            <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/abbonamento" element={<SubscriptionPage />} />
            <Route path="/termini" element={<TermsPage />} />
            <Route path="/rimborsi" element={<RefundPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route element={<Protected />}>
              <Route path="/" element={<Index />} />
              <Route path="/sanificazione" element={<Sanitations />} />
              <Route path="/temperature" element={<Temperatures />} />
              <Route path="/ingresso" element={<Incoming />} />
              <Route path="/produzione" element={<Production />} />
              <Route path="/clienti" element={<Clients />} />
              <Route path="/acquisti" element={<Shopping />} />
              <Route path="/archivio" element={<Archive />} />
              <Route path="/ricorrenti" element={<RecurringPage />} />
              <Route path="/abbattimenti" element={<BlastChillings />} />
              <Route path="/preparati" element={<Preparations />} />
              <Route path="/mantenimento" element={<Holding />} />
              <Route path="/frittura" element={<OilChecks />} />
              <Route path="/non-conformita" element={<NonConformities />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/report" element={<Reports />} />
              <Route path="/archivio/materia-prima/:id" element={<RawMaterialDetail />} />
              <Route path="/archivio/prodotto/:id" element={<ProductDetail />} />
              <Route path="/impostazioni" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </OperatorSessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
