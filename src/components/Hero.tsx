const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
  </svg>
);

export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-title-row">
            <h1 className="hero-title">
              Cros<span className="red">S</span>word<span className="red">S</span>
            </h1>
            <div className="hero-motif">
              <img src="/assets/icons/cw-motif-red.png" alt="CrosSwordS motif" />
            </div>
          </div>
          <div className="hero-tagline">Deduce the Grid</div>
          <p className="hero-pitch">Wordle meets the grid. No clues &mdash; just letters and deduction.</p>
          <div className="hero-ctas">
            <a href="#download" className="btn-primary">
              <GooglePlayIcon />
              Google Play
            </a>
            <span className="btn-secondary">iOS &mdash; Coming Soon</span>
          </div>
          <div className="hero-attribution">by Artisan Beef Designs</div>
        </div>
        <div className="hero-right">
          <div>
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <img src="/assets/screenshots/dark-mode-bot.jpg" alt="CrosSwordS gameplay" />
              </div>
            </div>
            <div className="phone-dots">
              <div className="phone-dot"></div>
              <div className="phone-dot"></div>
              <div className="phone-dot"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
