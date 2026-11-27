(() => {
  const query = new URLSearchParams(location.search).get('l');
  let saved;
  try { saved = localStorage.getItem('uyi-l'); } catch {}
  const language = [query, saved].find(value => value === 'ja' || value === 'en')
    || (navigator.language.startsWith('en') ? 'en' : 'ja');
  document.documentElement.lang = language;
  if (language === 'en') document.title = 'Events | UYI';
  if (query === language) {
    try { localStorage.setItem('uyi-l', language); } catch {}
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.langs [hreflang="' + language + '"]').setAttribute('aria-current', 'true');
  });
})();
