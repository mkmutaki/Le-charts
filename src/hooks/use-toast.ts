
import { toast as sonnerToast, ToastT, useToaster } from "sonner";

// Re-export the toast function with the same API
export const toast = sonnerToast;

// Create useToast hook that provides access to toasts array
export function useToast() {
  return useToaster();
}
