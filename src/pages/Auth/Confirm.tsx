import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

const AuthConfirm = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Parse query parameters from the search string.
        const searchParams = new URLSearchParams(location.search);
        // Extract the token_hash parameter.
        const tokenHash = searchParams.get('token_hash');
        
        if (!tokenHash) {
          console.error("Missing token_hash in query parameters");
          toast.error("Invalid confirmation link");
          setIsProcessing(false);
          return;
        }
        
        console.log("Extracted token hash:", tokenHash);

        // Check if this is a recovery (password reset) flow.
        if (searchParams.get('type') === 'recovery') {
          console.log("Recovery flow detected, redirecting to password update page");
          // Redirect the user to the update password page,
          // appending the token_hash and type as query parameters.
          window.location.href = `/reset/update-password?token_hash=${tokenHash}&type=recovery`;
          return;
        }
        
        // Handle other authentication flows as needed.
        // When done, you can set isProcessing to false to trigger any fallback or redirect.
        setIsProcessing(false);
      } catch (error) {
        console.error("Error processing confirmation:", error);
        toast.error("Error processing confirmation");
        setIsProcessing(false);
      }
    };

    handleConfirmation();
  }, [location]);

  // If processing is complete (but no redirect occurred),
  // navigate the user to the home page as a fallback.
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
