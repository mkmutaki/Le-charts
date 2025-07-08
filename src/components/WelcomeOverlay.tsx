import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Music, X } from 'lucide-react';

interface WelcomeOverlayProps {
  onDismiss: () => void;
}

const WelcomeOverlay = ({ onDismiss }: WelcomeOverlayProps) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(), 300); // Wait for animation to complete
  };

  const handleNavigate = (path: string) => {
    setIsVisible(false);
    setTimeout(() => {
      navigate(path);
      onDismiss();
    }, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-[#E3E3E1] flex flex-col items-center justify-center z-[100] p-8"
        >

          {/* Main content container */}
          <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
            {/* Logo/Icon area */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-5"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Music className="h-12 w-12 text-white" />
              </div>
            </motion.div>

            {/* Title and subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-10"
            >
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-1">
                Le Charts
              </h1>
              <p className="text-lg text-gray-600 mb-2">
                How many moves will it take?
              </p>
              <p className="text-lg text-gray-600">
                Discover, vote, and listen to albums daily!
              </p>
            </motion.div>

            {/* Button group */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
                <Button
                onClick={() => handleNavigate('/login')}
                className="px-16 py-3 text-md font-medium bg-gray-100 border-2 border-solid hover:bg-gray-800 hover:text-gray-100 text-black rounded-full transition-all duration-200 transform hover:scale-105"
                size="lg"
              >
                Log in
              </Button>

              <Button
                onClick={() => handleNavigate('/')}
                className="px-10 py-3 text-md font-medium bg-gray-100 border-2 border-solid hover:bg-gray-800 hover:text-gray-100 text-black rounded-full transition-all duration-200 transform hover:scale-105"
                size="lg"
              >
                Play & Vote
              </Button>

              <Button
                onClick={() => handleNavigate('/more_games')}
                className="px-4 py-3 text-md font-medium bg-gray-100 border-2 border-solid hover:bg-gray-800 hover:text-gray-100 text-black rounded-full transition-all duration-200 transform hover:scale-105"
                size="lg"
              >
                See more games..
              </Button>

            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeOverlay;
