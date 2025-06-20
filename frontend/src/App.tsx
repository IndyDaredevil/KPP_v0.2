import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ApiTest from './components/ApiTest';
import DashboardPage from './pages/DashboardPage';
import ListingsPage from './pages/ListingsPage';
import HistoricalListingsPage from './pages/HistoricalListingsPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import SalesPage from './pages/SalesPage';

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      {/* API Test Route - accessible without auth for testing */}
      <Route path="/api-test" element={<ApiTest />} />

      {/* Auth routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="listings" element={<ListingsPage />} />
        <Route path="listings/:tokenId/sales-history" element={<SalesHistoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="historical" element={<HistoricalListingsPage />} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;