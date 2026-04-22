import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth";
import Sanitations from "./pages/Sanitations";
import Temperatures from "./pages/Temperatures";
import Incoming from "./pages/Incoming";
import Production from "./pages/Production";
import Clients from "./pages/Clients";
import Shopping from "./pages/Shopping";
import Settings from "./pages/Settings";
import Archive from "./pages/Archive";
import AppShell from "./components/AppShell";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { OperatorSessionProvider, useOperatorSession } from "./hooks/useOperatorSession";

const queryClient = new QueryClient();

function Protected() {
  const { session, loading } = useAuth();
  const { operator } = useOperatorSession();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  if (!session && !operator) return <Navigate to="/auth" replace />;
  return <AppShell />;
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
            <Route element={<Protected />}>
              <Route path="/" element={<Index />} />
              <Route path="/sanificazione" element={<Sanitations />} />
              <Route path="/temperature" element={<Temperatures />} />
              <Route path="/ingresso" element={<Incoming />} />
              <Route path="/produzione" element={<Production />} />
              <Route path="/clienti" element={<Clients />} />
              <Route path="/acquisti" element={<Shopping />} />
              <Route path="/archivio" element={<Archive />} />
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
