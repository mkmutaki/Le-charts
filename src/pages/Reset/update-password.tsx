
import { useState, useEffect } from 'react';
import { Key, Lock, Check } from 'lucide-react';
import { supabase, hasResetToken } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
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
  const [hasResetFlow, setHasResetFlow] = useState(false);
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('');
  const [tokenHash, setTokenHash] = useState('');
  const [isTokenValid, setIsTokenValid] = useState(false);

  // Check for recovery token in URL and extract it
  useEffect(() => {
    const checkSessionOrRecovery = async () => {
      const searchParams = new URLSearchParams(location.search);
      const tokenFromURL = searchParams.get('token_hash');
      const isRecoveryFlow = searchParams.get('type') === 'recovery' && !!tokenFromURL;

      // If it's a recovery flow, accept it and bypass session check
      if (isRecoveryFlow) {
        setHasResetFlow(true);
        setTokenHash(tokenFromURL || '');
        setIsCheckingSession(false);
        return;
      }

      // Otherwise, check for an active session.
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Session check error:", error);
          setHasResetFlow(false);
        } else {
          const hasSession = Boolean(data.session?.access_token);
          setHasResetFlow(hasSession);
          console.log("Session check:", { 
            hasSession,
            sessionExists: Boolean(data.session)
          });
        }
      } catch (error) {
        console.error("Session check error:", error);
        setHasResetFlow(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSessionOrRecovery();
  }, [location]);

  // This function validates the token without needing to provide an email
  const validateToken = async () => {
    if (!tokenHash || !userEmail) return false;
    
    try {
      // Try to get user information from the token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      
      if (error) {
        console.error('Token validation error:', error);
        toast.error('Invalid or expired token');
        return false;
      }
      
      // The token is valid, now check if the email matches
      const session = data?.session;
      const tokenEmail = session?.user?.email;
      
      if (tokenEmail && tokenEmail.toLowerCase() === userEmail.toLowerCase()) {
        console.log('Email verified successfully');
        setIsTokenValid(true);
        return true;
      } else {
        console.error('Email mismatch:', { tokenEmail, userEmail });
        toast.error('The email you entered does not match the recovery request');
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      toast.error('Error validating recovery token');
      return false;
    }
  };

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
    
    if (!userEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('type') === 'recovery') {
      if (!tokenHash) {
        toast.error('Missing token for password reset');
        setIsLoading(false);
        return;
      }
      
      try {
        // First validate the token and email match
        const isValid = await validateToken();
        
        if (!isValid) {
          setIsLoading(false);
          return;
        }
        
        // 2) After token validation, update the user's password
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password: password,
        });
        
        if (updateError) {
          console.error('Password update error:', updateError);
          toast.error(updateError.message);
          setIsLoading(false);
          return;
        }

        console.log('Password updated successfully:', updateData);
        
        // 3) **Immediately sign out** so no session remains
        await supabase.auth.signOut();
       
        toast.success('Password updated successfully');
        setIsSuccess(true);
    
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
    } else {
      // If the user is already authenticated, update their password normally
      try {
        setIsLoading(true);
        const { data, error } = await supabase.auth.updateUser({
          password: password,
        });
        if (error) {
          console.error("Password update error:", error);
          toast.error(error.message);
          return;
        }
        console.log("Password updated successfully:", data);
        setIsSuccess(true);
        toast.success('Password updated successfully');
        
        // Sign the user out to prevent auto-login
        await supabase.auth.signOut();
        
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error) {
        console.error('Password update error:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // While checking the session or reset flow, show a loading state
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

  // If a user is logged in but not in a reset context, or there's no valid flow, redirect appropriately
  if (currentUser && !hasResetFlow && !hasResetToken()) {
    return <Navigate to="/" replace />;
  }
  
  if (!hasResetFlow && !hasResetToken()) {
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={isLoading}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter the email address associated with this password reset request
                </p>
              </div>
              
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
                    required
                    minLength={6}
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
                    required
                  />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={isLoading}>
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
