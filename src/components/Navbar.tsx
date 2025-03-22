
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Shield, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { currentUser, checkIsAdmin, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = checkIsAdmin();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleLogout = async () => {
    await logout();
    navigate('/');
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
                MusicChart
              </h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 bg-muted/50 text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            )}
            
            {!currentUser && (
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}
    </>
  );
};
