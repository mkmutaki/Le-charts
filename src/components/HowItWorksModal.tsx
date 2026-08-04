import { motion } from 'framer-motion';
import { Heart, Trophy } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Separator } from './ui/separator';

const COVER_GRADIENT = 'linear-gradient(135deg, #a855f7, #3b82f6)';

const PuzzleGlyph = () => (
  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 shadow-sm">
    <div className="absolute inset-0" style={{ backgroundImage: COVER_GRADIENT }} />
    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="border border-background/70" />
      ))}
    </div>
    <div
      className="absolute bg-background"
      style={{ width: '33.4%', height: '33.4%', top: '66.6%', left: '66.6%' }}
    />
  </div>
);

const VoteGlyph = () => (
  <div className="flex h-16 w-16 shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-card px-2 shadow-sm">
    <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundImage: COVER_GRADIENT }} />
    <div className="flex-1 space-y-1">
      <div className="h-1 w-full rounded-full bg-muted-foreground/30" />
      <div className="h-1 w-2/3 rounded-full bg-muted-foreground/20" />
    </div>
    <Heart
      className="heart-beat h-4 w-4 shrink-0 text-primary"
      style={{ animationIterationCount: 'infinite', animationDuration: '1.6s' }}
      fill="currentColor"
    />
  </div>
);

const ChartGlyph = () => (
  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card shadow-sm">
    <div className="flex items-center gap-0.5">
      <span className="rounded-full bg-muted px-1 py-0.5 text-[7px] font-semibold text-muted-foreground">MON</span>
      <span className="rounded-full bg-muted px-1 py-0.5 text-[7px] font-semibold text-muted-foreground">SAT</span>
      <span className="rounded-full bg-muted px-1 py-0.5 text-[7px] font-semibold text-muted-foreground">SUN</span>
    </div>
    <Trophy className="h-5 w-5 text-amber-400" fill="currentColor" fillOpacity={0.25} />
  </div>
);

const steps = [
  {
    Glyph: PuzzleGlyph,
    title: '1. Solve the sleeve',
    body: "Slide tiles into the gap to piece together today's album cover before you can vote.",
  },
  {
    Glyph: VoteGlyph,
    title: '2. Cast your vote',
    body: 'Tap the heart on your favorite track. One vote per round, and it’s locked in.',
  },
  {
    Glyph: ChartGlyph,
    title: '3. Chart the week',
    body: "Daily winners face off in Saturday's bracket, then Sunday's final crowns the week's champion.",
  },
];

export const HowItWorksContent = () => {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center text-xl font-bold">How Le Charts Works</DialogTitle>
        <DialogDescription className="text-center">
          Solve the sleeve, cast your vote, chart the week's best.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        {steps.map(({ Glyph, title, body }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <div className="flex items-center gap-4">
              <Glyph />
              <div className="text-left">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
            {index < steps.length - 1 && <Separator className="mt-4" />}
          </motion.div>
        ))}
      </div>

      <div className="mt-2 space-y-1 border-t border-border/70 pt-4 text-center">
        <p className="text-xs text-muted-foreground">A new puzzle and lineup drop every day at midnight.</p>
        <p className="text-sm font-medium">Good luck, and happy voting.</p>
      </div>
    </>
  );
};
