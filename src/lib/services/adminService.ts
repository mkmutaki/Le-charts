import { supabase } from '@/integrations/supabase/client';

export interface AdminStatusResult {
  isAdmin: boolean;
  error: string | null;
}

export async function getAdminStatus(userId?: string | null): Promise<AdminStatusResult> {
  if (!userId) {
    return { isAdmin: false, error: null };
  }

  const { data, error } = await supabase.rpc('is_admin', { id: userId });

  if (error) {
    return { isAdmin: false, error: error.message };
  }

  return { isAdmin: Boolean(data), error: null };
}

export async function isAdminUser(userId?: string | null): Promise<boolean> {
  const result = await getAdminStatus(userId);
  return result.isAdmin;
}

export async function resetAllVotes(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('reset_all_votes');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
