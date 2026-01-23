import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Music, X } from 'lucide-react';

interface WelcomeOverlayProps {
  onDismiss: () => void;
  onComplete: () => void;
}

const WelcomeOverlay = ({ onDismiss, onComplete }: WelcomeOverlayProps) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [loginButtonState, setLoginButtonState] = useState({ isShaking: false, isFlashing: false });

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

  const handleSkipToVote = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
      onDismiss();
    }, 300);
  };

  const handleDisabledButtonClick = (buttonType: 'login') => {
    setLoginButtonState({ isShaking: true, isFlashing: true });
    
    setTimeout(() => {
      setLoginButtonState({ isShaking: false, isFlashing: false });
    }, 600);
  };

  const shakeAnimation = {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.6 }
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
              className="mb-3"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                <img className='h-18 w-18 ml-2' src="/logo.png" alt="" />
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
              <p className="text-lg text-gray-600 mb-1">
                How many moves will it take?
              </p>
              <p className="text-lg text-gray-600">
                Discover, vote, and listen to albums daily.
              </p>
            </motion.div>

            {/* Button group */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <motion.div>
                <Button
                  onClick={() => handleNavigate('/login')}
                  className="px-14 py-3 text-md font-medium bg-gray-100 border-2 border-solid hover:bg-gray-800 hover:text-gray-100 text-black rounded-full transition-all duration-200 transform hover:scale-105"
                  size="lg"
                >
                  Log in
                </Button>
              </motion.div>

              <Button
                onClick={() => handleNavigate('/')}
                className="px-14 py-3 text-md font-medium bg-gray-100 border-2 border-solid hover:bg-gray-800 hover:text-gray-100 text-black rounded-full transition-all duration-200 transform hover:scale-105"
                size="lg"
              >
                Play
              </Button>

              <Button
                onClick={handleSkipToVote}
                className="px-14 py-3 text-md font-medium border-2 border-solid rounded-full transition-all duration-200 transform hover:scale-105 bg-gray-100 hover:bg-gray-800 hover:text-gray-100 text-black"
                size="lg"
              >
                Vote
              </Button>

            </motion.div>


          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeOverlay;
