import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseListener } from './components/SupabaseListener';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import WelcomeOverlay from './components/WelcomeOverlay';

// Lazy load components
const Index = lazy(() => import('./pages/Index'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const RequestReset = lazy(() => import('./pages/Reset/RequestReset'));
const AuthConfirm = lazy(() => import('./pages/Auth/Confirm'));
const NotFound = lazy(() => import('./pages/NotFound'));
const TilePuzzle = lazy(() => import('@/components/TilePuzzle'));
const PuzzlePage = lazy(() => import('./pages/PuzzlePage'));

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

// Create a component that decides what to show on the home route
const HomeRoute = ({ showPuzzle, onPuzzleComplete }: { showPuzzle: boolean; onPuzzleComplete: () => void }) => {
  const { currentUser } = useAuthStore();
  
  // If user is authenticated, show Index directly
  if (currentUser) {
    return <Index />;
  }

  // If puzzle completed, show Index
  if (!showPuzzle) {
    return <Index />;
  }

  // Otherwise show puzzle
  return <TilePuzzle onComplete={onPuzzleComplete} />;
};

// Main app content
const AppContent = () => {
  const location = useLocation();
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(true);
  const [showPuzzle, setShowPuzzle] = useState(true);
  const { currentUser } = useAuthStore();
  
  // Reset puzzle state when user becomes unauthenticated
  useEffect(() => {
    if (!currentUser) {
      setShowPuzzle(true);
    }
  }, [currentUser]);

  // Routes where welcome overlay should NOT be displayed
  const excludedRoutes = ['/login', '/admin', '/reset/request', '/auth/confirm'];
  
  // Check if current route should exclude the welcome overlay
  const shouldShowOverlay = !excludedRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  const handleWelcomeOverlayDismiss = () => {
    setShowWelcomeOverlay(false);
  };

  const handlePuzzleComplete = () => {
    setShowPuzzle(false);
  };

  const handleSkipToVote = () => {
    setShowPuzzle(false);
  };

  return (
    <>
      <ErrorBoundary>
        <SupabaseListener />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomeRoute showPuzzle={showPuzzle} onPuzzleComplete={handlePuzzleComplete} />} />
            <Route 
              path="/admin/*" 
              element={
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              } 
            />
            <Route path="/login" element={<Login />} />
            <Route path="/reset/request" element={<RequestReset />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route 
              path="/puzzle" 
              element={
                <ErrorBoundary>
                  <PuzzlePage />
                </ErrorBoundary>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster />
      </ErrorBoundary>

      {/* Welcome overlay - highest priority, shows first on appropriate pages */}
      {showWelcomeOverlay && shouldShowOverlay && (
        <WelcomeOverlay onDismiss={handleWelcomeOverlayDismiss} onComplete={handleSkipToVote} />
      )}
    </>
  );
}

function App() {
  // Online/offline detection
  useEffect(() => {
    // Handle offline status
    const handleOffline = () => {
      const offlineNotification = document.getElementById('offline-notification');
      if (offlineNotification) {
        offlineNotification.style.display = 'block';
        setTimeout(() => {
          offlineNotification.style.transform = 'translateY(0)';
          offlineNotification.style.opacity = '1';
        }, 100);
      }
      toast.error('You are offline', {
        description: 'Some features may not work properly until connection is restored',
        duration: 5000,
      });
    };

    // Handle online status
    const handleOnline = () => {
      const offlineNotification = document.getElementById('offline-notification');
      if (offlineNotification) {
        offlineNotification.style.transform = 'translateY(20px)';
        offlineNotification.style.opacity = '0';
        setTimeout(() => {
          offlineNotification.style.display = 'none';
        }, 300);
      }
      toast.success('You are back online', {
        description: 'All features are now available',
        duration: 3000,
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
