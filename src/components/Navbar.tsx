import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Shield, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { currentUser, checkIsAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Get the admin status when component mounts or currentUser changes
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
    };
    
    checkAdmin();
  }, [currentUser, checkIsAdmin]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleLogout = async () => {
    try {
      console.log("Attempting to sign out");
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
        toast.error('Error signing out');
        return;
      }
      
      // DEBUGGING: Add explicit log for signout action
      console.log("Sign out API call successful, auth state change should follow");
      
      // The SupabaseListener will handle clearing the user state
      toast.success('Signed out successfully');
      navigate('/');
    } catch (err) {
      console.error("Exception during sign out:", err);
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <>
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 py-4 px-4 md:px-8 transition-all duration-300",
          isScrolled 
            ? "glass-effect shadow-sm" 
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <Music className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">
                LeCharts
              </h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}
    </>
  );
};
