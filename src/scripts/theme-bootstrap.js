// Runs in <head> before first paint (the site's one is:inline script, ADR 0001 §4): applies the theme the visitor
// chose earlier, so the page does not flash the other theme. No choice stored means "follow the system".
(function () {
  try {
    var t = localStorage.getItem('monsun-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
