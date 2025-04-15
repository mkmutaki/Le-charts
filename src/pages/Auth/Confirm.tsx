
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AuthConfirm = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = location.hash;
        
        console.log("Processing confirmation with hash:", hashFragment);
        
        if (!hashFragment || !hashFragment.includes('type=')) {
          console.error("Invalid or missing hash parameters");
          toast.error('Invalid confirmation link');
          setIsProcessing(false);
          return;
        }
        
        // Check if this is a recovery (password reset) flow
        if (hashFragment.includes('type=recovery')) {
          console.log("Recovery flow detected, redirecting to password update page");
          // Let the update-password page handle the actual password reset
          window.location.href = '/reset/update-password' + hashFragment;
          return;
        }
        
        // For other auth flows, process here
        // For example, email confirmation
        setIsProcessing(false);
        toast.info('Confirmation processed');
        
      } catch (error) {
        console.error("Confirmation processing error:", error);
        toast.error('Error processing confirmation');
        setIsProcessing(false);
      }
    };

    handleConfirmation();
  }, [location]);

  if (!isProcessing) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10">
      <div className="w-full max-w-md p-8 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
        <p className="text-muted-foreground">Processing your request...</p>
      </div>
    </div>
  );
};

export default AuthConfirm;
