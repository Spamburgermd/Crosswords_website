import { useReveal } from '@/hooks/useReveal';

export default function DailyTeaser() {
  const ref = useReveal();

  return (
    <section className="daily-teaser" id="teaser" ref={ref}>
      <div className="daily-teaser-inner">
        <p className="section-label reveal">Daily Puzzle Preview</p>
        <div className="teaser-frame reveal reveal-delay-1">
          <div className="bracket-corner bracket-tl" aria-hidden="true"></div>
          <div className="bracket-corner bracket-tr" aria-hidden="true"></div>
          <div className="bracket-corner bracket-bl" aria-hidden="true"></div>
          <div className="bracket-corner bracket-br" aria-hidden="true"></div>
          <img
            className="teaser-img"
            src="/teaser/daily-teaser.png"
            alt="Today's CrosSwordS puzzle preview — a partial grid showing letter feedback"
            loading="lazy"
          />
        </div>
        <p className="teaser-caption reveal reveal-delay-2">Can you deduce the grid?</p>
      </div>
    </section>
  );
}
