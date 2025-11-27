import TilePuzzle from '@/components/TilePuzzle';
import { useNavigate } from 'react-router-dom';

const PuzzlePage = () => {
  const navigate = useNavigate();

  const handlePuzzleComplete = () => {
    // Navigate back to home after puzzle completion
    navigate('/');
  };

  return <TilePuzzle onComplete={handlePuzzleComplete} />;
};

export default PuzzlePage;
