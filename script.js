'use strict';

/* ── Helpers ───────────────────────────────────────────── */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ══════════════════════════════════════════
   1. NAVBAR — blur on scroll + active section
══════════════════════════════════════════ */
(function navbar() {
  const nav = $('#nav');
  if (!nav) return;

  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const direction = currentScrollY > lastScrollY ? 'down' : 'up';

    if (currentScrollY <= 10) {
      nav.classList.remove('is-hidden');
    } else if (direction === 'down' && currentScrollY > 120) {
      nav.classList.add('is-hidden');
    } else if (direction === 'up') {
      nav.classList.remove('is-hidden');
    }

    nav.classList.toggle('scrolled', currentScrollY > 10);
    lastScrollY = currentScrollY;
  }, { passive: true });

  // Active section highlight
  const sections = $$('section[id]');
  const links    = $$('.nav-links a[href^="#"]');

  if (sections.length && links.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`);
        });
      });
    }, { threshold: 0.45 });

    sections.forEach(s => io.observe(s));
  }

  // Hamburger
  const ham   = $('#hamburger');
  const menu  = $('#mobileMenu');
  if (ham && menu) {
    ham.addEventListener('click', () => {
      const open = menu.style.display !== 'none';
      menu.style.display = open ? 'none' : 'block';
      ham.setAttribute('aria-expanded', String(!open));
    });
  }
})();

/* global closeMobile */
window.closeMobile = () => {
  const menu = $('#mobileMenu');
  const ham  = $('#hamburger');
  if (menu) menu.style.display = 'none';
  if (ham)  ham.setAttribute('aria-expanded', 'false');
};

/* ══════════════════════════════════════════
   2. SCROLL REVEAL
══════════════════════════════════════════ */
(function reveal() {
  const els = $$('[data-reveal]');
  if (!els.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   3. COUNT-UP ANIMATION
══════════════════════════════════════════ */
(function counters() {
  const nums = $$('[data-counter]');
  if (!nums.length) return;

  const ease = t => 1 - Math.pow(1 - t, 3); // ease-out-cubic

  function run(el) {
    const target   = parseInt(el.dataset.counter, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1400;
    const start    = performance.now();

    (function step(now) {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(ease(t) * target) + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      run(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.6 });

  nums.forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   4. SMOOTH SCROLL
══════════════════════════════════════════ */
(function smoothScroll() {
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top, behavior: 'smooth' });
      // Close mobile menu if open
      window.closeMobile();
    });
  });
})();

/* ══════════════════════════════════════════
   5. CARD LIFT (subtle, not 3D)
   Just a slight shadow increase on hover
   — handled by CSS, no JS needed.
══════════════════════════════════════════ */

/* ══════════════════════════════════════════
   6. HERO CARD — very subtle float on scroll
══════════════════════════════════════════ */
(function heroCard() {
  const card = $('#heroCard');
  if (!card) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        card.style.transform = `translateY(${y * 0.04}px)`;
      }
      ticking = false;
    });
    ticking = true;
  }, { passive: true });
})();

/* ══════════════════════════════════════════
   7. TYPEWRITER for hero eyebrow
   (single, subtle — not aggressive)
══════════════════════════════════════════ */
(function typewriter() {
  // No typewriter on main heading — it kills authenticity
  // The heading is static by design (senior designers don't do this on headings)
})();

/* ══════════════════════════════════════════
   8. EVENT CARD hover — image scale
   Handled via CSS transition on .event-img-block
══════════════════════════════════════════ */

/* ══════════════════════════════════════════
   9. FACULTY CARD — subtle gradient follow
══════════════════════════════════════════ */
(function glowFollow() {
  const card = $('.faculty-card');
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
    const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
    card.style.background = `
      radial-gradient(circle at ${x}% ${y}%, rgba(0,111,186,0.04) 0%, transparent 55%),
      white
    `;
  });

  card.addEventListener('mouseleave', () => {
    card.style.background = '';
  });
})();

/* ══════════════════════════════════════════
   10. PAGE ENTRANCE
══════════════════════════════════════════ */
(function entrance() {
  document.documentElement.style.setProperty('--initial-opacity', '0');

  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';

  if (document.readyState === 'complete') {
    requestAnimationFrame(() => { document.body.style.opacity = '1'; });
  } else {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => { document.body.style.opacity = '1'; });
    });
  }
})();

(function facultyPixelTransition() {
  if (!window.gsap) return;

  const facultyCard = document.getElementById('faculty-card');
  if (facultyCard && !facultyCard.querySelector('.faculty-card-hover-panel')) {
    const title = facultyCard.querySelector('.faculty-name')?.textContent?.trim() || 'Faculty Mentor';
    const role = facultyCard.querySelector('.faculty-badge .badge')?.textContent?.trim() || 'Mentor';

    const overlay = document.createElement('div');
    overlay.className = 'faculty-card-hover-panel';
    overlay.innerHTML = `
      <div class="faculty-card-hover-core">
        <div class="faculty-card-hover-pill">Faculty Mentor</div>
        <div class="faculty-card-hover-title">${title}</div>
        <div class="faculty-card-hover-sub">${role}</div>
      </div>
      <div class="faculty-card-hover-pixels"></div>
    `;
    facultyCard.appendChild(overlay);

    const pixelsContainer = overlay.querySelector('.faculty-card-hover-pixels');
    const pixelCount = 10;
    const pixelEls = [];

    for (let row = 0; row < pixelCount; row++) {
      for (let col = 0; col < pixelCount; col++) {
        const pixel = document.createElement('div');
        pixel.className = 'faculty-card-pixel';
        const size = 100 / pixelCount;
        pixel.style.width = `${size}%`;
        pixel.style.height = `${size}%`;
        pixel.style.left = `${col * size}%`;
        pixel.style.top = `${row * size}%`;
        pixelsContainer.appendChild(pixel);
        pixelEls.push(pixel);
      }
    }

    const reveal = active => {
      if (!pixelEls.length) return;
      if (active) {
        overlay.classList.add('is-visible');
        gsap.killTweensOf(pixelEls);
        gsap.set(pixelEls, { display: 'none' });
        const total = pixelEls.length;
        const staggerDur = 0.25 / total;
        gsap.to(pixelEls, {
          display: 'block',
          duration: 0,
          stagger: { each: staggerDur, from: 'random' }
        });
        gsap.to(pixelEls, {
          display: 'none',
          duration: 0,
          delay: 0.25,
          stagger: { each: staggerDur, from: 'random' }
        });
      } else {
        overlay.classList.remove('is-visible');
        gsap.killTweensOf(pixelEls);
        gsap.set(pixelEls, { display: 'none' });
      }
    };

    facultyCard.addEventListener('mouseenter', () => reveal(true));
    facultyCard.addEventListener('mouseleave', () => reveal(false));
    facultyCard.addEventListener('focusin', () => reveal(true));
    facultyCard.addEventListener('focusout', () => reveal(false));
  }
})();

(function teamPixelTransition() {
  if (!window.gsap) return;

  const cards = $$('.team-card');
  cards.forEach(card => {
    if (card.querySelector('.team-card-hover-panel')) return;

    const name = card.querySelector('.team-name')?.textContent?.trim() || 'IEEE Team';
    const role = card.querySelector('.team-role')?.textContent?.trim() || 'Member';

    const overlay = document.createElement('div');
    overlay.className = 'team-card-hover-panel';
    overlay.innerHTML = `
      <div class="team-card-hover-core">
        <div class="team-card-hover-pill">Featured Member</div>
        <div class="team-card-hover-title">${name}</div>
        <div class="team-card-hover-sub">${role}</div>
      </div>
      <div class="team-card-hover-pixels"></div>
    `;
    card.appendChild(overlay);

    const pixelsContainer = overlay.querySelector('.team-card-hover-pixels');
    const pixelCount = 10;
    const pixelEls = [];

    for (let row = 0; row < pixelCount; row++) {
      for (let col = 0; col < pixelCount; col++) {
        const pixel = document.createElement('div');
        pixel.className = 'team-card-pixel';
        const size = 100 / pixelCount;
        pixel.style.width = `${size}%`;
        pixel.style.height = `${size}%`;
        pixel.style.left = `${col * size}%`;
        pixel.style.top = `${row * size}%`;
        pixelsContainer.appendChild(pixel);
        pixelEls.push(pixel);
      }
    }

    const reveal = active => {
      if (!pixelEls.length) return;
      if (active) {
        overlay.classList.add('is-active');
        overlay.classList.add('is-visible');
        gsap.killTweensOf(pixelEls);
        gsap.set(pixelEls, { display: 'none' });
        const total = pixelEls.length;
        const staggerDur = 0.25 / total;
        gsap.to(pixelEls, {
          display: 'block',
          duration: 0,
          stagger: { each: staggerDur, from: 'random' }
        });
        gsap.to(pixelEls, {
          display: 'none',
          duration: 0,
          delay: 0.25,
          stagger: { each: staggerDur, from: 'random' }
        });
      } else {
        overlay.classList.remove('is-visible');
        overlay.classList.remove('is-active');
        gsap.killTweensOf(pixelEls);
        gsap.set(pixelEls, { display: 'none' });
      }
    };

    card.addEventListener('mouseenter', () => reveal(true));
    card.addEventListener('mouseleave', () => reveal(false));
    card.addEventListener('focusin', () => reveal(true));
    card.addEventListener('focusout', () => reveal(false));
  });
})();

(function eventStack() {
  const outer  = document.getElementById('eventScrollOuter');
  const stack  = document.getElementById('eventStack');
  const dotsEl = document.getElementById('eventDots');
  const hint   = document.querySelector('.event-scroll-hint');

  if (!outer || !stack) return;

  const cards    = Array.from(stack.querySelectorAll('[data-event-card]'));
  const dots     = dotsEl ? Array.from(dotsEl.querySelectorAll('.event-dot')) : [];
  const STEP_PX  = window.innerHeight * 0.8; // scroll distance per card
  const total    = cards.length;

  // Size the outer container so there's enough scroll travel
  outer.style.height = `${STEP_PX * total + window.innerHeight}px`;

  let currentIndex = 0;

  // ── Render stack at a given active index ──────────────────
  function renderStack(activeIdx) {
    cards.forEach((card, i) => {
      card.classList.remove('is-active', 'is-next', 'is-back');

      const delta = i - activeIdx;
      if (delta === 0) {
        card.classList.add('is-active');
      } else if (delta === 1) {
        card.classList.add('is-next');
      } else if (delta === 2) {
        card.classList.add('is-back');
      }
    });

    // Sync dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === activeIdx);
    });
  }

  // ── Scroll handler ─────────────────────────────────────────
  function onScroll() {
    const rect     = outer.getBoundingClientRect();
    const scrolled = -rect.top; // how far we've scrolled into the outer

    if (scrolled < 0) {
      renderStack(0);
      return;
    }

    const idx = Math.min(Math.floor(scrolled / STEP_PX), total - 1);

    if (idx !== currentIndex) {
      currentIndex = idx;
      renderStack(currentIndex);
    }

    // Hide scroll hint after first advance
    if (hint && scrolled > STEP_PX * 0.3) {
      hint.classList.add('hidden');
    } else if (hint) {
      hint.classList.remove('hidden');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Dot click: scroll to that card's position ─────────────
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const targetScroll = outer.offsetTop + i * STEP_PX + 1;
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    });
  });

  // Also keep click on cards as fallback
  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const nextIdx = (index + 1) % total;
      const targetScroll = outer.offsetTop + nextIdx * STEP_PX + 1;
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    });
  });

  renderStack(0);
})();
