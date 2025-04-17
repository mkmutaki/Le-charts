
import { Button } from "@/components/ui/button";
import { useState } from "react";

// This component is only for testing the error boundary
export const TestErrorComponent = () => {
  const [throwError, setThrowError] = useState(false);
  
  if (throwError) {
    throw new Error("This is a test error triggered by the user");
  }
  
  return (
    <div className="p-4 text-center">
      <h2 className="text-lg font-semibold mb-3">Error Boundary Test</h2>
      <p className="mb-4 text-muted-foreground">
        Click the button below to trigger an error and test the error boundary
      </p>
      <Button
        variant="destructive"
        onClick={() => setThrowError(true)}
      >
        Trigger Error
      </Button>
    </div>
  );
};
