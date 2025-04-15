
import { useState, useEffect } from 'react';
import { Key, Lock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/lib/store';

const UpdatePassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasResetSession, setHasResetSession] = useState(false);
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  // Check if we have an active auth session for password reset
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session check error:", error);
          setHasResetSession(false);
        } else {
          // A session exists, but we need to check if it's a password reset session
          // For security reasons, we can't directly check this, so we'll check if
          // the access token exists and there's a reset token in the URL
          const hasSession = Boolean(data.session?.access_token);
          const hasResetToken = window.location.hash.includes('type=recovery');
          setHasResetSession(hasSession && hasResetToken);
          
          console.log("Session check:", { 
            hasSession,
            hasResetToken,
            sessionExists: Boolean(data.session)
          });
        }
      } catch (error) {
        console.error("Session check error:", error);
        setHasResetSession(false);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast.error('Please enter your new password');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.updateUser({ 
        password: password 
      });
      
      if (error) {
        console.error("Password update error:", error);
        toast.error(error.message);
        return;
      }
      
      console.log("Password updated successfully:", data);
      setIsSuccess(true);
      toast.success('Password updated successfully');
      
      // Redirect to login after a delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Password update error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // While checking the session, show loading state
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
        <div className="w-full max-w-md p-8 space-y-4 text-center">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
          <p className="text-muted-foreground">Verifying your session...</p>
        </div>
      </div>
    );
  }
  
  // If we have a logged in user but not in a reset context, redirect to home
  if (currentUser && !hasResetSession) {
    return <Navigate to="/" replace />;
  }
  
  // If there's no valid reset session, redirect to the request page
  if (!hasResetSession) {
    return <Navigate to="/reset/request" replace />;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Update Your Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </div>
        
        {isSuccess ? (
          <Alert>
            <AlertDescription className="text-center py-2">
              <div className="flex justify-center mb-2">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <p className="mb-2">Your password has been updated successfully!</p>
              <p className="text-sm text-muted-foreground">You will be redirected to the login page shortly...</p>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Key className="h-5 w-5" />
                  </div>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Update Password</span>
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UpdatePassword;
