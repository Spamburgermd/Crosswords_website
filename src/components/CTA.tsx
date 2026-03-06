import { useReveal } from '@/hooks/useReveal';

const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
  </svg>
);

export default function CTA() {
  const ref = useReveal();

  return (
    <section className="cta-section" id="download" ref={ref}>
      <div className="cta-content">
        <img className="cta-motif reveal" src="/assets/icons/cw-motif-red.png" alt="CrosSwordS" />
        <h2 className="reveal">Ready to <span className="red">play</span>?</h2>
        <p className="reveal">$4.99. No subscriptions. No ads. Just the game.</p>
        <div className="cta-buttons reveal">
          <a href="#" className="btn-primary">
            <GooglePlayIcon />
            Google Play
          </a>
          <span className="btn-secondary">iOS &mdash; Coming Soon</span>
        </div>
      </div>
    </section>
  );
}
