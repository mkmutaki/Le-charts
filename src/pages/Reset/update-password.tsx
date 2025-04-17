import { useState, useEffect } from 'react';
import { Key, Lock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  // Instead of relying on supabase.auth.getSession, check the URL for a recovery token.
  useEffect(() => {
    const checkSessionOrRecovery = async () => {
      const searchParams = new URLSearchParams(location.search);
      const tokenHash = searchParams.get('token_hash');
      const isRecoveryFlow = searchParams.get('type') === 'recovery' && !!tokenHash;

      // If it's a recovery flow, accept it and bypass session check.
      if (isRecoveryFlow) {
        setHasResetFlow(true);
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

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('type') === 'recovery') {
      const tokenHash = searchParams.get('token_hash');
      if (!tokenHash) {
        toast.error('Missing token for password reset');
        return;
      }
      
      try {
        setIsLoading(true);
    
        // 1) Verify the one-time passcode (the token)
        //    Provide either `email` or `phone` depending on how your user received the reset link.
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          // email: userEmail,
          token_hash: tokenHash,
          type: 'recovery', // e.g. the email address used for resetting
        });
        if (verifyError) {
          console.error('OTP verification error:', verifyError);
          toast.error(verifyError.message);
          return;
        }

        // After successful verifyOtp (or getSessionFromUrl)
const { data: userData, error: userError } = await supabase.auth.getUser();
if (userError || !userData?.user?.email) {
  toast.error('Could not retrieve user information');
  return;
}

const { data: { session } } = await supabase.auth.getSession();
const user = session.user;

if (user.email !== userEmail) {
  toast.error('The email you entered does not match the email used for password reset');
  return;
}

        // 2) After OTP verification, update the user’s password
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password: password,
        });
        if (updateError) {
          console.error('Password update error:', updateError);
          toast.error(updateError.message);
          return;
        }

        // **Immediately sign out** so no session remains
        await supabase.auth.signOut()
       
        // if()
        console.log('Password updated successfully:', updateData);
        toast.success('Password updated successfully');
        setIsSuccess(true);
    
        // Optionally redirect to login after a delay
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
     else {
      // If the user is already authenticated, update their password normally.
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

  // While checking the session or reset flow, show a loading state.
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

  // If a user is logged in but not in a reset context, or there's no valid flow, redirect appropriately.
  if (currentUser && !hasResetFlow) {
    return <Navigate to="/" replace />;
  }
  if (!hasResetFlow) {
    return <Navigate to="/reset/request" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Update Your Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </div>
        <div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    value={userEmail}
    onChange={(e) => setUserEmail(e.target.value)}
    placeholder="your@email.com"
    disabled={isLoading}
  />
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
