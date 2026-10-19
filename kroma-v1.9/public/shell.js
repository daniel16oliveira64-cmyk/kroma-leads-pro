// Kroma — interface shell: sidebar state, Web Validation shortcut, market footer.
(() => {
  const $ = id => document.getElementById(id);
  const navBtns = [...document.querySelectorAll('.nav button')];
  navBtns.forEach(b => b.addEventListener('click', () => {
    // app.js already switches the view; here we only fix which item looks active.
    setTimeout(() => {
      navBtns.forEach(x => x.classList.toggle('active', x === b));
      document.body.dataset.view = b.dataset.view;
      if (b.dataset.focus === 'validation') {
        const f = $('digitalFilter'); if (f && !f.value) { f.value = 'potential'; f.dispatchEvent(new Event('change')); }
        $('validationTools')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }));
  // When other code calls showView (e.g. "Gerar site" from CRM), keep the Discover/Web Validation pair clean.
  const K = window.Kroma || {};
  if (K.showView) {
    const orig = K.showView;
    K.showView = v => { orig(v); const first = navBtns.find(x => x.dataset.view === v && !x.dataset.focus); navBtns.forEach(x => x.classList.toggle('active', x === first)); document.body.dataset.view = v; };
  }
  const discover = navBtns.find(x => x.dataset.view === 'discover' && x.dataset.focus);
  discover?.classList.remove('active');

  function market() {
    const c = $('country'), l = $('searchLanguage'), m = $('searchCurrency');
    const name = c?.selectedOptions?.[0]?.textContent?.replace(/^[^\p{L}]+/u, '').trim() || '—';
    const lang = l?.value || '', cur = m?.value || '';
    $('sideMarket').textContent = name;
    $('sideLocale').textContent = [lang.toUpperCase(), cur].filter(Boolean).join(' · ') || '—';
  }
  ['country', 'searchLanguage', 'searchCurrency'].forEach(id => $(id)?.addEventListener('change', () => setTimeout(market, 0)));
  setTimeout(market, 300);
})();
