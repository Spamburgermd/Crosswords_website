import { useReveal } from '@/hooks/useReveal';

export default function WhyDifferent() {
  const ref = useReveal();

  return (
    <section className="why-different" ref={ref}>
      <img className="why-watermark" src="/assets/icons/cw-motif-red-nolines.png" alt="" aria-hidden="true" />
      <div className="why-different-content">
        <div className="section-label reveal">Why It's Different</div>
        <p className="why-different-text reveal">
          Every letter you place gives feedback across the whole grid. You're not solving one word
          at a time &mdash; you're deducing them all at once, using intersections to eliminate
          possibilities. Clean, strategic, designed to play in minutes and master over time.
        </p>
      </div>
    </section>
  );
}
