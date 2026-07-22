/*
  tools-hub.js
  Search and category filtering for the all-tools page.

  It filters the static cards already in the DOM rather than rendering them
  from JavaScript — the list has to be real HTML for search engines and for
  anyone browsing with scripts off.
*/

(function () {
  const search = document.getElementById('tool-search');
  const count = document.getElementById('tool-count');
  const filters = document.getElementById('hub-filters');
  const empty = document.getElementById('no-results');
  const cards = [...document.querySelectorAll('.tool-card')];
  const heads = [...document.querySelectorAll('[data-group-head]')];
  const grids = [...document.querySelectorAll('[data-group-grid]')];

  let group = 'all';

  function apply() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;

    cards.forEach((card) => {
      const inGroup = group === 'all' || card.dataset.group === group;
      const hit = !q || (card.dataset.keys + ' ' + card.textContent.toLowerCase()).includes(q);
      const show = inGroup && hit;
      card.hidden = !show;
      if (show) shown++;
    });

    // Hide a section heading when nothing under it survived the filter.
    grids.forEach((grid) => {
      const g = grid.dataset.groupGrid;
      const any = cards.some((c) => c.dataset.group === g && !c.hidden);
      grid.hidden = !any;
      const head = heads.find((h) => h.dataset.groupHead === g);
      if (head) head.hidden = !any;
    });

    empty.hidden = shown !== 0;
    count.textContent = q || group !== 'all'
      ? shown + ' of ' + cards.length + ' tools'
      : cards.length + ' tools';
  }

  search.addEventListener('input', apply);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { search.value = ''; apply(); }
    // Enter opens the only remaining match — the fastest path when you know
    // what you want and typed three letters of it.
    if (e.key === 'Enter') {
      const visible = cards.filter((c) => !c.hidden);
      if (visible.length === 1) window.location.href = visible[0].getAttribute('href');
    }
  });

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    group = chip.dataset.filter;
    [...filters.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('on', c === chip));
    apply();
  });

  document.getElementById('clear-search').addEventListener('click', () => {
    search.value = '';
    group = 'all';
    [...filters.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('on', c.dataset.filter === 'all'));
    apply();
    search.focus();
  });

  // Deep link: tools.html?q=csv
  const preset = new URLSearchParams(location.search).get('q');
  if (preset) search.value = preset;

  apply();
})();
