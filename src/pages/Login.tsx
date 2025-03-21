
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigate = useNavigate();
  const { login, isLoading, currentUser } = useAuthStore();
  
  // Check if already logged in
  useEffect(() => {
    if (currentUser && !isRedirecting) {
      console.log('User is logged in, redirecting to appropriate page', currentUser);
      setIsRedirecting(true);
      
      // Navigate based on admin status
      if (currentUser.isAdmin) {
        console.log('Redirecting admin to admin page');
        navigate('/admin');
      } else {
        console.log('Redirecting regular user to home');
        navigate('/');
      }
    }
  }, [currentUser, navigate, isRedirecting]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      console.log('Attempting login with email:', email);
      const result = await login(email, password);
      
      if (result.error) {
        setError(result.error);
      }
      // Redirection will be handled by the useEffect above
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred during login');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the admin area
          </p>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading || isRedirecting}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading || isRedirecting}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || isRedirecting}
          >
            {isLoading ? 'Logging in...' : isRedirecting ? 'Redirecting...' : 'Login'}
          </Button>
        </form>
        
        <div className="text-center">
          <Link 
            to="/"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Chart
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
