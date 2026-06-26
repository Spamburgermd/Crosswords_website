import { useState, useEffect } from 'react';

const taglines = [
  'Wit is your weapon.',
  'Every guess cuts deeper.',
  "The thinking player's word game.",
];

const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
  </svg>
);

export default function Hero() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % taglines.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="hero" id="hero">
      <div className="hero-inner">

        {/* Large red circular motif — mirrors the game splash screen */}
        <div className="hero-motif">
          <img src="/assets/icons/cw-motif-red.png" alt="CrosSwordS motif" />
        </div>

        {/* SVG wordmark — text filters to black on hover, sword always red */}
        <div className="hero-wordmark">
          <img
            className="hero-wordmark-text"
            src="/assets/icons/croxwords-text.svg"
            alt="CroXwordS"
          />
          <img
            className="hero-wordmark-sword"
            src="/assets/icons/croxwords-sword.svg"
            alt=""
            aria-hidden="true"
          />
        </div>

        {/* Three dots — cycle active dot with tagline */}
        <div className="hero-dots">
          {taglines.map((_, i) => (
            <div key={i} className={`hero-dot${i === index ? ' active' : ''}`}></div>
          ))}
        </div>

        <div className={`hero-tagline${visible ? '' : ' hero-tagline-hidden'}`}>
          {taglines[index]}
        </div>

        <p className="hero-pitch">No clues &mdash; just letters and deduction.</p>

        <div className="hero-ctas">
          <a href="#download" className="btn-primary">
            <GooglePlayIcon />
            Google Play
          </a>
          <span className="btn-secondary">iOS &mdash; Coming Soon</span>
        </div>

        {/* Attribution with burger logo — mirrors bottom of splash screen */}
        <div className="hero-attribution">
          <img src="/assets/icons/abd-burger-blue.png" alt="Artisan Beef Designs logo" />
          <span>Artisan Beef Designs</span>
        </div>

      </div>
    </section>
  );
}
