(() => {
  'use strict';

  const visual = document.querySelector('.engine-visual');
  if (visual) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Keep the CSS animation alive while paused so returning preserves its progress.
    const updateMotion = () => {
      visual.dataset.documentHidden = String(document.hidden);
      if (reducedMotion.matches) {
        visual.dataset.motion = 'static';
      } else {
        visual.dataset.motion =
          !document.hidden && visual.dataset.motionVisible === 'true' ? 'running' : 'paused';
      }
    };

    visual.dataset.motionVisible = String(!('IntersectionObserver' in window));
    reducedMotion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    window.addEventListener('pageshow', updateMotion);
    window.addEventListener('pagehide', () => {
      visual.dataset.documentHidden = 'true';
      if (!reducedMotion.matches) visual.dataset.motion = 'paused';
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        visual.dataset.motionVisible = String(entry.isIntersecting);
        updateMotion();
      });
      observer.observe(visual);
    }
    updateMotion();
  }

  const menuButton = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  if (menuButton && mobileNav) {
    const closeMenu = (restoreFocus = false) => {
      const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      mobileNav.hidden = true;
      if (restoreFocus && wasOpen) menuButton.focus();
    };

    menuButton.addEventListener('click', () => {
      const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!wasOpen));
      menuButton.setAttribute('aria-label', wasOpen ? 'Open navigation' : 'Close navigation');
      mobileNav.hidden = wasOpen;
    });
    mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu(true);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.site-header')) closeMenu();
    });
    window.matchMedia('(min-width: 601px)').addEventListener('change', (event) => {
      if (event.matches) closeMenu(document.activeElement === menuButton);
    });
  }

  document.querySelectorAll('.table-scroll').forEach((region) => {
    region.addEventListener('keydown', (event) => {
      if (event.target !== region || region.scrollWidth <= region.clientWidth) return;
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!direction) return;
      event.preventDefault();
      region.scrollBy({ left: direction * Math.max(80, region.clientWidth / 2), behavior: 'instant' });
    });
  });

  const grid = document.getElementById('demo-grid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('[data-demo]'));
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const search = document.getElementById('demo-search');
  const count = document.getElementById('result-count');
  const empty = document.getElementById('empty-results');
  const query = new URLSearchParams(window.location.search);
  let category = query.get('category') || 'all';
  if (!chips.some((chip) => chip.dataset.filter === category)) category = 'all';
  search.value = query.get('q') || '';

  const applyFilters = (updateAddress = true) => {
    const term = search.value.trim().toLocaleLowerCase('en-US');
    let visible = 0;
    for (const card of cards) {
      const show =
        (category === 'all' || card.dataset.category === category) && card.dataset.search.includes(term);
      card.hidden = !show;
      if (show) visible++;
    }
    chips.forEach((chip) => {
      const active = chip.dataset.filter === category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    count.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
    empty.hidden = visible !== 0;
    if (updateAddress) {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search.value.trim()) params.set('q', search.value.trim());
      const suffix = params.size ? `?${params}` : '';
      history.replaceState(null, '', `${location.pathname}${suffix}${location.hash}`);
    }
  };

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      category = chip.dataset.filter;
      applyFilters();
    }),
  );
  search.addEventListener('input', () => applyFilters());
  document.getElementById('clear-filters').addEventListener('click', () => {
    search.value = '';
    category = 'all';
    applyFilters();
    search.focus();
  });
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    category = params.get('category') || 'all';
    if (!chips.some((chip) => chip.dataset.filter === category)) category = 'all';
    search.value = params.get('q') || '';
    applyFilters(false);
  });
  applyFilters(false);
})();
