
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const AccessDenied = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="mb-4">You don't have permission to access this page.</p>
        <Link 
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Chart
        </Link>
      </div>
    </div>
  );
};
