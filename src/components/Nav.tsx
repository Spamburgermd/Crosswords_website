import { useEffect, useState } from 'react';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
      <a href="#" className="nav-brand">
        <img src="/assets/icons/cw-motif-red.png" alt="CrosSwordS" />
        <span className="nav-brand-text">
          Cros<span className="red">S</span>word<span className="red">S</span>
        </span>
      </a>
      <div className="nav-links">
        <a href="#how-it-works">How It Works</a>
        <a href="#modes">Modes</a>
        <a href="#download" className="nav-cta">Get the App</a>
      </div>
    </nav>
  );
}
