import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, LayoutDashboard, LogOut, Menu, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore, useWeekendStore } from '@/lib/store';
import { Toggle } from './ui/toggle';
import { ResetPasswordModal } from './ResetPasswordModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const [isDesktopHelpOpen, setIsDesktopHelpOpen] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState<string | null>(null);
  const { currentUser, checkAdminStatus } = useAuthStore();
  const { weeklyChampions, fetchWeeklyChampions } = useWeekendStore();
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

  useEffect(() => {
    fetchWeeklyChampions(undefined, { force: true });
  }, [fetchWeeklyChampions]);
  
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

  const topSongs = weeklyChampions.slice(0, 3);
  const selectedChampion = topSongs.find((champion) => champion.scheduledTrackId === selectedChampionId) ?? null;
  const logoSrc = isDarkMode ? '/logo.png' : '/logo-black.png';

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
        <div className="max-w-7xl mx-auto">
          <div className="md:hidden grid grid-cols-3 items-center gap-2">
            <div className="justify-self-start">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Open menu"
                  >
                    <Menu className="h-7 w-7" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] max-w-xs px-4 py-5">
                  <SheetHeader className="mb-4 text-left">
                    <div className="flex gap-7 flex-col">
                      <img className="w-9 h-9 shrink-0 items-start -translate-y-4 -translate-x-2" src={logoSrc} alt="LeCharts" />
                      <SheetTitle className='text-center'>Last weeks winners</SheetTitle>
                    </div>
                  </SheetHeader>

                  <div className="space-y-3">
                    {topSongs.length > 0 ? (
                      topSongs.map((champion, index) => (
                        <button
                          type="button"
                          key={`${champion.weekStartDate}-${champion.finalRank}-${champion.scheduledTrackId}`}
                          className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card/70 p-2 text-left transition-colors hover:bg-card"
                          onClick={() => setSelectedChampionId(champion.scheduledTrackId)}
                        >
                          <span className="text-xs font-semibold text-muted-foreground w-4">#{index + 1}</span>
                          <img
                            src={champion.artworkUrl || 'https://placehold.co/64x64/0b0b0f/f5f5f7?text=%E2%80%A2'}
                            alt={`${champion.trackName} artwork`}
                            className="h-9 w-9 rounded object-cover border border-border/70"
                            loading="lazy"
                          />
                          <span className="truncate text-sm" title={champion.trackName}>
                            {champion.trackName}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No top songs available right now.</p>
                    )}

                    <div className="pt-2 border-t border-border/70 flex items-center justify-between">
                      <span className="text-sm font-medium">Theme</span>
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
                    </div>

                    {isAdmin && (
                      <div className="pt-2 space-y-2">
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            navigate('/admin');
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Dashboard</span>
                        </button>
                        <button
                          onClick={async () => {
                            setIsMobileMenuOpen(false);
                            await handleLogout();
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="justify-self-center flex items-center gap-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight mt-1">LeCharts</h1>
            </div>

            <div className="justify-self-end">
              <Dialog open={isMobileHelpOpen} onOpenChange={setIsMobileHelpOpen}>
                <DialogTrigger asChild>
                  <button
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Information"
                  >
                    <HelpCircle className="h-7 w-7" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md text-center">
                  <DialogHeader>
                    <DialogTitle className='text-center'>How it works?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm leading-relaxed">
                    <p>
                      Le Charts was conceived to give people the chance to battle out their favourite albums and songs against each other, creating new charts weekly.
                    </p>
                    <p>
                      But before you vote, a puzzle awaits. Correctly rearrange the album cover in the shortest moves possible. Use the "view reference" button to see how the cover should look.
                    </p>
                    <p>
                      Good luck and happy voting!
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center shrink-0">
              <img className='w-9 h-9' src={logoSrc} alt="LeCharts" />
              <h1 className="text-xl font-semibold tracking-tight mt-1">
                LeCharts
              </h1>
            </div>

            <div className="flex-1 min-w-0">
              {weeklyChampions.length > 0 && (
                <div className="flex items-center justify-center gap-2 overflow-x-auto px-1">
                  {topSongs.map((champion) => (
                    <button
                      type="button"
                      key={`${champion.weekStartDate}-${champion.finalRank}-${champion.scheduledTrackId}`}
                      className="flex items-center gap-2 rounded-full border border-blue-400/40 bg-card/80 px-3 py-1.5 backdrop-blur-sm max-w-48 transition-colors hover:bg-card"
                      data-testid="champion-pill"
                      onClick={() => setSelectedChampionId(champion.scheduledTrackId)}
                    >
                      <img
                        src={champion.artworkUrl || 'https://placehold.co/64x64/0b0b0f/f5f5f7?text=%E2%80%A2'}
                        alt={`${champion.trackName} artwork`}
                        className="h-8 w-8 rounded-full object-cover border border-border/70"
                        loading="lazy"
                      />
                      <span className="truncate text-sm text-foreground/90" title={champion.trackName}>
                        {champion.trackName}
                      </span>
                      {/* TODO Sprint 05: link to track detail */}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Dialog open={isDesktopHelpOpen} onOpenChange={setIsDesktopHelpOpen}>
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
                      <DialogTitle className='text-center'>How it works?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm leading-relaxed">
                      <p>
                        Le Charts was conceived to give people the chance to battle out their favourite albums and songs against each other, creating new charts weekly.
                      </p>
                      <p>
                        But before you vote, a puzzle awaits. Correctly rearrange the album cover in the shortest moves possible. Use the "view reference" button to see how the cover should look.
                      </p>
                      <p>
                        Good luck and happy voting!
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

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
        </div>
        
        {/* Navbar divider line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-800 to-transparent dark:via-gray-600"></div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}

      <Dialog
        open={Boolean(selectedChampion)}
        onOpenChange={(open) => {
          if (!open) setSelectedChampionId(null);
        }}
      >
        <DialogContent className="max-w-sm border border-blue-400/40 bg-card/95">
          {selectedChampion && (
            <div className="relative rounded-2xl bg-gradient-to-br from-card to-card/80 p-5">
              <span className="absolute left-0 top-3 text-4xl font-light leading-none text-foreground/90">
                {selectedChampion.finalRank}
              </span>

              <div className="flex flex-col items-center -my-5">
                <img
                  src={selectedChampion.artworkUrl || 'https://placehold.co/320x320/0b0b0f/f5f5f7?text=%E2%80%A2'}
                  alt={`${selectedChampion.trackName} artwork`}
                  className="h-48 w-48 rounded-3xl object-cover shadow-md"
                />
                <DialogHeader className="mt-4 items-center text-center">
                  <DialogTitle className="max-w-[15rem] truncate text-3xl font-light">
                    {selectedChampion.trackName}
                  </DialogTitle>
                </DialogHeader>

                <p className="mt-1 text-sm text-muted-foreground">listen on..</p>

                <div className="mt-3 flex items-center gap-3">
                  <img
                    src="/applemusic.png"
                    alt="Apple Music"
                    className="h-10 w-10 rounded-xl object-contain"
                    loading="lazy"
                  />
                  <img
                    src="/spotify.png"
                    alt="Spotify"
                    className="h-10 w-10 rounded-xl object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Reset Password Modal */}
      <ResetPasswordModal 
        isOpen={isResetPasswordOpen} 
        onClose={() => setIsResetPasswordOpen(false)} 
      />
    </>
  );
};
