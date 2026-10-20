/* Deck engine and live demos */
(function () {
  const { Graph, glyph, prPill, repoChip, ownerAvatar, ICONS, STATUS, PEOPLE, checkout, portfolio, CHECKOUT_DEPS, CHECKOUT_COLLISIONS } = window.UDAX;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Issue view shells: one titlebar, tab bar, and comment box for every view slide ---------- */
  const ROOM_TABS = ['Conversation', 'Activity', 'Code', 'Preview', 'Terminal'];
  const roomTitle = `<div class="titlebar">
      <div class="lights"><i></i><i></i><i></i></div>
      <div class="crumbs"><span>Checkout 2.0</span><span class="sep">/</span><span>CHK-12 Wallet payments</span><span class="sep">/</span><b>CHK-32 Wallet buttons on web checkout</b></div>
      <span class="grow"></span>
      <span class="pill c st-progress"><i data-g="progress"></i>In progress</span>
      <span class="people"><span class="avatar owner h2c inherited sm" title="Owner: Theo Ramos, from CHK-12">TR</span><span class="agent sm" title="Assignee: Wren">W</span></span>
      <button class="btn"><span class="kbd">Esc</span>Canvas</button>
    </div>`;
  const composer = `<div class="composer">
      <div class="seg small-seg"><button aria-pressed="true">Steer</button><button>Note</button></div>
      <span class="cmp-ph">Comment to steer Wren. Type @ to mention someone, or select code, a pin, or output to anchor it.</span>
      <span class="grow"></span>
      <button class="btn primary">Comment<span class="kbd">⌘↵</span></button>
    </div>`;
  $$('.room-shell').forEach(w => {
    const tab = w.dataset.tab;
    const tabs = `<div class="tabs" data-nav>${ROOM_TABS.map(t => `<span class="${t === tab ? 'on' : ''}">${t}</span>`).join('')}<span class="grow"></span>${w.dataset.aside ? `<span class="small">${w.dataset.aside}</span>` : ''}</div>`;
    w.insertAdjacentHTML('afterbegin', roomTitle + tabs);
    w.insertAdjacentHTML('beforeend', composer);
  });
  $$('.meter[data-l]').forEach(el => (el.innerHTML = '<i></i><i></i><i></i><i></i>'));

  /* ---------- Placeholders ---------- */
  $$('i[data-g]').forEach(el => (el.innerHTML = glyph(el.dataset.g)));
  $$('i[data-icon]').forEach(el => (el.innerHTML = ICONS[el.dataset.icon]));
  $$('i[data-pr]').forEach(el => { const [l, st] = el.dataset.pr.split(':'); el.outerHTML = prPill(l, st); });
  $$('i[data-repo]').forEach(el => (el.outerHTML = repoChip(el.dataset.repo)));

  /* ---------- Deck ---------- */
  const deck = $('#deck');
  const stage = $('#stage');
  const slides = $$('.slide', deck);
  const CH = { Premise: 'backlog', 'The canvas': 'todo', 'Doing the work': 'progress', 'Inside an issue': 'progress', Steering: 'review', 'Shipping it': 'done' };
  slides.forEach((s, i) => {
    if (s.classList.contains('cover')) return;
    const c = document.createElement('div');
    c.className = 'chrome';
    c.innerHTML = `<span class="mark">UDAX</span><span class="chapter">${s.dataset.chapter}</span>
      <span class="count"><span class="c st-${CH[s.dataset.chapter]}">${glyph(CH[s.dataset.chapter])}</span>${String(i + 1).padStart(2, '0')} / ${slides.length}</span>`;
    s.prepend(c);
  });

  function fit() {
    const k = Math.min((innerWidth - 32) / 1600, (innerHeight - 32) / 900);
    deck.style.transform = `scale(${k})`;
  }
  addEventListener('resize', fit);
  fit();

  let cur = -1;
  const hooks = {};
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur) return;
    const prev = slides[cur];
    if (prev && hooks[prev.getAttribute('aria-label')]?.leave) hooks[prev.getAttribute('aria-label')].leave();
    slides.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    cur = i;
    stage.style.setProperty('--bgx', `${-i * 84}px`);
    history.replaceState(null, '', `#${i + 1}`);
    const h = hooks[slides[i].getAttribute('aria-label')];
    if (h?.enter) h.enter();
  }
  const activeLabel = () => slides[cur]?.getAttribute('aria-label');
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const h = hooks[activeLabel()];
    if (h?.key && h.key(e) === true) { e.preventDefault(); return; }
    document.body.classList.add('navigated');
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  });
  $('#prev').onclick = () => go(cur - 1);
  // Tabs in the issue view jump to the slide that designs that view.
  $$('.tabs[data-nav] > span:not(.grow):not(.small)').forEach(t => {
    t.style.cursor = 'pointer';
    t.onclick = () => { const i = slides.findIndex(sl => sl.getAttribute('aria-label') === t.textContent.trim()); if (i >= 0) go(i); };
  });
  $('#next').onclick = () => go(cur + 1);
  let tx = null;
  addEventListener('touchstart', e => (tx = e.touches[0].clientX), { passive: true });
  addEventListener('touchend', e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
    tx = null;
  });

  /* ---------- Helpers ---------- */
  const fresh = () => checkout();
  const without = (nodes, ids) => nodes.filter(n => !ids.includes(n.id));
  const pressed = (group, btn) => $$('button', group).forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));

  document.fonts.ready.then(init);

  function init() {
    /* ===== 1. Hero ===== */
    const heroNodes = fresh().map(n => ({ ...n, ask: null }));
    const hero = new Graph($('#g-hero'), { nodes: heroNodes, deps: CHECKOUT_DEPS, collisions: [], altitude: 'cards', scale: 0.6 });
    const heroCam = () => hero.camera(-180, hero.pos['CHK-17'].y - 20, 0.6, false);
    heroCam();
    let heroTimers = [];
    const HERO_SCRIPT = [
      ['CHK-32', { live: 'running 9 checks' }],
      ['CHK-40', { s: 'review', live: null, prs: [['api#224', 'approved']] }],
      ['CHK-16', { s: 'todo' }],
      ['CHK-32', { live: 'opening web#482 for review' }],
      ['CHK-39', { s: 'done', prs: [['api#221', 'merged']] }],
    ];
    const heroReset = () => { heroTimers.forEach(clearTimeout); heroTimers = []; fresh().forEach(n => hero.nodes.has(n.id) && hero.patch(n.id, { ...n, ask: null })); hero.renderAll(); hero.drawEdges(); };
    hooks.Cover = {
      enter() {
        heroReset();
        if (reduced) return;
        // Draw in by depth: the one orchestrated moment of the deck.
        const depth = id => { let d = 0, n = hero.get(id); while (n.parent) { d++; n = hero.get(n.parent); } return d; };
        hero.nodes.forEach(({ el }, id) => { el.style.opacity = 0; const p = hero.paths.get(`t:${id}`); if (p) p.style.opacity = 0; });
        $$('path.dep', hero.svg).forEach(p => (p.style.opacity = 0));
        [0, 1, 2].forEach(d => heroTimers.push(setTimeout(() => {
          hero.nodes.forEach(({ el }, id) => {
            if (depth(id) !== d) return;
            el.style.opacity = '';
            const p = hero.paths.get(`t:${id}`); if (p) p.style.opacity = '';
          });
          if (d === 2) $$('path.dep', hero.svg).forEach(p => (p.style.opacity = ''));
        }, 250 + d * 420)));
        HERO_SCRIPT.forEach(([id, patch], i) => heroTimers.push(setTimeout(() => hero.patch(id, patch), 2600 + i * 2600)));
      },
      leave() { heroTimers.forEach(clearTimeout); },
    };

    /* ===== 5. Canvas anatomy ===== */
    const anat = new Graph($('#g-anatomy'), { nodes: fresh(), deps: CHECKOUT_DEPS, collisions: [], altitude: 'cards', scale: 0.6 });
    anat.select('CHK-32');
    anat.camera(anat.pos['CHK-12'].x + 20, (anat.pos['CHK-31'].y + anat.pos['CHK-14'].y) / 2 - 10, 0.58, false);
    const placeCallouts = () => {
      const win = $('#app-window');
      const host = $('.anatomy-layout');
      host.style.position = 'relative';
      $$('.callout', host).forEach(c => c.remove());
      const sc = deck.getBoundingClientRect().width / 1600;
      const w = host.getBoundingClientRect();
      const spots = { A: [-4, -24], B: [-10, -20], C: [-8, -20], D: [16, 16], E: [-10, -14], F: [-10, -14], G: [-10, -14], H: [-12, -12] };
      $$('[data-callout]', win).forEach(el => {
        const r = el.getBoundingClientRect();
        const k = el.dataset.callout;
        const c = document.createElement('span');
        c.className = 'callout';
        c.textContent = k;
        c.style.left = `${(r.left - w.left) / sc + spots[k][0]}px`;
        c.style.top = `${(r.top - w.top) / sc + spots[k][1]}px`;
        host.appendChild(c);
      });
    };
    hooks['Canvas anatomy'] = { enter: () => requestAnimationFrame(placeCallouts) };

    /* ===== 6. Node anatomy ===== */
    const one = new Graph($('#g-node'), {
      nodes: [{ id: 'CHK-32', t: 'Wallet buttons on web checkout', s: 'progress', owner: PEOPLE.TR, assignees: [{ agent: true, name: 'Wren' }], live: 'editing OrderSummary.tsx', repos: ['web', 'ds'], prs: [['web#482', 'running'], ['ds#81', 'draft']], rollup: { done: 1, progress: 1 } }],
      altitude: 'cards', scale: 1.75,
    });
    one.camera(0, one.pos['CHK-32'].y, 1.75, false);
    const drawLeaders = () => {
      const st = $('.na-stage');
      const svg = $('#na-lines');
      const sc = deck.getBoundingClientRect().width / 1600;
      const b = st.getBoundingClientRect();
      const node = one.nodes.get('CHK-32').el;
      const local = r => ({ l: (r.left - b.left) / sc, r: (r.right - b.left) / sc, t: (r.top - b.top) / sc, b: (r.bottom - b.top) / sc });
      const N = local(node.getBoundingClientRect());
      const W = st.clientWidth;
      svg.innerHTML = '';
      ['l', 'r'].forEach(side => {
        const labs = $$(`.na-label[data-side="${side}"]`, st).map(lab => {
          const R = local(node.querySelector(lab.dataset.for).getBoundingClientRect());
          return { lab, ty: (R.t + R.b) / 2, tx: side === 'l' ? R.l : R.r };
        }).sort((a, b) => a.ty - b.ty);
        const ys = [];
        labs.forEach((o, i) => (ys[i] = i ? Math.max(o.ty, ys[i - 1] + 74) : o.ty));
        const shift = labs.reduce((a, o, i) => a + ys[i] - o.ty, 0) / labs.length;
        labs.forEach((o, i) => {
          const y = ys[i] - shift;
          o.lab.style.top = `${y - 11}px`;
          const lx = side === 'l' ? 224 : W - 224;
          const ex = side === 'l' ? N.l - 26 : N.r + 26;
          svg.insertAdjacentHTML('beforeend', `<path d="M${lx} ${y}H${ex}L${o.tx} ${o.ty}"/><circle cx="${o.tx}" cy="${o.ty}" r="3.5"/>`);
        });
      });
    };
    hooks['Anatomy of an issue'] = { enter: () => requestAnimationFrame(drawLeaders) };

    /* ===== 7. Owners and assignees ===== */
    const roleNodes = fresh().filter(n => ['CHK-1', 'CHK-12', 'CHK-31', 'CHK-32', 'CHK-33', 'CHK-14'].includes(n.id));
    const roles = new Graph($('#g-roles'), { nodes: roleNodes, deps: [['CHK-33', 'CHK-31']], collisions: [], altitude: 'cards', scale: 0.74 });
    roles.select('CHK-14');
    roles.focus(null, { s: 0.66, dx: 22, dy: -10, animate: false });

    /* ===== 8. Edges ===== */
    const edgeNodes = without(fresh(), ['CHK-14', 'CHK-36', 'CHK-37', 'CHK-15', 'CHK-38', 'CHK-39', 'CHK-16']).map(n => ({ ...n, ask: null }));
    const edges = new Graph($('#g-edges'), { nodes: edgeNodes, deps: CHECKOUT_DEPS, collisions: CHECKOUT_COLLISIONS, altitude: 'cards', scale: 0.62 });
    edges.focus(null, { s: 0.58, dx: 175, animate: false });
    const crit = $('#btn-critical');
    const toggleCrit = on => {
      crit.setAttribute('aria-pressed', on ? 'true' : 'false');
      edges.dim(on ? ['CHK-33', 'CHK-31', 'CHK-12', 'CHK-1'] : null);
    };
    crit.onclick = () => toggleCrit(crit.getAttribute('aria-pressed') !== 'true');
    hooks.Edges = {
      key(e) { if (e.key === 'Alt') return true; },
      leave() { toggleCrit(false); },
    };
    addEventListener('keydown', e => { if (e.key === 'Alt' && activeLabel() === 'Edges') toggleCrit(true); });
    addEventListener('keyup', e => { if (e.key === 'Alt' && activeLabel() === 'Edges') toggleCrit(false); });

    /* ===== 9. Semantic zoom ===== */
    const zoomEl = $('.zoom-visual');
    const zoom = new Graph($('#g-zoom'), { nodes: [...fresh().map(n => (n.id === 'CHK-1' ? { ...n, cluster: 'Checkout 2.0' } : n)), ...portfolio()], deps: CHECKOUT_DEPS, collisions: CHECKOUT_COLLISIONS, altitude: 'cards', scale: 0.72, detailIds: ['CHK-31', 'CHK-32', 'CHK-33'] });
    const ALTS = [
      { alt: 'dots', s: 0.1, label: '8%', cam: g => [150, 650] },
      { alt: 'pills', s: 0.36, label: '25%', cam: g => { const b = g.bbox(g.order.filter(id => id.startsWith('CHK'))); return [b.cx, b.cy]; } },
      { alt: 'cards', s: 0.72, label: '60%', cam: g => [g.pos['CHK-12'].x + 240, (g.pos['CHK-32'].y + g.pos['CHK-41'].y) / 2] },
      { alt: 'detail', s: 1, label: '100%', cam: g => [g.pos['CHK-32'].x - 60, g.pos['CHK-32'].y] },
      { alt: 'detail', s: 1, label: 'Room', cam: g => [g.pos['CHK-32'].x - 60, g.pos['CHK-32'].y], room: true },
    ];
    let zoomAt = -1, zoomTimers = [];
    const setZoom = (i, animate = true) => {
      const a = ALTS[i];
      zoomAt = i;
      pressed($('#altitudes'), $$('#altitudes button')[i]);
      zoomEl.classList.toggle('in-room', !!a.room);
      zoom.setAltitude(a.alt, a.s, animate);
      const [cx, cy] = a.cam(zoom);
      zoom.camera(cx, cy, a.s, animate);
      $('#zoom-readout').textContent = a.label;
    };
    setZoom(2, false);
    $$('#altitudes button').forEach((b, i) => (b.onclick = () => { zoomTimers.forEach(clearTimeout); setZoom(i); }));
    hooks['Semantic zoom'] = {
      enter() {
        zoomTimers.forEach(clearTimeout);
        setZoom(0, false);
        if (reduced) return;
        [1, 2, 3, 4].forEach((i, k) => zoomTimers.push(setTimeout(() => setZoom(i), 1600 + k * 2300)));
      },
      leave() { zoomTimers.forEach(clearTimeout); },
      key(e) {
        if (e.key >= '1' && e.key <= '5') { zoomTimers.forEach(clearTimeout); setZoom(+e.key - 1); return true; }
        if (e.key === 'Enter') { zoomTimers.forEach(clearTimeout); setZoom(4); return true; }
        if (e.key === 'Escape') { zoomTimers.forEach(clearTimeout); setZoom(Math.max(0, zoomAt - 1)); return true; }
      },
    };

    /* ===== 10. Decompose ===== */
    const GHOSTS = [
      { t: 'Guest session tokens', repos: ['api'], why: 'session.go assumes every cart has a user ID.', est: 'About 2h' },
      { t: 'Collect and verify guest email', repos: ['web'], why: 'Receipts and order lookup need an address before payment.', est: 'About 1h' },
      { t: 'Claim an account after purchase', repos: ['api', 'web'], why: 'Links guest orders to an account created later.', est: 'About 3h' },
      { t: 'Move sessions to Redis', repos: ['infra'], why: 'Would simplify expiry. Not needed at guest volume.', est: 'About 1d' },
    ];
    const splitRoot = () => ({ id: 'CHK-14', t: 'Guest checkout', s: 'todo', owner: PEOPLE.MC, ownerFrom: 'CHK-1', assignees: [{ agent: true, name: 'Juno' }], repos: ['api', 'web'], risk: 'med', age: 2 });
    const SPLIT_S = 0.82;
    const splitCam = (animate = true) => split.camera(split.pos['CHK-14'].x + 290, split.pos['CHK-14'].y, SPLIT_S, animate);
    const split = new Graph($('#g-split'), { nodes: [splitRoot()], altitude: 'cards', scale: SPLIT_S });
    splitCam(false);
    let splitTimers = [], nextKey = 42;
    const splitReset = () => {
      splitTimers.forEach(clearTimeout);
      [...split.nodes.keys()].filter(id => id !== 'CHK-14').forEach(id => split.remove(id));
      nextKey = 42;
      split.patch('CHK-14', { live: null });
      split.relayout(false);
      splitCam(false);
    };
    const planned = () => split.order.map(id => split.get(id)).filter(n => n.ghost && !n.accepted && !n.rejected);
    const acceptGhost = n => { n.accepted = true; n.id2 = `CHK-${nextKey++}`; split.patch(n.id, { accepted: true, s: 'backlog' }); };
    const dropGhost = n => {
      split.patch(n.id, { rejected: true });
      setTimeout(() => { split.remove(n.id); split.relayout(); split.renderAll(); }, 320);
    };
    const plan = () => {
      if (split.order.length > 1) return;
      split.patch('CHK-14', { live: 'drafting sub-issues' });
      GHOSTS.forEach((g, i) => splitTimers.push(setTimeout(() => {
        const el = split.add({ id: `G${i}`, parent: 'CHK-14', s: 'backlog', ghost: true, ...g }, false);
        el.classList.add('entering');
        split.relayout();
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
        splitCam();
        if (i === GHOSTS.length - 1) split.patch('CHK-14', { live: null });
      }, 500 + i * 450)));
    };
    $('#g-split').addEventListener('click', e => {
      const chip = e.target.closest('.ghost-actions span');
      if (!chip) return;
      const n = split.get(chip.closest('.node').dataset.id);
      if (/Accept/.test(chip.textContent)) acceptGhost(n);
      else if (/Drop/.test(chip.textContent)) dropGhost(n);
    });
    $('#btn-plan').onclick = plan;
    $('#btn-plan-reset').onclick = splitReset;
    hooks.Decomposition = {
      enter() { splitReset(); if (!reduced) splitTimers.push(setTimeout(plan, 700)); },
      leave() { splitTimers.forEach(clearTimeout); },
      key(e) {
        const p = planned();
        if (e.key === 's' || e.key === 'S') { plan(); return true; }
        if (e.key === 'Enter' && e.shiftKey) { p.forEach(acceptGhost); return true; }
        if (e.key === 'Enter' && p[0]) { acceptGhost(p[0]); return true; }
        if (e.key === 'Backspace' && p.length) { dropGhost(p[p.length - 1]); return true; }
      },
    };

    /* ===== 13. Changeset ===== */
    const steps = $$('.cs-step');
    let csTimers = [];
    const csReset = () => { csTimers.forEach(clearTimeout); steps.forEach(s => { s.className = 'cs-step'; $('.cs-state', s).textContent = 'Waiting'; }); $('#cs-fail').classList.remove('show'); };
    const csRun = failAt => {
      csReset();
      steps.forEach((s, i) => {
        csTimers.push(setTimeout(() => { s.classList.add('merging'); $('.cs-state', s).textContent = i === 0 ? 'Merging' : 'Rebasing and merging'; }, i * 1300));
        csTimers.push(setTimeout(() => {
          s.classList.remove('merging');
          if (i === failAt) { s.classList.add('failed'); $('.cs-state', s).textContent = 'Checks failed after rebase'; $('#cs-fail').classList.add('show'); csTimers.forEach(clearTimeout); }
          else { s.classList.add('merged'); $('.cs-state', s).textContent = 'Merged'; $('.cs-dot', s).innerHTML = `<span class="c st-done">${glyph('done')}</span>`; }
        }, i * 1300 + 1000));
      });
    };
    const csRestoreDots = () => steps.forEach(s => ($('.cs-dot', s).innerHTML = `<span class="c st-review">${glyph('review')}</span>`));
    $('#btn-merge').onclick = () => { csRestoreDots(); csRun(-1); };
    $('#btn-merge-fail').onclick = () => { csRestoreDots(); csRun(2); };
    hooks.Changesets = { enter() { csRestoreDots(); csReset(); }, leave: csReset };

    /* ===== 14. Agents ===== */
    const agents = new Graph($('#g-agents'), { nodes: fresh(), deps: CHECKOUT_DEPS, collisions: CHECKOUT_COLLISIONS, altitude: 'cards', scale: 0.74 });
    agents.camera(agents.pos['CHK-12'].x + 300, (agents.pos['CHK-31'].y + agents.pos['CHK-14'].y) / 2 + 10, 0.7, false);

    /* ===== Assign an agent ===== */
    const assignNodes = fresh().filter(n => ['CHK-14', 'CHK-36', 'CHK-37'].includes(n.id)).map(n => ({ ...n, ask: null, ...(n.id === 'CHK-14' ? { owner: PEOPLE.MC, ownerFrom: 'CHK-1' } : {}) }));
    const assign = new Graph($('#g-assign'), { nodes: assignNodes, altitude: 'cards', scale: 0.7 });
    assign.select('CHK-36');
    assign.camera(assign.pos['CHK-36'].x + 20, assign.pos['CHK-36'].y + 250, 0.7, false);
    const placePop = () => {
      const host = $('.assign-visual'), pop = $('#assign-pop');
      const sc = deck.getBoundingClientRect().width / 1600;
      const h = host.getBoundingClientRect(), r = assign.nodes.get('CHK-36').el.getBoundingClientRect();
      pop.style.left = `${(r.right - h.left) / sc + 18}px`;
      pop.style.top = `${Math.max(20, (r.top - h.top) / sc - 10)}px`;
    };
    hooks['Assign an agent'] = { enter: () => requestAnimationFrame(placePop) };

    /* ===== 15. Autonomy edges ===== */
    const drawAutonomy = () => {
      const tree = $('.auto-tree'), svg = $('.at-edges');
      const nodes = $$('.at-node', tree);
      const byKey = Object.fromEntries(nodes.map(n => [$('.at-k', n).textContent, n]));
      const links = [['CHK-1', 'CHK-13'], ['CHK-1', 'CHK-12'], ['CHK-1', 'CHK-14'], ['CHK-1', 'CHK-15'], ['CHK-12', 'CHK-31'], ['CHK-12', 'CHK-32']];
      svg.innerHTML = links.map(([a, b]) => {
        const A = byKey[a], B = byKey[b];
        const x1 = A.offsetLeft + A.offsetWidth, y1 = A.offsetTop + A.offsetHeight / 2;
        const x2 = B.offsetLeft, y2 = B.offsetTop + B.offsetHeight / 2;
        const dx = (x2 - x1) / 2;
        return `<path d="M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}"/>`;
      }).join('');
    };
    drawAutonomy();

    /* ===== 18. Lenses ===== */
    const lens = new Graph($('#g-lens'), { nodes: fresh(), deps: CHECKOUT_DEPS, collisions: [], altitude: 'pills', scale: 0.5, ask: false });
    const lb = lens.bbox();
    lens.camera(lb.cx, lb.cy, 0.5, false);
    const sw = c => `<i style="background:${c}"></i>`;
    const all = () => lens.order.map(id => lens.get(id));
    function ownerLegend() {
      const rows = Object.values(PEOPLE).map(p => {
        const mine = all().filter(n => lens.ownerOf(n)?.p === p && n.s !== 'done');
        return { p, open: mine.length, review: mine.filter(n => n.s === 'review').length };
      });
      const busiest = rows.slice().sort((a, b) => b.review - a.review)[0];
      return rows.map(r => `<div>${sw(r.p.color)}${r.p.name}<span class="lg-n">${r.open} open</span></div>`).join('') +
        `<p class="small">${busiest.p.name.split(' ')[0]} owns ${busiest.review} issues in review. That’s the queue to clear first.</p>`;
    }
    function assigneeLegend() {
      const byAgent = all().filter(n => (n.assignees || []).some(a => a.agent)).length;
      return `<div>${sw('#53d8f0')}An agent</div><div>${sw('#8f9bff')}A person</div><div>${sw('#3a4270')}Nobody yet</div>` +
        `<p class="small">Agents are assigned to ${byAgent} issues. Each one still has a person as its owner.</p>`;
    }
    const LENSES = {
      status: { q: 'Where are we?', legend: ['backlog', 'todo', 'progress', 'review', 'done'].map(s => `<div><span class="c st-${s}">${glyph(s)}</span>${STATUS[s]}</div>`).join('') },
      repo: { q: 'What does this touch?', legend: `<div>${sw('#5aa9ff')}api</div><div>${sw('#ff9f6e')}web</div><div>${sw('#b58cff')}mobile</div><div>${sw('#6fe0c0')}ds, the design system</div><p class="small">Issues that span repos take their primary repo’s color. Hover one to see all of them.</p>` },
      owner: { q: 'Who answers for it?', legend: ownerLegend() },
      assignee: { q: 'Who, or what, is doing it?', legend: assigneeLegend() },
      stuck: { q: 'What hasn’t moved?', legend: `<div>${sw('#4f5d95')}Active in the last day</div><div>${sw('#ffb547')}Idle two to four days</div><div>${sw('#ff7a6b')}Idle five days or more</div><div>${sw('#343c63')}Done or in backlog, not counted</div><p class="small">PDF receipts is approved and has waited five days for Theo, its owner.</p>` },
      risk: { q: 'What could break?', legend: `<div>${sw('#ff7a6b')}High</div><div>${sw('#ffb547')}Medium</div><div>${sw('#4f5d95')}Low</div><p class="small">Risk combines protected paths, blast radius, and test coverage of the files touched.</p>` },
    };
    const setLens = key => {
      lens.setLens(key);
      pressed($('#lens-seg'), $(`#lens-seg [data-lens="${key}"]`));
      $('#lens-q').textContent = LENSES[key].q;
      $('#lens-legend').innerHTML = LENSES[key].legend;
    };
    setLens('status');
    $$('#lens-seg button').forEach(b => (b.onclick = () => setLens(b.dataset.lens)));
    hooks.Lenses = {
      enter() { setLens('status'); },
      key(e) { const k = ['status', 'repo', 'owner', 'assignee', 'stuck', 'risk'][+e.key - 1]; if (k) { setLens(k); return true; } },
    };

    /* ===== 19. Intent typing ===== */
    const TYPED = 'Let guests check out without an account. Ship within two weeks.';
    let typeTimer;
    hooks['Intent bar and keyboard'] = {
      enter() {
        clearInterval(typeTimer);
        const out = $('#typed'), prev = $('#intent-preview');
        prev.classList.add('hidden');
        if (reduced) { out.textContent = TYPED; prev.classList.remove('hidden'); return; }
        out.textContent = '';
        let i = 0;
        typeTimer = setInterval(() => {
          out.textContent = TYPED.slice(0, ++i);
          if (i >= TYPED.length) { clearInterval(typeTimer); setTimeout(() => prev.classList.remove('hidden'), 350); }
        }, 38);
      },
      leave() { clearInterval(typeTimer); },
    };

    /* ===== 21. Replay ===== */
    const START = {
      'CHK-31': { s: 'progress', prs: [['api#219', 'running']] },
      'CHK-38': { s: 'review', prs: [['api#215', 'approved']] },
      'CHK-40': { s: 'todo', live: null, prs: [] },
      'CHK-41': { s: 'todo', live: null, prs: [] },
      'CHK-14': { ask: null },
      'CHK-32': { s: 'todo', live: null, prs: [] },
    };
    const EVENTS = [
      [0.08, 'CHK-31', { s: 'review', prs: [['api#219', 'approved']] }],
      [0.244, 'CHK-38', { s: 'done', prs: [['api#215', 'merged']] }],
      [0.339, 'CHK-40', { s: 'progress' }],
      [0.553, 'CHK-41', { s: 'progress', prs: [['web#488', 'draft']] }],
      [0.833, 'CHK-14', { needs: true }],
      [0.928, 'CHK-32', { s: 'progress' }],
    ];
    const replayBase = () => fresh().map(n => ({ ...n, ...(START[n.id] || {}) }));
    const replay = new Graph($('#g-replay'), { nodes: replayBase(), deps: CHECKOUT_DEPS, collisions: [], altitude: 'pills', scale: 0.46, ask: false });
    const rb = replay.bbox();
    replay.camera(rb.cx, rb.cy, 0.46, false);
    let rT = 0, rRaf = null;
    const clockAt = f => { const mins = Math.round(18 * 60 + f * 15 * 60) % (24 * 60); return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; };
    const applyReplay = f => {
      const base = replayBase();
      base.forEach(n => replay.nodes.get(n.id).n && Object.assign(replay.nodes.get(n.id).n, n, { needs: false }));
      let last = -1;
      EVENTS.forEach(([t, id, patch], i) => { if (t <= f) { Object.assign(replay.get(id), patch); last = i; } });
      replay.renderAll();
      EVENTS.forEach(([t, id], i) => replay.nodes.get(id).el.classList.toggle('changed', t <= f));
      replay.drawEdges();
      $$('#digest .dg').forEach((d, i) => { d.classList.toggle('seen', i <= last); d.classList.toggle('now', i === last); });
      $('#scrub-fill').style.width = `${f * 100}%`;
      $('#clock').textContent = clockAt(f);
    };
    const playReplay = () => {
      cancelAnimationFrame(rRaf);
      const t0 = performance.now(), from = rT >= 1 ? 0 : rT, dur = 9000 * (1 - from);
      let lastApplied = -1;
      const step = now => {
        rT = Math.min(1, from + (now - t0) / 9000);
        const passed = EVENTS.filter(([t]) => t <= rT).length;
        if (passed !== lastApplied) { applyReplay(rT); lastApplied = passed; }
        $('#scrub-fill').style.width = `${rT * 100}%`;
        $('#clock').textContent = clockAt(rT);
        if (rT < 1) rRaf = requestAnimationFrame(step);
      };
      rRaf = requestAnimationFrame(step);
    };
    $('#btn-replay').onclick = () => { if (rT >= 1) rT = 0; playReplay(); };
    $('#track-bar').addEventListener('click', e => {
      cancelAnimationFrame(rRaf);
      const r = e.currentTarget.getBoundingClientRect();
      rT = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      applyReplay(rT);
    });
    hooks['Morning replay'] = {
      enter() { rT = 0; applyReplay(0); if (!reduced) setTimeout(playReplay, 600); else { rT = 1; applyReplay(1); } },
      leave() { cancelAnimationFrame(rRaf); },
    };

    /* ===== 23. Scale art ===== */
    (() => {
      const svg = $('#scale-svg');
      let seed = 11;
      const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const cols = ['#7c87a8', '#d6def5', '#ffb547', '#c792ff', '#3fd99a'];
      let out = '';
      [[60, 50], [150, 40], [240, 60], [110, 115], [210, 125]].forEach(([cx, cy]) => {
        for (let i = 0; i < 44; i++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 34;
          const c = cols[Math.min(4, Math.floor(r() * r() * 5 + r() * 2.4))];
          out += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d * 0.7).toFixed(1)}" r="2.2" fill="${c}"/>`;
        }
      });
      out += '<circle cx="240" cy="60" r="7" fill="none" stroke="#53d8f0" stroke-width="2"/>';
      svg.innerHTML = out;
    })();

    /* ===== 24. Accessibility ===== */
    const a11y = new Graph($('#g-a11y'), { nodes: fresh(), deps: CHECKOUT_DEPS, collisions: [], altitude: 'pills', scale: 0.27, ask: false, pillK: 0.7 });
    a11y.select('CHK-32');
    const ab = a11y.bbox();
    a11y.camera(ab.cx, ab.cy + 10, 0.27, false);
    const depthOf = (list, n) => { let d = 0; while (n.parent) { d++; n = list.find(x => x.id === n.parent); } return d; };
    const list = fresh();
    $('#outline').innerHTML = list.slice(0, 15).map(n =>
      `<li role="treeitem" aria-level="${depthOf(list, n) + 1}" class="st-${n.s}${n.id === 'CHK-32' ? ' focus' : ''}" style="padding-left:${8 + depthOf(list, n) * 20}px">${glyph(n.s)}<span class="n-key">${n.id}</span>${n.t}<span class="st-label">${STATUS[n.s]}</span></li>`).join('');

    /* ===== 26. Close ===== */
    const closeNodes = fresh().map(n => ({ ...n, ask: null, live: null }));
    const close = new Graph($('#g-close'), { nodes: closeNodes, deps: [], collisions: [], altitude: 'cards', scale: 0.6 });
    close.camera(-180, close.pos['CHK-17'].y - 20, 0.6, false);
    let closeTimers = [];
    hooks.Close = {
      enter() {
        closeTimers.forEach(clearTimeout);
        fresh().forEach(n => close.patch(n.id, { s: n.s, live: null, ask: null, prs: n.prs }));
        const order = [...close.order].sort((a, b) => {
          const d = id => { let k = 0, n = close.get(id); while (n.parent) { k++; n = close.get(n.parent); } return k; };
          return d(b) - d(a);
        });
        const finish = id => close.patch(id, { s: 'done', prs: (close.get(id).prs || []).map(([l]) => [l, 'merged']) });
        if (reduced) { order.forEach(finish); return; }
        order.forEach((id, i) => closeTimers.push(setTimeout(() => finish(id), 500 + i * 140)));
      },
      leave() { closeTimers.forEach(clearTimeout); },
    };

    // Start
    const start = parseInt(location.hash.slice(1), 10);
    go(Number.isFinite(start) ? start - 1 : 0);
  }
})();
