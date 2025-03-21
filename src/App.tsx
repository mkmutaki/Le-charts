
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { SupabaseListener } from './components/SupabaseListener';
import { useAuthStore } from './lib/store';

import './App.css';

// Protected route component
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
