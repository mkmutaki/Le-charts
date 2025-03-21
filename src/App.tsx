
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { SupabaseListener } from './components/SupabaseListener';
import { useAuthStore } from './lib/store';

import './App.css';

// Protected route component with improved error handling
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuthStore();
  const isAdmin = currentUser?.isAdmin || false;
  
  console.log('ProtectedRoute check - currentUser:', currentUser, 'isAdmin:', isAdmin);
  
  // If no user is logged in, redirect to login page
  if (!currentUser) {
    console.log('No user logged in, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // If user is logged in but not an admin, redirect to home
  if (!isAdmin) {
    console.log('User is not admin, redirecting to home');
    return <Navigate to="/" replace />;
  }
  
  // User is logged in and is an admin, show the children
  console.log('User is admin, showing protected content');
  return <>{children}</>;
};

function App() {
  // Use try-catch to prevent rendering errors from breaking the entire app
  try {
    return (
      <BrowserRouter>
        <SupabaseListener />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster position="top-center" />
      </BrowserRouter>
    );
  } catch (error) {
    console.error('Critical rendering error:', error);
    // Provide a fallback UI instead of a white screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
          <p className="text-muted-foreground">Please refresh the page to try again</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
}

export default App;
