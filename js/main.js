/* Prevent browser scroll restoration */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

/* ═══════════════════════════════════════════
   Scroll Reveal (IntersectionObserver)
   ═══════════════════════════════════════════ */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((el) => {
  revealObserver.observe(el);
});

/* ═══════════════════════════════════════════
   Nav Scroll Behavior
   ═══════════════════════════════════════════ */
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;

  if (scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }

  lastScroll = scrollY;
}, { passive: true });
