
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Moon, Sun, LayoutDashboard, LogOut, Key, Menu, HelpCircle, Trophy, Settings, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { Toggle } from './ui/toggle';
import { ResetPasswordModal } from './ResetPasswordModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from './ui/dialog';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { currentUser, checkAdminStatus } = useAuthStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') !== 'light';
    }
    return true;
  });
  
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  useEffect(() => {
    const checkAdmin = async () => {
      if (!currentUser) {
        setIsAdmin(false);
        return;
      }
      
      try {
        const adminStatus = await checkAdminStatus();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, [currentUser, checkAdminStatus]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
        toast.error('Error signing out');
        return;
      }
      
      toast.success('Signed out successfully');
      navigate('/');
    } catch (err) {
      console.error("Exception during sign out:", err);
      toast.error('An unexpected error occurred');
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
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
          {/* Left side - Hamburger menu and logo */}
          <div className="flex items-center gap-20">
            <ArrowLeft className="h-6 w-6" />
            {/* <button 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button> */}
            <Link to="/" className="flex items-center gap-1">
              <img className='w-9 h-9' src="/logo.png" alt="LeCharts" />
              <h1 className="text-xl font-semibold tracking-tight">
                LeCharts
              </h1>
            </Link>
          </div>
          
          {/* Right side - Icons and admin controls */}
          <div className="flex items-center gap-3">
            {/* Help, Leaderboard, Settings icons */}
            <div className="flex items-center gap-2">
              <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
                <DialogTrigger asChild>
                  <button 
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Help"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md text-center">
                  <DialogHeader>
                    <DialogTitle className='text-center'>Welcome!</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm leading-relaxed">
                    <p>
                      Le Charts was conceived to give people the chance to rank their favourite albums and songs against each other, providing charts that you can trust.
                    </p>
                    <p>
                      But before you can vote, a fun puzzle awaits. Use the "view reference" button to see how the tiles should be arranged.
                    </p>
                    <p>
                      Good luck and happy voting!
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              {/* <button 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Leaderboard"
              >
                <Trophy className="h-5 w-5" />
              </button> */}
              {/* <button 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button> */}
            </div>

            {/* Dark mode toggle */}
            <Toggle 
              pressed={isDarkMode}
              onPressedChange={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="rounded-full p-2"
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Toggle>

            {isAdmin && (
              <>
                {/* Admin Navigation Options */}
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Navbar divider line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-800 to-transparent dark:via-gray-600"></div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}
      
      {/* Reset Password Modal */}
      <ResetPasswordModal 
        isOpen={isResetPasswordOpen} 
        onClose={() => setIsResetPasswordOpen(false)} 
      />
    </>
  );
};
