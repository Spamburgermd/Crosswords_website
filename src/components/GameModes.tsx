import { useReveal } from '@/hooks/useReveal';

export default function GameModes() {
  const ref = useReveal();

  return (
    <section className="modes" id="modes" ref={ref}>
      <div className="section-label reveal">Game Modes</div>
      <h2 className="modes-heading reveal">Four ways to <em>play</em></h2>

      <div className="modes-grid">
        <div className="mode-card reveal reveal-delay-1">
          <div className="mode-accent"></div>
          <h3>Daily Puzzle</h3>
          <p>3 difficulty levels. New puzzle every day.</p>
        </div>
        <div className="mode-card reveal reveal-delay-2">
          <div className="mode-accent"></div>
          <h3>Practice</h3>
          <p>Unlimited puzzles. No timer. No pressure.</p>
        </div>
        <div className="mode-card reveal reveal-delay-3">
          <div className="mode-accent"></div>
          <h3>Race a Bot</h3>
          <p>Solve faster than the clockwork opponent.</p>
        </div>
        <div className="mode-card reveal reveal-delay-4">
          <div className="mode-accent"></div>
          <h3>Challenge a Friend</h3>
          <p>Send a seed, compare results, and rematch.</p>
        </div>
      </div>
    </section>
  );
}
