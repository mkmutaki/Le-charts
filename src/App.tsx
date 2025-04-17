
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseListener } from './components/SupabaseListener';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load components
const Index = lazy(() => import('./pages/Index'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const RequestReset = lazy(() => import('./pages/Reset/RequestReset'));
const AuthConfirm = lazy(() => import('./pages/Auth/Confirm'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <SupabaseListener />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route 
              path="/admin" 
              element={
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              } 
            />
            <Route path="/login" element={<Login />} />
            <Route path="/reset/request" element={<RequestReset />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster />
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
