
import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { Mail, Lock, LogIn, KeyRound } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { currentUser, checkAdminStatus } = useAuthStore();
  
  // Check admin status on mount and when currentUser changes
  useEffect(() => {
    const verifyAdmin = async () => {
      setIsCheckingAdmin(true);
      
      if (!currentUser) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }
      
      try {
        const adminStatus = await checkAdminStatus();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error verifying admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    
    verifyAdmin();
  }, [currentUser, checkAdminStatus]);
  
  // Redirect based on authentication and admin status
  if (!isCheckingAdmin) {
    if (currentUser && isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    
    if (currentUser && !isAdmin) {
      return <Navigate to="/" replace />;
    }
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log("Attempting to sign in with email and password");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error("Login error:", error);
        toast.error(error.message);
        return;
      }
      
      console.log("Login successful, response data:", data);
      
      if (!data.user) {
        console.error("No user returned from login");
        toast.error("Login failed - no user returned");
        return;
      }
      
      // The auth state change listener will handle updating the store
      toast.success('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show loading state while checking admin status
  if (isCheckingAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="p-6 rounded-lg max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Verifying access...</h2>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-muted-foreground mt-2">Sign in to access the admin dashboard</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="pl-10 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Sign in</span>
                </>
              )}
            </button>
            
            <Link to="/reset/request">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 bg-secondary/80 text-secondary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                disabled={isLoading}
              >
                <KeyRound className="h-4 w-4" />
                <span>Reset Password</span>
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
