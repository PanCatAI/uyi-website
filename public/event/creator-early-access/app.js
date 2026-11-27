(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.documentElement.classList.add('motion-ready');
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveals.unobserve(entry.target);
        }
      });
    }, { threshold: 0.02 });
    document.querySelectorAll('.reveal').forEach(el => reveals.observe(el));
  }

  const loopControllers = [];
  document.querySelectorAll('video[data-loop]').forEach(video => {
    const toggle = document.querySelector(`[data-toggle-video="${video.id}"]`);
    let userPaused = false;
    let inView = false;
    let modalSuspended = false;
    const label = () => {
      toggle.textContent = video.paused ? 'デモを再生' : 'デモを一時停止';
      toggle.setAttribute('aria-label', `${video.getAttribute('aria-label')}、${video.paused ? '再生' : '一時停止'}`);
    };
    const play = () => video.play().catch(label);
    const resume = () => {
      if (inView && !userPaused && !modalSuspended && !reducedMotion.matches && !document.hidden) play();
    };
    toggle.addEventListener('click', () => {
      if (video.paused) { userPaused = false; play(); }
      else { userPaused = true; video.pause(); }
    });
    video.addEventListener('play', label);
    video.addEventListener('pause', label);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        if (inView) resume(); else video.pause();
      }, { threshold: 0.15 }).observe(video);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause(); else resume();
    });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) video.pause(); else resume();
    });
    loopControllers.push({
      suspend() { modalSuspended = true; video.pause(); },
      resume() { modalSuspended = false; resume(); }
    });
  });

  const introDialog = document.querySelector('#film-dialog');
  const intro = document.querySelector('#intro-video');
  const demoDialog = document.querySelector('#demo-dialog');
  const expandedDemo = document.querySelector('#expanded-demo-video');
  let dialogTrigger = null;
  function openDialog(dialog, trigger) {
    dialogTrigger = trigger;
    loopControllers.forEach(controller => controller.suspend());
    dialog.showModal();
    document.body.classList.add('modal-open');
  }
  document.querySelectorAll('.open-film').forEach(button => {
    button.addEventListener('click', () => {
      if (!intro.getAttribute('src')) intro.src = intro.dataset.src;
      openDialog(introDialog, button);
      intro.play().catch(() => {});
    });
  });
  document.querySelectorAll('[data-expand-video]').forEach(button => {
    button.addEventListener('click', () => {
      const source = document.getElementById(button.dataset.expandVideo);
      document.querySelector('#demo-dialog-title').textContent = button.dataset.demoTitle;
      expandedDemo.src = source.currentSrc || source.querySelector('source').src;
      expandedDemo.poster = source.poster;
      const time = source.currentTime;
      expandedDemo.onloadedmetadata = () => {
        if (Number.isFinite(time) && time < expandedDemo.duration) expandedDemo.currentTime = time;
      };
      openDialog(demoDialog, button);
      expandedDemo.play().catch(() => {});
    });
  });
  [introDialog, demoDialog].forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      (dialog === introDialog ? intro : expandedDemo).pause();
      document.body.classList.remove('modal-open');
      loopControllers.forEach(controller => controller.resume());
      dialogTrigger?.focus({ preventScroll: true });
    });
  });

  // Highlight the current section in the header navigation.
  const navLinks = [...document.querySelectorAll('.desktop-nav a')];
  if ('IntersectionObserver' in window && navLinks.length) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${entry.target.id}`));
        navLinks.forEach(a => { if (a.getAttribute('aria-current') !== null) a.setAttribute('aria-current', 'true'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(a => { const t = document.querySelector(a.getAttribute('href')); if (t) spy.observe(t); });
  }
})();
