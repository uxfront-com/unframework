/* UDAX graph renderer.
   One renderer draws every canvas in the deck so the product reads as one system.
   Nodes are HTML (text-heavy), edges are SVG underneath, both inside a scaled "world". */

(function () {
  const GLYPHS = {
    backlog: '<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.15 2.25"/>',
    todo: '<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    progress: '<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 7V3.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/>',
    review: '<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 7V3.2a3.8 3.8 0 1 1-3.8 3.8Z" fill="currentColor"/>',
    done: '<circle cx="7" cy="7" r="6.5" fill="currentColor"/><path d="m4.2 7.2 1.9 1.9 3.7-3.9" fill="none" stroke="#131a30" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const STATUS = { backlog: 'Backlog', todo: 'To do', progress: 'In progress', review: 'In review', done: 'Done' };
  const ORDER = ['backlog', 'todo', 'progress', 'review', 'done'];

  const ICONS = {
    pr: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 10.9V6.6a2.3 2.3 0 0 0-2.3-2.3H7.4"/><path d="M8.8 2.6 7.2 4.3l1.6 1.6"/></svg>',
    prDraft: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 4.2v.1M12 7.6v.1"/></svg>',
    merged: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="9" r="1.6"/><path d="M4 5.1v5.8M4 5.1c0 2.6 2.3 3.9 6.4 3.9"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.3 2.8 2.8 6.2-6.4"/></svg>',
    open: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg>',
    branch: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="4.5" cy="3.5" r="1.6"/><circle cx="4.5" cy="12.5" r="1.6"/><circle cx="11.5" cy="5" r="1.6"/><path d="M4.5 5.1v5.8M11.5 6.6c0 3-7 2.2-7 4.3"/></svg>',
    block: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M4.2 11.8 11.8 4.2"/></svg>',
    commit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.6"/><path d="M1.5 8h3.9M10.6 8h3.9"/></svg>',
    pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 14.5s4.5-4.2 4.5-7.7A4.5 4.5 0 0 0 3.5 6.8c0 3.5 4.5 7.7 4.5 7.7Z"/><circle cx="8" cy="6.8" r="1.6"/></svg>',
    chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>',
    code: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5l3.5 3.5-3.5 3.5"/></svg>',
    term: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="m4.5 6 2 2-2 2M8.5 10.5h3"/></svg>',
    reload: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/></svg>',
    file: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3.5 1.8h5.7L12.5 5v9.2h-9Z"/><path d="M9 1.8V5h3.5"/></svg>',
  };
  const PR_LABEL = { draft: 'Draft', ready: 'Ready for review', running: 'Checks running', failing: 'Checks failing', changes: 'Changes requested', approved: 'Approved', merged: 'Merged' };

  const REPO_COLOR = { api: '#5aa9ff', web: '#ff9f6e', mobile: '#b58cff', ds: '#6fe0c0', infra: '#e6e36b', search: '#8fb3ff', billing: '#f08fb8' };

  const glyph = (s, cls = 'glyph') => `<svg class="${cls}" viewBox="0 0 14 14" aria-hidden="true">${GLYPHS[s]}</svg>`;
  const prIcon = st => (st === 'merged' ? ICONS.merged : st === 'draft' ? ICONS.prDraft : ICONS.pr);
  const prPill = (label, st, short = false) =>
    `<span class="pr ${st}" title="${label}: ${PR_LABEL[st]}">${prIcon(st)}${short ? label.replace(/^.*#/, '#') : label}</span>`;
  const repoChip = r => `<span class="repo" style="--rc:${REPO_COLOR[r] || '#999'}">${r}</span>`;
  // Assignees do the work (people or agents). The owner answers for it (always a person).
  const assigneeChip = (a, withName) => (a.agent
    ? `<span class="agent" title="Assignee: ${a.name} (agent)">${a.name[0]}</span>${withName ? `<span class="asg-name">${a.name}</span>` : ''}`
    : `<span class="avatar ${a.cls}" title="Assignee: ${a.name}">${a.i}</span>`);
  const ownerAvatar = (p, from, extra = '') =>
    `<span class="avatar owner ${p.cls}${from ? ' inherited' : ''}${extra}" title="Owner: ${p.name}${from ? `, from ${from}` : ''}">${p.i}</span>`;

  /* ---------- Sample project: Checkout 2.0 ---------- */

  const PEOPLE = {
    MC: { i: 'MC', name: 'Maya Chen', cls: 'h1c', color: '#9a86ff' },
    TR: { i: 'TR', name: 'Theo Ramos', cls: 'h2c', color: '#4f9bff' },
    PN: { i: 'PN', name: 'Priya Nair', cls: 'h3c', color: '#e8739f' },
  };
  const A = name => ({ agent: true, name });

  function checkout() {
    const H = PEOPLE;
    return [
      { id: 'CHK-1', t: 'One-page checkout', s: 'progress', owner: H.MC, repos: ['web', 'api', 'mobile', 'ds'], risk: 'med', age: 0 },
      { id: 'CHK-13', parent: 'CHK-1', t: 'Address autocomplete', s: 'done', owner: H.PN, assignees: [H.PN], repos: ['web', 'api'], prs: [['web#470', 'merged'], ['api#211', 'merged']], risk: 'low', age: 6 },
      { id: 'CHK-34', parent: 'CHK-13', t: 'Places proxy with rate limits', s: 'done', assignees: [A('Atlas')], repos: ['api'], prs: [['api#208', 'merged']], risk: 'low', age: 9 },
      { id: 'CHK-35', parent: 'CHK-13', t: 'Accessible address combobox', s: 'done', assignees: [H.PN], repos: ['ds', 'web'], prs: [['ds#77', 'merged']], risk: 'low', age: 7 },
      { id: 'CHK-12', parent: 'CHK-1', t: 'Wallet payments', s: 'progress', owner: H.TR, repos: ['api', 'web', 'mobile'], risk: 'high', age: 0 },
      {
        id: 'CHK-31', parent: 'CHK-12', t: 'Tokenize wallet payments', s: 'review', assignees: [A('Atlas')], repos: ['api'], prs: [['api#219', 'approved']], risk: 'high', age: 1,
        detail: { branch: 'chk-31/tokenize-wallets', rows: [['api', 'api#219', 'approved', '14 files']], crit: [[1, 'Tokens never touch our logs'], [1, 'Idempotent on retry'], [1, 'Sandbox charges pass']] },
      },
      {
        id: 'CHK-32', parent: 'CHK-12', t: 'Wallet buttons on web checkout', s: 'progress', assignees: [A('Wren')], live: 'editing OrderSummary.tsx', repos: ['web', 'ds'], prs: [['web#482', 'running']], risk: 'med', age: 0,
        detail: { branch: 'chk-32/wallet-buttons', rows: [['web', 'web#482', 'running', '6 of 9 checks'], ['ds', null, null, '2 files, no PR yet']], crit: [[1, 'Apple Pay shows on Safari'], [1, 'Google Pay shows on Chrome'], [0, 'Falls back to the card form']] },
      },
      {
        id: 'CHK-33', parent: 'CHK-12', t: 'Wallet sheet on iOS and Android', s: 'todo', assignees: [H.TR], repos: ['mobile'], risk: 'med', age: 3,
        detail: { branch: 'chk-33/wallet-sheet', blocked: 'CHK-31', rows: [['mobile', null, null, 'Starts when CHK-31 merges']], crit: [[0, 'Native sheet on both platforms'], [0, 'Same tokens as web']] },
      },
      { id: 'CHK-17', parent: 'CHK-1', t: 'Cart on the new pricing engine', s: 'progress', owner: H.PN, repos: ['api', 'web'], risk: 'high', age: 0 },
      { id: 'CHK-40', parent: 'CHK-17', t: 'Quote prices from pricing-engine', s: 'progress', assignees: [A('Pike')], live: 'running contract tests', repos: ['api'], prs: [['api#224', 'running']], risk: 'high', age: 0 },
      { id: 'CHK-41', parent: 'CHK-17', t: 'Show new totals in the cart', s: 'progress', assignees: [A('Kit')], live: 'editing OrderSummary.tsx', repos: ['web'], prs: [['web#488', 'draft']], risk: 'med', age: 0 },
      {
        id: 'CHK-14', parent: 'CHK-1', t: 'Guest checkout', s: 'todo', assignees: [A('Juno')], repos: ['api', 'web'], risk: 'med', age: 2,
        ask: { from: 'Juno', q: 'Should guest sessions expire after 24 hours or 7 days?', a: ['24 hours', '7 days', 'Reply'] },
      },
      { id: 'CHK-36', parent: 'CHK-14', t: 'Guest session tokens', s: 'backlog', repos: ['api'], risk: 'med', age: 12 },
      { id: 'CHK-37', parent: 'CHK-14', t: 'Claim an account after purchase', s: 'backlog', repos: ['api', 'web'], risk: 'low', age: 12 },
      { id: 'CHK-15', parent: 'CHK-1', t: 'Order confirmation and receipts', s: 'review', owner: H.TR, repos: ['api', 'web'], risk: 'low', age: 1 },
      { id: 'CHK-38', parent: 'CHK-15', t: 'Receipt email template', s: 'done', assignees: [A('Atlas')], repos: ['api'], prs: [['api#215', 'merged']], risk: 'low', age: 4 },
      { id: 'CHK-39', parent: 'CHK-15', t: 'PDF receipts', s: 'review', assignees: [A('Atlas')], repos: ['api'], prs: [['api#221', 'approved']], risk: 'low', age: 5 },
      { id: 'CHK-16', parent: 'CHK-1', t: 'Checkout funnel analytics', s: 'backlog', repos: ['web'], risk: 'low', age: 21 },
    ];
  }
  const CHECKOUT_DEPS = [['CHK-33', 'CHK-31'], ['CHK-41', 'CHK-40']];
  const CHECKOUT_COLLISIONS = [['CHK-32', 'CHK-41', 'Both editing OrderSummary.tsx']];

  // Deterministic sibling projects for the portfolio altitude.
  function rng(seed) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function farProject(prefix, title, origin, count, weights, seed, needs) {
    const r = rng(seed);
    const pick = () => {
      let x = r(), acc = 0;
      for (let i = 0; i < ORDER.length; i++) { acc += weights[i]; if (x <= acc) return ORDER[i]; }
      return 'done';
    };
    const nodes = [{ id: `${prefix}-1`, t: title, s: 'progress', far: true, origin, repos: [], cluster: title }];
    let n = 2;
    const l1 = Math.max(3, Math.round(count / 3.2));
    for (let i = 0; i < l1 && n <= count; i++) {
      const p = `${prefix}-${n++}`;
      nodes.push({ id: p, parent: `${prefix}-1`, t: '', s: pick(), far: true, repos: [] });
      const kids = Math.floor(r() * 3);
      for (let k = 0; k < kids && n <= count; k++) nodes.push({ id: `${prefix}-${n++}`, parent: p, t: '', s: pick(), far: true, repos: [] });
    }
    if (needs) nodes[nodes.length - 2].needs = true;
    return nodes;
  }
  function portfolio() {
    return [
      ...farProject('SRCH', 'Search relevance', { x: -2750, y: -780 }, 13, [0.05, 0.08, 0.12, 0.1, 0.65], 7),
      ...farProject('MOB', 'Mobile app 4.0', { x: 2050, y: -900 }, 17, [0.15, 0.2, 0.3, 0.15, 0.2], 21),
      ...farProject('BIL', 'Billing migration', { x: -2300, y: 1150 }, 11, [0.45, 0.3, 0.15, 0.05, 0.05], 3, true),
      ...farProject('INF', 'Edge caching', { x: 2350, y: 1250 }, 9, [0.1, 0.2, 0.2, 0.2, 0.3], 44),
    ];
  }

  /* ---------- Renderer ---------- */

  const ALT = {
    dots: { colW: 480, gap: 60, k: s => 0.4 / s },
    pills: { colW: 480, gap: 38, k: (s, g) => (g.opts.pillK || 0.85) / s },
    cards: { colW: 470, gap: 26, k: () => 1 },
    detail: { colW: 540, gap: 30, k: () => 1 },
  };

  let uid = 0;

  class Graph {
    constructor(el, opts = {}) {
      this.el = el;
      this.id = `g${++uid}`;
      this.opts = Object.assign({ altitude: 'cards', scale: 1, lens: 'status', ask: true, detailIds: null }, opts);
      this.nodes = new Map();
      this.order = [];
      this.deps = opts.deps || [];
      this.collisions = opts.collisions || [];
      this.ghostEdges = [];
      el.classList.add('graph');
      el.innerHTML = `
        <div class="world">
          <div class="marker" style="position:absolute;left:0;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none"></div>
          <svg class="edges" width="1" height="1">
            <defs><marker id="${this.id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1 9 5 1 9" fill="none" stroke="#737d9f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
          </svg>
          <div class="labels"></div>
          <div class="layer"></div>
        </div>`;
      this.world = el.querySelector('.world');
      this.marker = el.querySelector('.marker');
      this.svg = el.querySelector('svg.edges');
      this.layer = el.querySelector('.layer');
      this.labels = el.querySelector('.labels');
      this.paths = new Map();
      (opts.nodes || []).forEach(n => this.add(n, false));
      this.setAltitude(this.opts.altitude, this.opts.scale, false);
      this.setLens(this.opts.lens);
    }

    /* ----- nodes ----- */
    add(n, relayout = true) {
      const el = document.createElement('div');
      el.dataset.id = n.id;
      this.layer.appendChild(el);
      this.nodes.set(n.id, { n, el });
      this.order.push(n.id);
      if (this.k) el.style.transform = `translate(-50%, -50%) scale(${this.k})`;
      this.render(n.id);
      if (relayout) this.relayout();
      return el;
    }
    remove(id) {
      const rec = this.nodes.get(id);
      if (!rec) return;
      rec.el.remove();
      this.nodes.delete(id);
      this.order = this.order.filter(x => x !== id);
      const p = this.paths.get(`t:${id}`);
      if (p) { p.remove(); this.paths.delete(`t:${id}`); }
    }
    get(id) { return this.nodes.get(id)?.n; }
    patch(id, patch, relayout = false) {
      const rec = this.nodes.get(id);
      Object.assign(rec.n, patch);
      this.render(id);
      if (relayout) this.relayout(); else this.drawEdges();
    }
    children(id) { return this.order.map(x => this.nodes.get(x).n).filter(n => n.parent === id); }
    // Explicit owner, or the nearest ancestor's. `from` names the issue it was inherited from.
    ownerOf(n) {
      if (n.owner) return { p: n.owner, from: n.ownerFrom || null };
      let cur = n;
      while (cur.parent && this.nodes.has(cur.parent)) {
        cur = this.nodes.get(cur.parent).n;
        if (cur.owner) return { p: cur.owner, from: cur.id };
      }
      return null;
    }

    render(id) {
      const { n, el } = this.nodes.get(id);
      let kids = this.children(id).filter(k => !k.ghost || k.accepted);
      let counts = {};
      kids.forEach(k => (counts[k.ghost ? 'backlog' : k.s] = (counts[k.ghost ? 'backlog' : k.s] || 0) + 1));
      if (n.rollup) { counts = n.rollup; kids = Object.entries(n.rollup).flatMap(([st, c]) => Array(c).fill({ s: st })); }
      const doneKids = counts.done || 0;
      const primaryRepo = (n.repos && n.repos[0]) || 'none';
      const detailOn = n.detail && (!this.opts.detailIds || this.opts.detailIds.includes(n.id));
      const cls = ['node', `st-${n.s}`];
      if (n.live) cls.push('agent-live');
      if (n.ghost) cls.push('ghost');
      if (n.accepted) cls.push('accepted');
      if (n.far) cls.push('far');
      if (n.rejected) cls.push('rejected');
      if (detailOn) cls.push('detailable');
      const own = this.ownerOf(n);
      const asg = n.assignees || [];
      cls.push(!asg.length ? 'asg-none' : asg.some(a => a.agent) ? 'asg-agent' : 'asg-human');
      if (el.classList.contains('is-selected')) cls.push('is-selected');
      if (el.classList.contains('dim')) cls.push('dim');
      if (el.classList.contains('entering')) cls.push('entering');
      el.className = cls.join(' ');
      el.style.setProperty('--rc', REPO_COLOR[primaryRepo] || '#6e7899');
      const counted = n.s === 'todo' || n.s === 'progress' || n.s === 'review';
      el.style.setProperty('--heat', !counted ? '#343c63' : n.age >= 5 ? '#ff7a6b' : n.age >= 2 ? '#ffb547' : '#4f5d95');
      el.style.setProperty('--oc', own ? own.p.color : '#737d9f');
      el.style.setProperty('--risk', n.risk === 'high' ? '#ff7a6b' : n.risk === 'med' ? '#ffb547' : '#4f5d95');
      el.setAttribute('role', 'treeitem');
      el.setAttribute('aria-label', `${n.id} ${n.t}, ${STATUS[n.s]}${own ? `, owned by ${own.p.name}` : ''}${asg.length ? `, assigned to ${asg.map(a => a.name).join(' and ')}` : ''}`);

      if (n.far) {
        el.innerHTML = `${n.needs ? '<i class="beacon"></i>' : ''}`;
        return;
      }

      const lensTag = {
        repo: primaryRepo,
        owner: own ? own.p.name.split(' ')[0] : 'No owner',
        assignee: asg.length ? asg.map(a => a.name.split(' ')[0]).join(', ') : 'Nobody',
        stuck: n.s === 'done' || n.s === 'backlog' ? 'Not counted' : n.age === 0 ? 'Active today' : `Idle ${n.age}d`, risk: `${n.risk === 'med' ? 'Medium' : n.risk === 'high' ? 'High' : 'Low'} risk`,
      };

      const prs = (n.prs || []).map(([l, st]) => prPill(l, st, true)).join('');
      const rollup = kids.length
        ? `<div class="rollup" title="${doneKids} of ${kids.length} sub-issues done">${ORDER.slice().reverse().filter(s => counts[s]).map(s => `<i class="st-${s}" style="flex:${counts[s]}"></i>`).join('')}</div>`
        : '';
      const worker = asg.find(a => a.agent) || asg[0];
      const live = n.live && worker
        ? `<div class="n-agent"><span class="agent">${worker.name[0]}</span><span><b>${worker.name}</b> ${n.live}</span></div>`
        : '';
      const askTo = own ? ` ${own.p.name.split(' ')[0]}` : '';
      const ask = n.ask && this.opts.ask
        ? `<i class="beacon"></i><div class="ask"><b>${n.ask.from} asks${askTo}</b><br>${n.ask.q}<div class="ask-actions">${n.ask.a.map(a => `<span>${a}</span>`).join('')}</div></div>`
        : n.needs ? '<i class="beacon"></i>' : '';
      // One avatar when the owner is also the only assignee.
      const same = own && asg.length === 1 && !asg[0].agent && asg[0].i === own.p.i;
      const shown = n.live || same ? [] : asg;
      const ownerHead = shown.map(a => assigneeChip(a, shown.length === 1)).join('') + (own ? ownerAvatar(own.p, same ? null : own.from) : '');

      let detail = '';
      if (detailOn) {
        const d = n.detail;
        detail = `<div class="n-detail">
          <div class="d-row"><span style="width:13px;color:var(--text-3)">${ICONS.branch}</span><span class="mono">${d.branch}</span></div>
          ${d.blocked ? `<div class="d-row" style="color:var(--text-1)"><span style="width:13px;color:var(--coral)">${ICONS.block}</span>Blocked by ${d.blocked}</div>` : ''}
          ${d.rows.map(([repo, pr, st, note]) => `<div class="d-row">${repoChip(repo)}${pr ? prPill(pr, st, true) : ''}<span class="grow"></span><span>${note}</span></div>`).join('')}
          <div style="padding-top:6px;border-top:1px solid var(--line-soft)">
          ${d.crit.map(([ok, c]) => `<div class="crit"><span style="color:${ok ? 'var(--st-done)' : 'var(--text-3)'}">${ok ? ICONS.check : ICONS.open}</span>${c}</div>`).join('')}
          </div>
        </div>`;
      }

      if (n.ghost) {
        el.innerHTML = `
          <div class="n-pill">${glyph('backlog')}<span>${n.t}</span></div>
          <div class="n-head">${glyph('backlog')}<span class="n-key">${n.accepted ? n.id2 || n.id : 'Proposed'}</span><span class="n-owner">${n.est ? `<span class="small" style="font-size:11px">${n.est}</span>` : ''}</span></div>
          <div class="n-title">${n.t}</div>
          ${n.why ? `<div class="g-why">${n.why}</div>` : ''}
          <div class="n-foot">${(n.repos || []).map(repoChip).join('')}</div>
          <div class="ghost-actions"><span><i class="kbd">↵</i>Accept</span><span><i class="kbd">E</i>Edit</span><span><i class="kbd">⌫</i>Drop</span></div>`;
        return;
      }

      el.innerHTML = `
        ${ask}
        <div class="n-pill">${glyph(n.s)}<span>${n.t}</span></div>
        <div class="n-head c">${glyph(n.s)}<span class="n-key">${n.id}</span><span class="n-owner">${ownerHead}</span></div>
        <div class="n-title">${n.t}</div>
        <div class="n-foot">${(n.repos || []).map(repoChip).join('')}<span class="lens-tag">${lensTag[this.opts.lens] || ''}</span><span class="grow"></span>${prs ? `<span class="n-prs">${prs}</span>` : ''}${kids.length ? `<span class="n-kids">${doneKids}/${kids.length}</span>` : ''}</div>
        ${rollup}
        ${live}
        ${detail}`;
    }
    renderAll() { this.order.forEach(id => this.render(id)); }

    /* ----- view state ----- */
    setAltitude(alt, s, animate = true) {
      this.alt = alt;
      this.s = s ?? this.s;
      this.k = ALT[alt].k(this.s, this);
      ['dots', 'pills', 'cards', 'detail'].forEach(a => this.el.classList.toggle(`alt-${a}`, a === alt));
      this.world.style.setProperty('--k', this.k);
      this.nodes.forEach(({ el }) => (el.style.transform = `translate(-50%, -50%) scale(${this.k})`));
      this.relayout(animate);
    }
    setLens(lens) {
      this.opts.lens = lens;
      ['status', 'repo', 'owner', 'assignee', 'stuck', 'risk'].forEach(l => this.el.classList.toggle(`lens-${l}`, l === lens));
      this.renderAll();
      requestAnimationFrame(() => this.drawEdges());
    }

    relayout(animate = true) {
      const m = ALT[this.alt];
      const pos = {};
      const kidsOf = new Map();
      const roots = [];
      this.order.forEach(id => {
        const n = this.nodes.get(id).n;
        if (n.rejected) return;
        if (n.parent && this.nodes.has(n.parent)) {
          if (!kidsOf.has(n.parent)) kidsOf.set(n.parent, []);
          kidsOf.get(n.parent).push(n);
        } else roots.push(n);
      });
      const vh = n => this.nodes.get(n.id).el.offsetHeight * this.k;
      roots.forEach(root => {
        const ox = root.origin ? root.origin.x : 0;
        const oy = root.origin ? root.origin.y : 0;
        const colW = root.far ? 480 : m.colW;
        let cursor = 0;
        const rec = (n, depth) => {
          const ch = kidsOf.get(n.id) || [];
          if (!ch.length) {
            const h = root.far ? 60 : vh(n);
            pos[n.id] = { x: ox + depth * colW, y: oy + cursor + h / 2 };
            cursor += h + (root.far ? 50 : m.gap);
            return;
          }
          ch.forEach(c => rec(c, depth + 1));
          pos[n.id] = { x: ox + depth * colW, y: (pos[ch[0].id].y + pos[ch[ch.length - 1].id].y) / 2 };
        };
        rec(root, 0);
      });
      this.pos = pos;
      if (!animate) this.el.classList.add('no-anim');
      Object.entries(pos).forEach(([id, p]) => {
        const el = this.nodes.get(id).el;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      });
      this.placeClusterLabels();
      if (!animate) {
        void this.el.offsetWidth;
        this.el.classList.remove('no-anim');
        this.drawEdges();
      } else this.animateEdges(900);
    }

    placeClusterLabels() {
      this.labels.innerHTML = '';
      const clusters = {};
      this.order.forEach(id => {
        const n = this.nodes.get(id).n;
        const root = n.cluster ? n : null;
        if (root) clusters[n.id] = { title: n.cluster, ids: [] };
      });
      const rootOf = id => {
        let n = this.nodes.get(id).n;
        while (n.parent && this.nodes.has(n.parent)) n = this.nodes.get(n.parent).n;
        return n.id;
      };
      this.order.forEach(id => { const r = rootOf(id); if (clusters[r]) clusters[r].ids.push(id); });
      Object.values(clusters).forEach(c => {
        const xs = c.ids.map(i => this.pos[i]?.x ?? 0), ys = c.ids.map(i => this.pos[i]?.y ?? 0);
        const lab = document.createElement('div');
        lab.className = 'cluster-label';
        const statuses = c.ids.map(i => this.nodes.get(i).n.s);
        const done = statuses.filter(s => s === 'done').length;
        lab.innerHTML = `${c.title}<small>${done} of ${c.ids.length} done</small>`;
        lab.style.left = `${(Math.min(...xs) + Math.max(...xs)) / 2}px`;
        lab.style.top = `${Math.max(...ys) + 120}px`;
        this.labels.appendChild(lab);
      });
    }

    /* ----- camera ----- */
    camera(cx, cy, s = this.s, animate = true) {
      this.s = s;
      this.world.style.setProperty('--s', s);
      const W = this.el.clientWidth, Hh = this.el.clientHeight;
      if (!animate) this.el.classList.add('no-anim');
      this.world.style.transform = `translate(${W / 2 - cx * s}px, ${Hh / 2 - cy * s}px) scale(${s})`;
      if (!animate) { void this.el.offsetWidth; this.el.classList.remove('no-anim'); this.drawEdges(); }
      else this.animateEdges(900);
    }
    bbox(ids) {
      ids = ids || [...this.nodes.keys()];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ids.forEach(id => {
        const p = this.pos[id]; const rec = this.nodes.get(id);
        if (!p || !rec) return;
        const w = rec.el.offsetWidth * this.k / 2, h = rec.el.offsetHeight * this.k / 2;
        x0 = Math.min(x0, p.x - w); x1 = Math.max(x1, p.x + w);
        y0 = Math.min(y0, p.y - h); y1 = Math.max(y1, p.y + h);
      });
      return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    }
    focus(ids, { s, pad = 40, dx = 0, dy = 0, animate = true } = {}) {
      const b = this.bbox(ids);
      const W = this.el.clientWidth, Hh = this.el.clientHeight;
      const fit = Math.min((W - pad * 2) / b.w, (Hh - pad * 2) / b.h);
      this.camera(b.cx + dx, b.cy + dy, s ?? fit, animate);
    }

    /* ----- edges ----- */
    path(key, cls, marker) {
      let p = this.paths.get(key);
      if (!p) {
        p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.svg.appendChild(p);
        this.paths.set(key, p);
      }
      p.setAttribute('class', cls);
      if (marker) p.setAttribute('marker-end', `url(#${this.id}-arrow)`); else p.removeAttribute('marker-end');
      return p;
    }
    animateEdges(ms) {
      const t0 = performance.now();
      cancelAnimationFrame(this.raf);
      const tick = now => {
        this.drawEdges();
        if (now - t0 < ms) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    drawEdges() {
      const m = this.marker.getBoundingClientRect();
      const sc = m.width / 1000;
      if (!sc) return;
      const rects = new Map();
      const R = id => {
        if (rects.has(id)) return rects.get(id);
        const rec = this.nodes.get(id);
        if (!rec) return null;
        const r = rec.el.getBoundingClientRect();
        const o = { l: (r.left - m.left) / sc, r: (r.right - m.left) / sc, t: (r.top - m.top) / sc, b: (r.bottom - m.top) / sc };
        o.cx = (o.l + o.r) / 2; o.cy = (o.t + o.b) / 2;
        rects.set(id, o);
        return o;
      };
      const seen = new Set();
      this.order.forEach(id => {
        const n = this.nodes.get(id).n;
        if (!n.parent || !this.nodes.has(n.parent)) return;
        const a = R(n.parent), b = R(id);
        const key = `t:${id}`;
        seen.add(key);
        const st = n.ghost && !n.accepted ? 'ghost' : `st-${n.ghost ? 'backlog' : n.s}`;
        const p = this.path(key, `edge ${st}${this.dimmed && !this.dimmed.has(id) ? ' dim' : ''}`);
        const x1 = this.alt === 'dots' ? a.cx : a.r, y1 = a.cy, x2 = this.alt === 'dots' ? b.cx : b.l, y2 = b.cy;
        const dx = Math.max(40, (x2 - x1) * 0.55);
        p.setAttribute('d', `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`);
        const c = getComputedStyle(this.nodes.get(id).el).getPropertyValue('--c').trim();
        p.style.setProperty('--c', n.ghost && !n.accepted ? '#737d9f' : c || '#737d9f');
      });
      const side = (from, to, cls, key, label) => {
        const a = R(from), b = R(to);
        if (!a || !b) return;
        seen.add(key);
        const bulge = 70 + Math.abs(b.cy - a.cy) * 0.12;
        const off = this.dimmed && !(this.dimmed.has(from) && this.dimmed.has(to));
        const p = this.path(key, `edge ${cls}${off ? ' dim' : ''}`, cls === 'dep');
        const y1 = a.cy + (b.cy > a.cy ? 10 : -10), y2 = b.cy + (b.cy > a.cy ? -10 : 10);
        p.setAttribute('d', `M${a.r} ${y1}C${a.r + bulge} ${y1} ${b.r + bulge} ${y2} ${b.r + 4} ${y2}`);
        if (label) {
          let lab = this.labels.querySelector(`[data-k="${key}"]`);
          if (!lab) {
            lab = document.createElement('div');
            lab.dataset.k = key;
            lab.className = 'edge-label';
            this.labels.appendChild(lab);
          }
          lab.textContent = label;
          lab.style.opacity = off ? 0 : '';
          lab.style.left = `${Math.max(a.r, b.r) + bulge * 0.78}px`;
          lab.style.top = `${(a.cy + b.cy) / 2}px`;
        }
      };
      if (this.opts.deps !== false) this.deps.forEach(([a, b]) => side(a, b, 'dep', `d:${a}:${b}`));
      if (this.opts.collisions !== false) this.collisions.forEach(([a, b, l]) => side(a, b, 'collision', `c:${a}:${b}`, l));
      this.paths.forEach((p, k) => { if (!seen.has(k)) { p.remove(); this.paths.delete(k); } });
    }

    dim(ids) {
      this.dimmed = ids ? new Set(ids) : null;
      this.nodes.forEach(({ el }, id) => el.classList.toggle('dim', !!ids && !ids.includes(id)));
      this.drawEdges();
    }
    select(id) {
      this.nodes.forEach(({ el }, k) => el.classList.toggle('is-selected', k === id));
    }
  }

  window.UDAX = { Graph, glyph, prPill, repoChip, ownerAvatar, ICONS, STATUS, ORDER, PEOPLE, REPO_COLOR, checkout, portfolio, CHECKOUT_DEPS, CHECKOUT_COLLISIONS, PR_LABEL, prIcon };
})();
