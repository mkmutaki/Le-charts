
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { SupabaseListener } from './components/SupabaseListener';
import { useAuthStore } from './lib/store';
import { AccessDenied } from './components/admin/AccessDenied';

import './App.css';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, checkIsAdmin } = useAuthStore();
  const isAdmin = checkIsAdmin();
  
  // If no user is logged in, redirect to login page
  if (!currentUser) {
    console.log('No user logged in, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // If user is logged in but not an admin, show access denied
  if (!isAdmin) {
    console.log('User is not admin, showing access denied');
    return <AccessDenied />;
  }
  
  // User is logged in and is an admin, show the children
  console.log('User is admin, showing protected content');
  return <>{children}</>;
};

function App() {
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
}

export default App;
