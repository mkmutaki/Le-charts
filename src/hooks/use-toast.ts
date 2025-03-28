
import { toast as sonnerToast, useToast as sonnerUseToast } from "sonner";

// Re-export the toast function with the same API
export const toast = sonnerToast;

// Create useToast hook that provides access to toasts
export function useToast() {
  return {
    // Return an object that mimics what the toaster component expects
    toasts: [] // This provides compatibility with our toast UI
  };
}
