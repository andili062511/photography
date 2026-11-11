(() => {
  const SITE = window.SITE;
  const photos = SITE.photos;
  const series = SITE.series.filter(s => s.photos.length);   // places without photos stay hidden
  const root = document.documentElement;
  const view = document.getElementById('view');
  const side = document.getElementById('side');
  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bi = (en, zh) => `<i data-en>${en}</i><i data-zh>${zh}</i>`;
  const name = s => bi(esc(s.en || s.zh), esc(s.zh || s.en));
  const cover = s => (photos[s.cover] ? s.cover : s.photos[0]);
  const small = id => `photos/${id}-s.webp`;
  const large = id => `photos/${id}-l.webp`;
  const thumb = id => `photos/${id}-t.webp`;      // light version for walls of many pictures
  // If a thumbnail is ever missing, fall back to the medium size instead of showing a broken picture.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && /-t\.webp$/.test(img.src)) img.src = img.src.replace(/-t\.webp$/, '-s.webp');
  }, true);
  const ratio = id => (photos[id].w / photos[id].h).toFixed(4);
  const pad = n => String(n).padStart(2, '0');
  const allIds = series.flatMap(s => s.photos);

  // ---- language, theme, menu ----
  const setLang = l => { root.dataset.lang = l; root.lang = l === 'zh' ? 'zh-CN' : 'en'; };
  setLang(store.get('lang', 'zh'));
  root.dataset.theme = store.get('theme', 'dark');
  document.getElementById('lang').onclick = () => {
    setLang(root.dataset.lang === 'zh' ? 'en' : 'zh');
    store.set('lang', root.dataset.lang);
  };
  document.getElementById('theme').onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
    setTone(toneId);
  };
  const menu = document.getElementById('menu');
  menu.onclick = () => menu.setAttribute('aria-expanded', side.classList.toggle('open'));
  document.getElementById('year').textContent = new Date().getFullYear();

  // ---- left column: place list and social accounts ----
  document.getElementById('places').innerHTML = series.map(s =>
    `<li><a href="#/${s.id}" data-id="${s.id}"><span>${name(s)}</span><span>${s.photos.length}</span></a></li>`).join('');
  // Social links show the platform's glyph and the account name instead of the platform's name.
  const ICONS = window.ICONS || {};
  const PLATFORMS = [
    [/抖音|douyin|tiktok/i, 'douyin'], [/小红书|xiaohongshu|rednote/i, 'xiaohongshu'], [/instagram|^ins$|^ig$/i, 'instagram'],
    [/微博|weibo/i, 'weibo'], [/bilibili|哔哩|b站/i, 'bilibili'], [/微信|wechat|公众号/i, 'wechat'], [/youtube|油管/i, 'youtube'],
    [/500px/i, 'px500'], [/^x$|twitter|推特/i, 'x'], [/facebook|脸书/i, 'facebook'], [/threads/i, 'threads'], [/mail|邮箱|邮件/i, 'mail'],
  ];
  const iconFor = x => (x.url.startsWith('mailto:') ? 'mail' : (PLATFORMS.find(([re]) => re.test(x.name.trim())) || [])[1]) || 'link';
  document.getElementById('social').innerHTML = (SITE.social || [])
    .filter(x => /^(https?:\/\/|mailto:)/i.test(x.url))
    .map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.name)}" aria-label="${esc(x.name)} ${esc(x.handle || '')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[iconFor(x)] || ICONS.link || ''}"/></svg>
      <span>${esc(x.handle || x.name)}</span></a>`).join('');

  // ---- story-style background: a gradient blended from the colours of the photo in view ----
  // Each photo carries two colours (top and bottom of the frame); they are pulled into a band
  // of lightness that keeps the text readable in the current theme.
  function tone(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const light = (max + min) / 2, dark = root.dataset.theme === 'dark';
    const s = Math.min(dark ? 0.6 : 0.5, d * 2.2);                 // grey areas stay grey
    const l = dark ? 0.07 + light * 0.15 : 0.95 - (1 - light) * 0.13;
    return `hsl(${Math.round((h * 60 + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  }
  // The change from one gradient to the next is a crossfade between two full-screen layers:
  // the new gradient fades in on top of the old one, then the old one is removed. Only opacity
  // animates, which the browser does on the GPU, so it stays smooth while the cards are moving.
  const FADE = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1400;
  function paintTone(host, css) {
    if (host.dataset.tone === css) return;
    host.dataset.tone = css;
    const old = [...host.querySelectorAll(':scope > .tone')];
    if (!css) {
      old.forEach(el => el.animate({ opacity: 0 }, { duration: FADE / 2, easing: 'ease', fill: 'forwards' }).finished.then(() => el.remove(), () => el.remove()));
      return;
    }
    const layer = document.createElement('div');
    layer.className = 'tone';
    layer.style.background = css;
    host.append(layer);
    const done = () => old.forEach(el => el.remove());
    layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-in-out' }).finished.then(done, done);
  }
  let toneId = null, pageTone = null;
  function setTone(id) {
    toneId = id;
    const g = id && photos[id] && photos[id].g;
    const css = g ? `linear-gradient(180deg,${tone(g[0])},${tone(g[1])})` : '';
    paintTone(document.body, css);
    if (!lb.hidden) paintTone(lb, css);
  }

  // ---- music: the site's default track, or the current place's own track ----
  // Browsers only allow sound after a click, so it starts when the visitor presses ♪.
  const audio = new Audio();
  audio.loop = true;
  const VOLUME = 0.6;
  const musicBtn = document.getElementById('music');
  let musicOn = store.get('music', 'off') === 'on', track = null, playing = '', fade;
  musicBtn.hidden = !SITE.music && !series.some(s => s.music);
  function fadeTo(v, then) {
    clearInterval(fade);
    fade = setInterval(() => {
      const gap = v - audio.volume;
      if (Math.abs(gap) > 0.05) { audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(gap) * 0.05)); return; }
      audio.volume = v; clearInterval(fade); if (then) then();
    }, 40);
  }
  function start() {
    audio.volume = 0;
    audio.play().then(() => fadeTo(VOLUME))
      .catch(() => document.addEventListener('pointerdown', syncMusic, { once: true }));   // blocked until a click
  }
  function syncMusic() {
    const want = musicOn && track ? track.src : '';
    musicBtn.classList.toggle('on', !!want);
    musicBtn.innerHTML = want ? '♪ ' + (esc(track.title) || bi('Music on', '音乐 开'))
      : musicOn ? bi('♪ No music here', '♪ 此处无音乐') : bi('♪ Play music', '♪ 播放音乐');
    if (want === playing) { if (want && audio.paused) start(); return; }
    playing = want;
    fadeTo(0, () => {
      audio.pause();
      if (playing) { audio.src = playing; start(); }
    });
  }
  musicBtn.onclick = () => { musicOn = !musicOn; store.set('music', musicOn ? 'on' : 'off'); syncMusic(); };

  // ---- right column views ----
  // ---- places index: a masonry wall, one tile per gallery ----
  // Tiles keep their cover's proportions, rise in from below as they scroll into view,
  // and show the gallery's name on hover (always, on touch screens).
  // ---- featured galleries: a row of panels; the one under the pointer opens wide ----
  // Which galleries appear is chosen in the manage page; with none chosen, the six largest are shown.
  const MAX_FEATURED = 7;
  function featured() {
    const picked = series.filter(s => s.featured);
    if (picked.length) return picked.slice(0, MAX_FEATURED);
    const big = [...series].sort((a, b) => b.photos.length - a.photos.length).slice(0, 6);
    return series.filter(s => big.includes(s));
  }
  const accordion = () => {
    const list = featured();
    if (list.length < 2) return '';
    return `<div class="acc" id="acc" role="list" aria-label="Featured">${list.map((s, i) => `
      <a class="acc-p" href="#/${s.id}" data-i="${i}" data-id="${cover(s)}" role="listitem" aria-label="${esc(s.zh || s.en)}">
        <span class="acc-frame">
          <span class="acc-media"><img src="${small(cover(s))}" alt="" draggable="false" decoding="async"></span>
          <span class="acc-shade"></span>
        </span>
        <span class="acc-label"><i class="acc-bar"></i><span class="acc-text">${name(s)}<small>${s.photos.length}</small></span></span>
      </a>`).join('')}</div>`;
  };
  let acc = null;
  function startAccordion() {
    const box = document.getElementById('acc');
    if (!box) return;
    const panels = [...box.children], n = panels.length, OPEN = 0.52, TILT = 8;
    const mouse = matchMedia('(hover: hover)').matches;
    let active = -1;
    box.style.setProperty('--grow', (OPEN * (n - 1) / (1 - OPEN)).toFixed(3));
    const open = i => {
      if (i === active) return;
      active = i;
      panels.forEach((p, k) => {
        p.classList.toggle('on', k === i);
        if (k === i) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
        p.style.setProperty('--rot', (k === i ? 0 : k < i ? TILT : -TILT) + 'deg');          // closed panels turn toward the open one
        p.style.setProperty('--drift', k === i ? 0 : Math.max(-1.5, Math.min(1.5, i - k)));  // and their pictures slide a little
      });
      const img = panels[i].querySelector('img');
      if (!img.dataset.hd) {                         // the open panel gets the full-size picture, decoded first
        img.dataset.hd = 1;
        const hd = new Image();
        hd.src = large(panels[i].dataset.id);
        hd.decode().then(() => { img.src = hd.src; }, () => {});
      }
    };
    const measure = () => {
      const usable = Math.max(box.clientWidth - 10 * (n - 1), 120);
      box.style.setProperty('--media', Math.max(140, usable * OPEN * 1.22) + 'px');
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    measure();
    if (mouse) box.addEventListener('mouseover', e => { const p = e.target.closest('.acc-p'); if (p) open(+p.dataset.i); });
    box.addEventListener('focusin', e => { const p = e.target.closest('.acc-p'); if (p) open(+p.dataset.i); });
    // A closed panel opens on the first click or tap; the open one takes you into its gallery.
    box.addEventListener('click', e => {
      const p = e.target.closest('.acc-p');
      if (p && +p.dataset.i !== active) { e.preventDefault(); open(+p.dataset.i); }
    });
    box.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      open((active + step + n) % n);
      panels[active].focus();
    });
    open(Math.floor((n - 1) / 2));
    requestAnimationFrame(() => box.classList.add('ready'));   // no animation for the very first layout
    acc = { stop() { ro.disconnect(); } };
  }

  const home = () => `${accordion()}<div class="masonry" id="masonry">${series.map(s => {
    const c = cover(s), n = s.photos.length;
    return `
    <a class="tile" href="#/${s.id}" data-r="${ratio(c)}">
      <span class="tile-card" style="background:${photos[c].c}">
        <img src="${thumb(c)}" alt="${esc(s.en || s.zh)}" draggable="false" decoding="async">
        <span class="tile-cap"><b>${name(s)}</b><small>${bi(`${n} photographs`, `${n} 张`)}</small></span>
        <span class="tile-glare"></span>
      </span>
    </a>`;
  }).join('')}</div>`;

  let masonry = null;
  function startMasonry() {
    const box = document.getElementById('masonry'), tiles = [...box.children], GAP = 12;
    const lay = () => {
      const W = box.clientWidth;
      if (!W) return;
      const cols = Math.max(1, Math.floor((W + GAP) / ((W < 520 ? 150 : 260) + GAP)));
      const cw = (W - GAP * (cols - 1)) / cols, tops = new Array(cols).fill(0);
      for (const t of tiles) {
        let c = 0;
        for (let k = 1; k < cols; k++) if (tops[k] < tops[c] - 0.5) c = k;      // shortest column
        const h = cw / +t.dataset.r;
        t.style.width = cw + 'px'; t.style.height = h + 'px';
        t.style.transform = `translate3d(${Math.round(c * (cw + GAP))}px,${Math.round(tops[c])}px,0)`;
        tops[c] += h + GAP;
      }
      box.style.height = Math.max(...tops) - GAP + 'px';
    };
    lay();
    requestAnimationFrame(() => box.classList.add('ready'));    // from now on, tiles glide when the wall reflows
    const ro = new ResizeObserver(lay);
    ro.observe(box);
    let batch = [], queued = 0;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { batch.push(e.target); io.unobserve(e.target); }
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
          .forEach((t, i) => { t.style.setProperty('--wait', i * 50 + 'ms'); t.classList.add('in'); });
        batch = [];
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    tiles.forEach(t => io.observe(t));
    // Under the mouse a tile leans toward the cursor, lifts a little, and a soft sheen follows the pointer.
    const TILT = 12;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      box.addEventListener('pointermove', e => {
        const t = e.target.closest('.tile');
        if (!t || e.pointerType === 'touch' || !t.classList.contains('in')) return;
        const r = t.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        t.classList.add('lean');
        t.style.setProperty('--wait', '0ms');
        t.style.setProperty('--rx', ((0.5 - py) * 2 * TILT).toFixed(2) + 'deg');
        t.style.setProperty('--ry', ((px - 0.5) * 2 * TILT).toFixed(2) + 'deg');
        t.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        t.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      const flatten = t => {                          // springs back flat
        t.classList.remove('lean');
        t.style.removeProperty('--rx'); t.style.removeProperty('--ry');
      };
      box.addEventListener('pointerout', e => {
        const t = e.target.closest('.tile');
        if (t && !t.contains(e.relatedTarget)) flatten(t);
      });
      box.addEventListener('pointerleave', () => box.querySelectorAll('.lean').forEach(flatten));
    }
    masonry = { stop() { ro.disconnect(); io.disconnect(); cancelAnimationFrame(queued); } };
  }

  // ---- one place on a phone: photographs scroll past one under another ----
  // A band along the bottom of the screen blurs progressively, so photos dissolve as they leave
  // rather than being cut off. It is built from stacked layers, each blurring a little more.
  const narrow = matchMedia('(max-width: 760px)');
  const EDGE_BLUR = (() => {
    const N = 6, MAX = 18, level = u => MAX * (Math.pow(2, 4 * u) - 1) / 15;     // gentle start, strong at the edge
    return Array.from({ length: N }, (_, i) => {
      const a = level(i / N), b = level((i + 1) / N), r = Math.sqrt(Math.max(b * b - a * a, 0)).toFixed(2);
      const mask = `linear-gradient(to bottom,transparent ${(i / N * 100).toFixed(1)}%,#000 ${((i + 1) / N * 100).toFixed(1)}%)`;
      return `<i style="backdrop-filter:blur(${r}px);-webkit-backdrop-filter:blur(${r}px);mask-image:${mask};-webkit-mask-image:${mask}"></i>`;
    }).join('');
  })();
  let flow = null;
  function startFlow(s) {
    const box = document.getElementById('flow'), band = document.getElementById('edge-blur');
    box.querySelectorAll('img').forEach(img => { if (img.complete) img.classList.add('in'); else img.onload = () => img.classList.add('in'); });
    // the background follows whichever photo is in the middle of the screen
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { pageTone = e.target.dataset.id; if (lb.hidden) setTone(pageTone); }
    }, { rootMargin: '-45% 0px -45% 0px' });
    box.querySelectorAll('.fig').forEach(f => io.observe(f));
    pageTone = s.photos[0];
    setTone(pageTone);
    const onClick = e => { const img = e.target.closest('.fig img'); if (img) open(+img.dataset.i); };
    box.addEventListener('click', onClick);
    // the band fades away at the very end of the page, where nothing more is coming
    const onScroll = () => {
      const left = document.documentElement.scrollHeight - innerHeight - scrollY;
      band.style.opacity = Math.min(1, Math.max(0, left / 120)).toFixed(2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    flow = { stop() { io.disconnect(); window.removeEventListener('scroll', onScroll); } };
  }
  // crossing between phone and desktop width rebuilds the page in the other form
  narrow.addEventListener('change', () => { if (flow || carousel) route(); });

  // ---- one place: its photographs as a stack receding into depth ----
  const place = (s, n) => {
    const prev = series[n - 1], next = series[n + 1], many = s.photos.length > 1;
    const link = (p, en, zh) => p
      ? `<a href="#/${p.id}"><small>${bi(en, zh)}</small><span>${name(p)}</span></a>`
      : `<a href="#/"><small>${bi(en, zh)}</small><span>${bi('All places', '全部地点')}</span></a>`;
    const arrow = (cls, label, d) => `<button type="button" class="depth-arrow ${cls}" aria-label="${label}">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    return `
    <header class="head"><h1>${name(s)}</h1>
      <p>${bi(`Series of ${s.photos.length}`, `共 ${s.photos.length} 张`)}</p></header>
    ${s.intro_zh || s.intro_en ? `<p class="intro">${bi(esc(s.intro_en || s.intro_zh), esc(s.intro_zh || s.intro_en))}</p>` : ''}
    ${narrow.matches ? `
    <div class="flow" id="flow">${s.photos.map((id, i) => `
      <figure class="fig" data-id="${id}">
        <img ${i > 1 ? 'loading="lazy"' : ''} decoding="async" src="${small(id)}" data-i="${i}" alt="${esc(s.en || s.zh)} ${i + 1}" style="--r:${ratio(id)};background:${photos[id].c}">
        <figcaption>${pad(i + 1)} / ${pad(s.photos.length)}</figcaption>
      </figure>`).join('')}</div>
    <div class="edge-blur" id="edge-blur" aria-hidden="true">${EDGE_BLUR}</div>` : `
    <div class="depth" id="depth" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(s.en || s.zh)}">
      <div class="depth-stage">${s.photos.map((id, i) => `
        <div class="depth-card" data-i="${i}" style="background:${photos[id].c}" aria-roledescription="slide" aria-label="${i + 1} / ${s.photos.length}">
          <img alt="${esc(s.en || s.zh)} ${i + 1}" draggable="false" decoding="async"><span class="depth-tint"></span>
        </div>`).join('')}</div>
      ${many ? arrow('depth-prev', 'Previous', 'M15 5l-7 7 7 7') + arrow('depth-next', 'Next', 'M9 5l7 7-7 7') : ''}
    </div>
    <div class="depth-foot">
      <span class="depth-n"></span>
      ${many ? `<div class="depth-dots">${s.photos.map((_, i) => `<button type="button" data-dot="${i}" aria-label="${i + 1}"></button>`).join('')}</div>` : ''}
    </div>`}
    <nav class="next">${link(prev, 'Previous', '上一组')}${link(next, 'Next', '下一组')}</nav>`;
  };

  let carousel = null;
  function startCarousel(s) {
    const el = document.getElementById('depth'), cards = [...el.querySelectorAll('.depth-card')];
    const foot = el.nextElementSibling, dots = [...foot.querySelectorAll('[data-dot]')], counter = foot.querySelector('.depth-n');
    const ids = s.photos, n = ids.length;
    const wide = ids.filter(id => photos[id].w >= photos[id].h).length * 2 >= n;   // card shape follows the majority
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const VISIBLE = 4, TILT = 22, FALLOFF = 0.14, BLUR = 6, TURN = 700, PAUSE = 4000;
    let pos = 0, focus = -1, raf = 0, wheelTimer = 0, hover = false, drag = null, dragged = false;
    let card = { w: 300, depth: 200, spread: 80 };
    const wrap = d => { if (n < 2) return d; d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; };

    function layout() {
      cards.forEach((c, i) => {
        const d = wrap(i - pos), back = Math.max(0, d), shown = Math.abs(d) <= VISIBLE + 0.5;
        const img = c.firstElementChild;
        if (Math.abs(d) <= 1.5 && !img.dataset.hd) {     // sharp near the front; decoded off-screen first, so swapping it in never stalls a frame
          img.dataset.hd = 1;
          const hd = new Image();
          hd.src = large(ids[i]);
          const swap = () => { img.src = hd.src; };
          hd.decode().then(swap, swap);
          if (!img.src) img.src = small(ids[i]);
        }
        else if (shown && !img.src) img.src = small(ids[i]);
        const opacity = !shown ? 0 : d < 0 ? Math.max(0, 1 + d) : 1;
        c.style.transform = `translate(-50%,-50%) translateX(${(card.spread * d).toFixed(2)}px) translateZ(${(-card.depth * d).toFixed(2)}px) rotateY(${(TILT * Math.min(1, Math.max(0, d))).toFixed(3)}deg)`;
        c.style.opacity = opacity.toFixed(3);
        // Receding cards are darkened by the tint layer (cheap). Blur is set once per step, for the
        // place the card is heading to, and style.css eases it — so the script never re-filters
        // a large photo frame by frame.
        const blur = Math.min(BLUR, Math.max(0, Math.round(d)) / VISIBLE * BLUR);
        const filter = blur ? `blur(${blur}px)` : 'none';
        if (c.style.filter !== filter) c.style.filter = filter;
        c.style.zIndex = Math.round(2000 - d * 20);
        c.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
        c.lastElementChild.style.opacity = Math.min(0.86, back * FALLOFF * 2.2).toFixed(3);
      });
    }
    function resize() {
      const W = el.clientWidth, H = el.clientHeight;
      const phone = W < 600;                       // on a phone the front card takes most of the width
      const w = wide ? Math.min(W * (phone ? 0.8 : 0.6), H * 0.8 * 1.5) : Math.min(H * 0.86, W * (phone ? 0.7 : 0.56) / 0.8) * 0.8;
      const h = wide ? w / 1.5 : w / 0.8;
      card = { w, depth: Math.min(w * 0.6, 300), spread: w * (phone ? 0.15 : 0.26) };
      cards.forEach(c => { c.style.width = w + 'px'; c.style.height = h + 'px'; });
      layout();
    }
    function go(raw, animate = true) {
      const target = ((raw % n) + n) % n, from = pos, to = pos + wrap(target - pos);
      const t0 = performance.now(), dur = animate && !reduced ? TURN : 0;
      cancelAnimationFrame(raf);
      const step = now => {
        const t = dur ? Math.min(1, (now - t0) / dur) : 1;
        pos = from + (to - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) raf = requestAnimationFrame(step); else pos = ((pos % n) + n) % n;
        layout();
      };
      step(t0);
      if (target === focus) return;
      focus = target;
      dots.forEach((d, i) => d.classList.toggle('on', i === focus));
      counter.textContent = `${pad(focus + 1)} / ${pad(n)}`;
      pageTone = ids[focus];                      // the background follows the photo in front
      if (lb.hidden) setTone(pageTone);
    }

    const onWheel = e => {
      if (n < 2) return;
      e.preventDefault();
      cancelAnimationFrame(raf);
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pos += Math.min(0.6, Math.max(-0.6, (e.deltaMode === 1 ? raw * 24 : raw) / (card.w * 0.9)));
      layout();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => go(Math.round(pos)), 130);
    };
    const stepPx = () => Math.max(card.w * 0.55, 40);
    const onDown = e => {
      dragged = false;
      if (n < 2 || e.target.closest('button')) return;
      cancelAnimationFrame(raf);
      drag = { x: e.clientX, start: pos, lastX: e.clientX, lastT: performance.now(), v: 0, id: e.pointerId };
    };
    const onMove = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!dragged && Math.abs(dx) > 4) { dragged = true; el.setPointerCapture(drag.id); }
      if (!dragged) return;
      const now = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(now - drag.lastT, 1);
      drag.lastX = e.clientX; drag.lastT = now;
      pos = drag.start - dx / stepPx();
      layout();
    };
    const onUp = () => {
      if (!drag) return;
      const v = drag.v;
      drag = null;
      if (dragged) go(Math.round(pos - v * 180 / stepPx()));
    };
    const onClick = e => {
      if (dragged) return;
      if (e.target.closest('.depth-prev')) return go(focus - 1);
      if (e.target.closest('.depth-next')) return go(focus + 1);
      const c = e.target.closest('.depth-card');
      if (!c) return;
      if (+c.dataset.i === focus) open(focus); else go(+c.dataset.i);     // front card opens full size
    };
    const onDot = e => { const d = e.target.closest('[data-dot]'); if (d) go(+d.dataset.dot); };
    const onKey = e => {
      if (!lb.hidden || n < 2 || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') go(focus - 1);
      if (e.key === 'ArrowRight') go(focus + 1);
    };
    const onEnter = () => { hover = true; }, onLeave = () => { hover = false; };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    foot.addEventListener('click', onDot);
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    // Plays by itself; waits while the pointer rests on it, a photo is open, or the tab is hidden.
    const auto = n > 1 && !reduced
      ? setInterval(() => { if (!hover && !drag && lb.hidden && !document.hidden) go(focus + 1); }, PAUSE) : 0;
    resize();
    go(0, false);
    carousel = {
      show: i => go(i, false),
      stop() {
        cancelAnimationFrame(raf); clearTimeout(wheelTimer); clearInterval(auto); ro.disconnect();
        window.removeEventListener('keydown', onKey);
      },
    };
  }

  const all = () => `
    <header class="head"><h1>${bi('All photographs', '全部照片')}</h1>
      <p>${bi(`${allIds.length} photographs`, `共 ${allIds.length} 张`)}</p></header>
    <div class="grid">${allIds.map((id, i) => `
      <a href="${large(id)}" data-i="${i}" style="--r:${ratio(id)};background:${photos[id].c}">
        <img loading="lazy" decoding="async" src="${thumb(id)}" alt="${id}"></a>`).join('')}</div>`;

  // ---- colours: every photograph, sorted into colour families ----
  // The family is worked out from the picture when it is uploaded; the manage page can override it.
  const COLOURS = [
    ['red', 'Red', '红', '#b8442f'], ['orange', 'Orange', '橙', '#d9773d'], ['gold', 'Gold', '金', '#d6a43f'], ['yellow', 'Yellow', '黄', '#d9cf5a'],
    ['green', 'Green', '绿', '#5e9460'], ['cyan', 'Teal', '青', '#3f97a0'], ['blue', 'Blue', '蓝', '#4470b3'],
    ['purple', 'Purple', '紫', '#7b63b5'], ['pink', 'Pink', '粉', '#c96f98'], ['neutral', 'Neutral', '黑白与中性', '#8d8e90'],
  ];
  const familyOf = id => photos[id].colSet || photos[id].col || 'neutral';
  const spectrum = id => ((photos[id].hue || 0) + 15) % 360;        // start the wheel at red
  function colours() {
    const groups = COLOURS.map(([key, en, zh, swatch]) => ({
      key, swatch, label: bi(en, zh),
      ids: allIds.filter(id => familyOf(id) === key).sort((a, b) => spectrum(a) - spectrum(b)),
    })).filter(g => g.ids.length);
    const ids = groups.flatMap(g => g.ids);
    let i = 0;
    const html = `
    <header class="head"><h1>${bi('Colours', '色彩')}</h1>
      <p>${bi(`${ids.length} photographs by colour`, `按色彩排列的 ${ids.length} 张照片`)}</p></header>
    <nav class="chips">${groups.map(g => `
      <button type="button" data-jump="${g.key}"><b style="background:${g.swatch}"></b>${g.label}<small>${g.ids.length}</small></button>`).join('')}</nav>
    ${groups.map(g => `
    <section class="band" id="c-${g.key}">
      <h2><b style="background:${g.swatch}"></b>${g.label}<small>${g.ids.length}</small></h2>
      <div class="grid">${g.ids.map(id => `
        <a href="${large(id)}" data-i="${i++}" style="--r:${ratio(id)};background:${photos[id].c}">
          <img loading="lazy" decoding="async" src="${thumb(id)}" alt="${id}"></a>`).join('')}</div>
    </section>`).join('')}`;
    return { html, ids };
  }

  const about = () => `
    <header class="head"><h1>${bi('About', '关于')}</h1></header>
    <section class="about">
      <p>${bi('Andi Li photographs places at the hour the light leaves them — harbours, coastlines and open country.',
              'Andi Li 拍摄光线离开时的地方——港湾、海岸与旷野。')}</p>
      <p>${bi(`${allIds.length} photographs from ${series.length} places so far.`, `目前收录 ${series.length} 个地点、${allIds.length} 张照片。`)}</p>
    </section>`;

  // ---- map: one pin per place that has been marked ----
  // OpenStreetMap tiles need no key; style.css turns them grey (and inverts them in the dark theme).
  let map = null;
  function showMap() {
    const marked = series.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
    if (!marked.length || !window.L) {
      view.innerHTML = `<header class="head"><h1>${bi('Map', '地图')}</h1></header>
        <p class="note">${bi('No places have been marked on the map yet.', '还没有在地图上标记地点。')}</p>`;
      return;
    }
    view.innerHTML = '<div class="map" id="map"></div>';
    map = L.map('map', { worldCopyJump: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    for (const s of marked) {
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'pin', iconSize: [14, 14] }), title: s.zh || s.en })
        .bindPopup(`<a class="pop" href="#/${s.id}"><img src="${small(cover(s))}" width="${photos[cover(s)].w}" height="${photos[cover(s)].h}" alt=""><span>${name(s)}<small>${s.photos.length}</small></span></a>`,
          { closeButton: false, minWidth: 200, maxWidth: 200, offset: [0, -4] })
        .addTo(map);
    }
    if (marked.length === 1) map.setView([marked[0].lat, marked[0].lng], 10);
    else map.fitBounds(marked.map(s => [s.lat, s.lng]), { padding: [70, 70], maxZoom: 11 });
  }

  let current = [];
  function route() {
    if (map) { map.remove(); map = null; }
    if (masonry) { masonry.stop(); masonry = null; }
    if (acc) { acc.stop(); acc = null; }
    if (flow) { flow.stop(); flow = null; }
    if (carousel) { carousel.stop(); carousel = null; }
    const h = location.hash.replace(/^#\/?/, '');
    const n = series.findIndex(x => x.id === h);
    let nav = '', title = 'Andi.Li photography';
    current = [];
    if (n >= 0) { view.innerHTML = place(series[n], n); current = series[n].photos; title = `${series[n].zh || series[n].en} · ${title}`; }
    else if (h === 'all') { view.innerHTML = all(); current = allIds; nav = 'all'; }
    else if (h === 'colours') { const c = colours(); view.innerHTML = c.html; current = c.ids; nav = 'colours'; }
    else if (h === 'map') { showMap(); nav = 'map'; }
    else if (h === 'about') { view.innerHTML = about(); nav = 'about'; }
    else { view.innerHTML = home(); nav = 'home'; }
    document.title = title;
    track = (n >= 0 && series[n].music) || SITE.music || null;
    syncMusic();
    // In a gallery the carousel sets the background from the photo in front; elsewhere it is plain.
    pageTone = null;
    if (n < 0) setTone(null);
    else if (document.getElementById('flow')) startFlow(series[n]);
    else startCarousel(series[n]);
    if (nav === 'home') { startAccordion(); startMasonry(); }
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === nav));
    document.querySelectorAll('#places a').forEach(a =>
      a.dataset.id === h ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    view.querySelectorAll('.grid img').forEach(img => {
      if (img.complete) img.classList.add('in'); else img.onload = () => img.classList.add('in');
    });
    side.classList.remove('open'); menu.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---- lightbox ----
  const lb = document.getElementById('lb');
  const lbImg = document.getElementById('lb-img');
  let idx = 0;
  function show(i) {
    idx = (i + current.length) % current.length;
    const id = current[idx];
    lbImg.src = large(id); lbImg.alt = id;
    setTone(id);
    document.getElementById('lb-n').textContent = `${pad(idx + 1)} / ${pad(current.length)}`;
    document.getElementById('lb-t').textContent = id;
    if (current.length > 1) new Image().src = large(current[(idx + 1) % current.length]);
  }
  function open(i) { lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); }
  function close() {
    lb.hidden = true; document.body.style.overflow = ''; lbImg.removeAttribute('src');
    lb.querySelectorAll(':scope > .tone').forEach(el => el.remove()); lb.dataset.tone = '';
    if (carousel) carousel.show(idx);          // the stack lands on the photo you were looking at
    setTone(pageTone);
  }

  view.addEventListener('click', e => {
    const t = e.target.closest('.grid a');
    if (t) { e.preventDefault(); open(+t.dataset.i); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) document.getElementById('c-' + jump.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.lb-p').onclick = () => show(idx - 1);
  lb.querySelector('.lb-nx').onclick = () => show(idx + 1);
  lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
  window.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  let tx = null;
  lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });

  // ---- intro: a slowly drifting wall of photographs behind the name; any click or key enters ----
  function startIntro(enter) {
    const el = document.createElement('div');
    el.className = 'intro-wall';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const W = innerWidth, H = innerHeight, phone = W < 700;
    const tw = phone ? 150 : 220, th = Math.round(tw / 1.5), GAP = phone ? 12 : 18, PER = 5;
    const cols = Math.min(9, Math.ceil(W / (tw + GAP)) + 1);
    const pool = [...allIds].sort(() => Math.random() - 0.5);
    const copyH = PER * (th + GAP), copies = Math.max(2, Math.ceil(H * 1.6 / copyH) + 1);
    const column = c => {
      const ids = Array.from({ length: PER }, (_, k) => pool[(c * PER + k) % pool.length]);
      const tiles = ids.map(id => `<span class="iw-tile" data-col="${c}" data-id="${id}"><span class="iw-in" style="background:${photos[id].c}"><img src="${thumb(id)}" alt="" draggable="false" decoding="async"></span></span>`).join('');
      return `<div class="iw-col"><div class="iw-track">${tiles.repeat(copies)}</div></div>`;
    };
    // Wording and text size come from the manage page.
    const set = SITE.intro || {};
    const title = esc(set.title || 'Andi.Li photography').replace(/\n/g, '<br>');
    el.style.cssText = `--tw:${tw}px;--th:${th}px;--gap:${GAP}px;--size:${(set.size || 100) / 100}`;
    el.innerHTML = `
      <div class="iw-stage"><div class="iw-plane">${Array.from({ length: cols }, (_, c) => column(c)).join('')}</div></div>
      <div class="iw-text">
        <h1 class="iw-title"><span class="iw-edge">${title}</span><span class="iw-fill" aria-hidden="true">${title}</span><span class="iw-fill" aria-hidden="true">${title}</span></h1>
        <p class="iw-line">${esc(set.line || 'Time flies. Images last forever.')}</p>
        <p class="iw-hint">${matchMedia('(hover: none)').matches
          ? bi('Tap anywhere to enter', '轻点任意位置进入')
          : bi('Click anywhere or press any key to enter', '点击任意位置或按任意键进入')}</p>
      </div>`;
    document.body.append(el);
    document.body.style.overflow = 'hidden';

    const plane = el.querySelector('.iw-plane'), tracks = [...el.querySelectorAll('.iw-track')];
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPEED = 30, TILT = 16, TURN = -14;
    // neighbouring columns drift in opposite directions, each at its own pace
    const base = tracks.map((_, c) => SPEED * (1 + 0.45 * (((c * 0.618 + 0.35) % 1) * 2 - 1)) * (c % 2 ? -1 : 1));
    const offset = tracks.map((_, c) => copyH * ((c * 0.37) % 1)), vel = tracks.map(() => 0);
    const aim = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
    let raf = 0, last = 0, held = -1;

    // The title's letters are windows onto a photograph: it drifts inside them, changes every few
    // seconds, and switches to whichever photo on the wall the pointer is resting on.
    const heading = el.querySelector('.iw-title'), fills = [...el.querySelectorAll('.iw-fill')];
    const lightness = id => (photos[id].g || ['#888', '#888']).reduce((sum, hex) => sum + parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16), 0);
    const bright = [...allIds].sort((a, b) => lightness(b) - lightness(a)).slice(0, 18).sort(() => Math.random() - 0.5);   // bright photos read best as lettering
    let shown = 0, turn = 0, filled = '';
    const fillWith = id => {
      if (id === filled) return;
      filled = id;
      const pre = new Image();
      pre.onload = () => {
        if (filled !== id) return;
        const next = fills[shown ^= 1];
        next.style.backgroundImage = `url(${small(id)})`;
        next.classList.add('on');
        fills[shown ^ 1].classList.remove('on');
      };
      pre.src = small(id);
    };
    fillWith(bright[0]);
    const cycle = setInterval(() => { if (held < 0) fillWith(bright[++turn % bright.length]); }, 4200);
    const frame = ts => {
      const dt = Math.min(0.05, Math.max(0, ts - (last || ts)) / 1000);
      last = ts;
      const k = 1 - Math.exp(-dt / 0.12);
      lean.x += (aim.x * 5 - lean.x) * k; lean.y += (-aim.y * 5 - lean.y) * k;      // the wall leans toward the pointer
      plane.style.transform = `translate(-50%,-50%) scale(1.18) rotateX(${TILT + lean.y}deg) rotateY(${TURN + lean.x}deg) translateZ(-120px)`;
      tracks.forEach((t, c) => {
        const target = still || held === c ? 0 : base[c];                             // the column under the pointer pauses
        vel[c] += (target - vel[c]) * (1 - Math.exp(-dt / (target ? 0.28 : 0.16)));
        offset[c] = (((offset[c] + vel[c] * dt) % copyH) + copyH) % copyH;
        t.style.transform = `translate3d(0,${-offset[c]}px,0)`;
      });
      if (!still) {                                 // the photo slides slowly inside the letters, and against the pointer
        heading.style.setProperty('--bx', (50 + Math.sin(ts / 1000 * 0.21) * 22 - lean.x * 4).toFixed(2) + '%');
        heading.style.setProperty('--by', (50 + Math.cos(ts / 1000 * 0.17) * 26 + lean.y * 4).toFixed(2) + '%');
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      aim.x = e.clientX / innerWidth - 0.5; aim.y = e.clientY / innerHeight - 0.5;
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.iw-tile');
      held = t ? +t.dataset.col : -1;
      if (t) fillWith(t.dataset.id);
    });
    el.addEventListener('pointerleave', () => { aim.x = aim.y = 0; held = -1; });

    let gone = false;
    const leave = e => {
      if (gone || (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey))) return;
      gone = true;
      window.removeEventListener('keydown', leave);
      document.body.style.overflow = '';
      enter();                                    // the site builds underneath while the wall fades away
      el.classList.add('out');
      clearInterval(cycle);
      setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, 900);
    };
    el.addEventListener('click', leave);
    window.addEventListener('keydown', leave);
  }

  // The intro greets visitors who arrive at the front door; a link straight to a page skips it.
  if (!location.hash.replace(/^#\/?/, '') && allIds.length && !(SITE.intro && SITE.intro.off)) startIntro(route); else route();
})();
