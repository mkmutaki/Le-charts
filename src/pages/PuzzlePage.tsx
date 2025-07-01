import TilePuzzle from '@/components/TilePuzzle';
import { useNavigate } from 'react-router-dom';

const PuzzlePage = () => {
  const navigate = useNavigate();

  const handlePuzzleComplete = () => {
    // Navigate back to home after puzzle completion
    setTimeout(() => {
      navigate('/');
    }, 3000); // Give user time to see the completion message
  };

  return <TilePuzzle onComplete={handlePuzzleComplete} />;
};

export default PuzzlePage;
