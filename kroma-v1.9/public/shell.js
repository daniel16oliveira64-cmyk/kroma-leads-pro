// Kroma — interface shell: sidebar state, Web Validation shortcut, market footer.
(() => {
  const $ = id => document.getElementById(id);
  const navBtns = [...document.querySelectorAll('.nav button')];
  navBtns.forEach(b => b.addEventListener('click', () => {
    // app.js already switches the view; here we only fix which item looks active.
    setTimeout(() => {
      document.body.dataset.view = b.dataset.view;
      if (b.dataset.focus === 'validation') {
        const f = $('digitalFilter'); if (f && !f.value) { f.value = 'potential'; f.dispatchEvent(new Event('change')); }
        $('validationTools')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }));
  // app.js marks every button of the active view; keep only one of Discover / Web Validation lit.
  let focusMode = false;
  navBtns.forEach(b => b.addEventListener('click', () => { focusMode = !!b.dataset.focus; }, true));
  const fix = () => {
    const d = navBtns.filter(x => x.dataset.view === 'discover');
    if (d.length === 2 && d[0].classList.contains('active') && d[1].classList.contains('active')) {
      d.forEach(x => x.classList.toggle('active', !!x.dataset.focus === focusMode));
    }
  };
  const mo = new MutationObserver(fix);
  navBtns.forEach(x => mo.observe(x, { attributes: true, attributeFilter: ['class'] }));
  fix();

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
