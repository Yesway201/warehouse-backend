import React from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import Layout from '@/components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Incoming from './pages/Incoming';
import IncomingDeliveries from './pages/IncomingDeliveries';
import Receive from './pages/Receive';
import Receiving from './pages/Receiving';
import ReviewQueue from './pages/ReviewQueue';
import LiveReceive from './pages/LiveReceive';
import ReceivingHistory from './pages/ReceivingHistory';
import SyncHistory from './pages/SyncHistory';
import Office from './pages/Office';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import Customers from './pages/Customers';
import NotFound from './pages/NotFound';

// Create QueryClient instance outside component to prevent recreation on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incoming" element={<Incoming />} />
        <Route path="/incoming-deliveries" element={<IncomingDeliveries />} />
        <Route path="/receive" element={<Receive />} />
        <Route path="/receive/:asnId" element={<Receiving />} />
        <Route path="/receive/quick/:deliveryId" element={<Receiving />} />
        <Route path="/receive/new" element={<Receiving />} />
        <Route path="/review-queue" element={<ReviewQueue />} />
        <Route path="/live-receive" element={<LiveReceive />} />
        <Route path="/history" element={<ReceivingHistory />} />
        <Route path="/sync-history" element={<SyncHistory />} />
        <Route path="/office" element={<Office />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <DataProvider>
              <AppRoutes />
            </DataProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;