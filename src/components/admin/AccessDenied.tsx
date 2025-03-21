
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export const AccessDenied = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center text-primary">
          <ShieldAlert className="h-8 w-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. 
            Please contact an administrator if you believe this is an error.
          </p>
        </div>
        
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to homepage</span>
        </Link>
      </div>
    </div>
  );
};
