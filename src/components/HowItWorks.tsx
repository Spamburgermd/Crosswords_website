import { useReveal } from '@/hooks/useReveal';

export default function HowItWorks() {
  const ref = useReveal();

  return (
    <section className="how-it-works" id="how-it-works" ref={ref}>
      <div className="section-label reveal">How It Works</div>

      <div className="how-steps">
        <div className="how-step reveal reveal-delay-1">
          <div className="step-number">1</div>
          <h3>Guess</h3>
          <p>Guess words to fill the grid</p>
        </div>
        <div className="how-step reveal reveal-delay-2">
          <div className="step-number">2</div>
          <h3>Feedback</h3>
          <p>Get letter feedback across the entire puzzle</p>
        </div>
        <div className="how-step reveal reveal-delay-3">
          <div className="step-number">3</div>
          <h3>Deduce</h3>
          <p>Deduce the solution as intersecting words narrow the possibilities</p>
        </div>
      </div>

      <div className="positioning-line reveal">No definitions. No trivia. Pure deduction.</div>
    </section>
  );
}
