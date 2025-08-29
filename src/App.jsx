import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BarcodeProvider } from './context/BarcodeContext';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';
const POSScreen = lazy(() => import('./components/POS/POSScreen'));
const InventoryScreen = lazy(() => import('./components/Inventory/InventoryScreen'));
const AnalyticsScreen = lazy(() => import('./components/Analytics/AnalyticsScreen'));
const DashboardScreen = lazy(() => import('./components/Dashboard/DashboardScreen'));
const SettingsScreen = lazy(() => import('./components/Settings/SettingsScreen'));
const SalesScreen = lazy(() => import('./components/Sales/SalesScreen'));

function AppRoutes() {
  const { login, isAuthenticated } = useAuth();

  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-500"></div>
      </div>
    }>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/" replace /> : 
            <LoginPage onLogin={login} />
          } 
        />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardScreen />} />
            <Route path="pos" element={<POSScreen />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="sales" element={<SalesScreen />} />
            <Route path="analytics" element={<AnalyticsScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <BarcodeProvider>
            <ThemeProvider>
              <AppRoutes />
              <Toaster 
                position="top-right"
                toastOptions={{
                  className: 'dark:bg-slate-800 dark:text-white',
                  duration: 3000,
                  style: {
                    background: '#fff',
                    color: '#363636',
                  },
                }}
              >
                {(t) => (
                  <ToastBar toast={t}>
                    {({ icon, message }) => (
                      <div
                        onClick={() => toast.dismiss(t.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {icon}
                        {message}
                      </div>
                    )}
                  </ToastBar>
                )}
              </Toaster>
            </ThemeProvider>
          </BarcodeProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
