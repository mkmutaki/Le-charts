
import { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const RequestReset = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset/update-password`,
      });
      
      if (error) {
        console.error("Password reset request error:", error);
        toast.error(error.message);
        return;
      }
      
      console.log("Password reset email sent:", data);
      setIsSuccess(true);
      toast.success('Password reset link sent to your email');
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2">Enter your email to receive a password reset link</p>
        </div>
        
        {isSuccess ? (
          <Alert>
            <AlertDescription className="text-center py-2">
              <p className="mb-4">Password reset link sent!</p>
              <p className="mb-4">Please check your email for instructions to reset your password.</p>
              <Link to="/login">
                <Button variant="outline" className="mt-2">Return to Login</Button>
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Mail className="h-5 w-5" />
                </div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </Button>
              
              <div className="text-center">
                <Link to="/login" className="text-sm text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RequestReset;
