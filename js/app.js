(() => {
  'use strict';

  const KEY = 'reaction-time.v1';
  const view = document.getElementById('view');
  const navEl = document.getElementById('nav');
  let current = null;

  const pad = n => String(n).padStart(2, '0');
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const rand = (a, b) => a + Math.random() * (b - a);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : w.endsWith('s') ? 'es' : 's'}`;
  const isPress = e => (e.code === 'Space' || e.code === 'Enter') && !e.repeat;
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const clean = a => (Array.isArray(a) ? a : [])
    .filter(r => r && typeof r.s === 'number' && isFinite(r.s) && r.s >= 0)
    .map(r => ({ s: r.s, t: typeof r.t === 'number' && isFinite(r.t) ? r.t : 0 }));

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
    return n;
  }

  const store = {
    all() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        return d && typeof d === 'object' ? d : {};
      } catch (e) {
        return {};
      }
    },
    runs(id) {
      const a = this.all()[id];
      return Array.isArray(a) ? a : [];
    },
    add(id, score) {
      const d = this.all();
      const a = Array.isArray(d[id]) ? d[id] : [];
      a.push({ s: score, t: Date.now() });
      d[id] = a.slice(-200);
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    },
    any() {
      return Object.values(this.all()).some(a => Array.isArray(a) && a.length);
    },
    merge(src) {
      const d = this.all();
      let added = 0;
      for (const t of TESTS) {
        const cur = clean(d[t.id]);
        const seen = new Set(cur.map(r => r.t + ':' + r.s));
        const fresh = clean(src[t.id]).filter(r => {
          const k = r.t + ':' + r.s;
          return !seen.has(k) && seen.add(k);
        });
        if (!fresh.length) continue;
        const next = cur.concat(fresh).sort((a, b) => a.t - b.t).slice(-200);
        const kept = next.filter(r => fresh.includes(r)).length;
        if (!kept) continue;
        d[t.id] = next;
        added += kept;
      }
      if (!added) return 0;
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { return -1; }
      return added;
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  function scope() {
    const timers = new Set();
    const offs = [];
    let dead = false;
    return {
      after(ms, fn) {
        const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
        timers.add(id);
        return id;
      },
      cancel(id) { clearTimeout(id); timers.delete(id); },
      frame(fn) { requestAnimationFrame(() => { if (!dead) fn(); }); },
      wait(ms) { return new Promise(res => this.after(ms, res)); },
      on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        offs.push(() => target.removeEventListener(type, fn, opts));
      },
      end() {
        dead = true;
        timers.forEach(clearTimeout);
        timers.clear();
        offs.splice(0).forEach(f => f());
      }
    };
  }

  function reaction(stage, sc, done) {
    const TOTAL = 5;
    const times = [];
    let state = 'idle';
    let t0 = 0;
    let timer = 0;
    const big = h('div', { class: 'big' });
    const sub = h('div', { class: 'label' });
    const pips = h('div', { class: 'pips' });
    const field = h('div', { class: 'field' }, h('div', { class: 'readout' }, big, sub), pips);
    stage.replaceChildren(field);

    const set = (s, b, l) => {
      state = s;
      field.dataset.state = s;
      big.textContent = b;
      sub.textContent = l;
      pips.replaceChildren(...Array.from({ length: TOTAL }, (_, i) => h('i', { class: i < times.length ? 'on' : '' })));
    };
    const arm = () => {
      set('wait', 'Wait', '');
      timer = sc.after(rand(1500, 4500), () => {
        field.dataset.state = 'go';
        big.textContent = '';
        sc.frame(() => {
          if (state !== 'wait' || field.dataset.state !== 'go') return;
          t0 = performance.now();
          state = 'go';
        });
      });
    };
    const early = () => {
      sc.cancel(timer);
      set('early', 'Too soon', 'Press to retry');
    };
    const press = () => {
      const now = performance.now();
      if (state === 'wait') early();
      else if (state === 'go') {
        const rt = Math.round(now - t0);
        if (rt < 100) return early();
        times.push(rt);
        set('shown', String(rt), times.length < TOTAL ? 'ms · press to continue' : 'ms · press to finish');
      } else if (state === 'early') arm();
      else if (state === 'shown') {
        if (times.length < TOTAL) arm();
        else done(avg(times), times.join(' · ') + ' ms');
      }
    };
    sc.on(field, 'pointerdown', e => { e.preventDefault(); press(); });
    sc.on(document, 'keydown', e => { if (isPress(e)) { e.preventDefault(); press(); } });
    arm();
  }

  function inhibit(stage, sc, done) {
    const TOTAL = 24;
    const plan = shuffle(Array.from({ length: TOTAL }, (_, i) => i < 17));
    const rts = [];
    let errors = 0;
    let i = -1;
    let state = 'gap';
    let t0 = 0;
    let timer = 0;
    const mark = h('div', { class: 'mark' });
    const count = h('div', { class: 'label corner' });
    const field = h('div', { class: 'field plain' }, mark, count);
    stage.replaceChildren(field);

    const finish = () => {
      const acc = Math.round((TOTAL - errors) / TOTAL * 100);
      if (!rts.length || acc < 80) return done(null, `Accuracy ${acc}% · below 80%, not recorded`);
      done(avg(rts), `Accuracy ${acc}% · ${plural(errors, 'error')}`);
    };
    const next = () => {
      i++;
      if (i >= TOTAL) return finish();
      state = 'gap';
      mark.dataset.kind = 'fix';
      count.textContent = `${i + 1} / ${TOTAL}`;
      timer = sc.after(rand(700, 1800), show);
    };
    const feedback = ok => {
      state = 'fb';
      sc.cancel(timer);
      if (!ok) errors++;
      mark.dataset.kind = ok ? 'ok' : 'bad';
      sc.after(ok ? 260 : 520, next);
    };
    const show = () => {
      state = 'pre';
      mark.dataset.kind = plan[i] ? 'go' : 'stop';
      sc.frame(() => {
        if (state !== 'pre') return;
        t0 = performance.now();
        state = plan[i] ? 'go' : 'stop';
        timer = sc.after(900, () => feedback(state === 'stop'));
      });
    };
    const press = () => {
      const now = performance.now();
      if (state === 'fb') return;
      if (state === 'go' && now - t0 >= 100) {
        rts.push(now - t0);
        feedback(true);
      } else feedback(false);
    };
    sc.on(field, 'pointerdown', e => { e.preventDefault(); press(); });
    sc.on(document, 'keydown', e => { if (isPress(e)) { e.preventDefault(); press(); } });
    next();
  }

  function series(sc, total, expect, paint, count, finish) {
    const log = [];
    let i = -1;
    let state = 'gap';
    let t0 = 0;
    let timer = 0;
    const next = () => {
      if (++i >= total) return finish(log);
      state = 'gap';
      paint('fix', i);
      count.textContent = `${i + 1} / ${total}`;
      timer = sc.after(rand(600, 1400), show);
    };
    const feedback = (ok, rt) => {
      state = 'fb';
      sc.cancel(timer);
      log.push(ok ? rt : null);
      paint(ok ? 'ok' : 'bad', i);
      sc.after(ok ? 260 : 520, next);
    };
    const show = () => {
      state = 'pre';
      paint('cue', i);
      sc.frame(() => {
        if (state !== 'pre') return;
        t0 = performance.now();
        state = 'live';
        timer = sc.after(2500, () => feedback(false));
      });
    };
    next();
    return answer => {
      const rt = performance.now() - t0;
      if (state === 'live') feedback(rt >= 100 && answer === expect(i), rt);
    };
  }

  const tally = log => {
    const rts = log.filter(v => v != null);
    const acc = Math.round(rts.length / log.length * 100);
    return rts.length * 5 < log.length * 4
      ? { text: `Accuracy ${acc}% · below 80%, not recorded` }
      : { mean: avg(rts), text: `Accuracy ${acc}%` };
  };

  function choice(stage, sc, done) {
    const TOTAL = 20;
    const plan = shuffle(Array.from({ length: TOTAL }, (_, i) => i % 2 === 0));
    const mark = h('div', { class: 'mark' });
    const count = h('div', { class: 'label corner' });
    const field = h('div', { class: 'field plain' }, mark, count,
      h('div', { class: 'label side l', text: '← Left' }),
      h('div', { class: 'label side r', text: 'Right →' }));
    stage.replaceChildren(field);

    const paint = (kind, i) => { mark.dataset.kind = kind === 'cue' ? (plan[i] ? 'right' : 'left') : kind; };
    const press = series(sc, TOTAL, i => plan[i], paint, count, log => {
      const r = tally(log);
      done(r.mean, r.mean == null ? r.text : `${r.text} · ${plural(log.filter(v => v == null).length, 'error')}`);
    });
    sc.on(field, 'pointerdown', e => {
      e.preventDefault();
      const b = field.getBoundingClientRect();
      press(e.clientX > b.left + b.width / 2);
    });
    sc.on(document, 'keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      if (!e.repeat) press(e.key === 'ArrowRight');
    });
  }

  function stroop(stage, sc, done) {
    const TOTAL = 20;
    const NAMES = ['Red', 'Green', 'Blue', 'Yellow'];
    const KEYS = 'rgby';
    const CODES = ['KeyR', 'KeyG', 'KeyB', 'KeyY'];
    const plan = [];
    for (const same of shuffle(Array.from({ length: TOTAL }, (_, i) => i < 8))) {
      let c;
      do { c = Math.floor(Math.random() * 4); } while (plan.length && c === plan[plan.length - 1].c);
      plan.push({ c, w: same ? c : (c + 1 + Math.floor(Math.random() * 3)) % 4, same });
    }
    const mark = h('div', { class: 'mark' });
    const word = h('div', { class: 'word', hidden: true });
    const count = h('div', { class: 'label corner' });
    const keys = h('div', { class: 'keys' }, NAMES.map((n, i) =>
      h('button', { class: 'key', type: 'button', 'data-i': i }, h('u', { text: n[0] }), n.slice(1))));
    stage.replaceChildren(h('div', { class: 'field plain col' }, h('div', { class: 'cue' }, mark, word), keys, count));

    const paint = (kind, i) => {
      const on = kind === 'cue';
      if (on) {
        word.textContent = NAMES[plan[i].w];
        word.dataset.ink = KEYS[plan[i].c];
      } else mark.dataset.kind = kind;
      word.hidden = !on;
      mark.hidden = on;
    };
    const press = series(sc, TOTAL, i => plan[i].c, paint, count, log => {
      const r = tally(log);
      if (r.mean == null) return done(null, r.text);
      const of = same => log.filter((v, i) => v != null && plan[i].same === same);
      const gap = Math.round(avg(of(false)) - avg(of(true)));
      done(r.mean, `${r.text} · interference ${gap < 0 ? '−' : '+'}${Math.abs(gap)} ms`);
    });
    sc.on(keys, 'pointerdown', e => {
      const k = e.target.closest('.key');
      if (k) { e.preventDefault(); press(+k.dataset.i); }
    });
    sc.on(keys, 'click', e => {
      const k = e.target.closest('.key');
      if (k && e.detail === 0) press(+k.dataset.i);
    });
    sc.on(document, 'keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const k = e.key.toLowerCase();
      const i = /^[a-z]$/.test(k) ? KEYS.indexOf(k) : CODES.indexOf(e.code);
      if (i >= 0) { e.preventDefault(); press(i); }
    });
  }

  function aim(stage, sc, done) {
    const TOTAL = 20;
    const times = [];
    let misses = 0;
    let t0 = 0;
    const target = h('button', { class: 'target', type: 'button', 'aria-label': 'Target' });
    const count = h('div', { class: 'label corner' });
    const arena = h('div', { class: 'field plain arena' }, target, count);
    stage.replaceChildren(arena);

    const place = () => {
      count.textContent = `${times.length + 1} / ${TOTAL}`;
      const s = target.offsetWidth || 58;
      const p = 16;
      target.style.left = p + Math.random() * Math.max(0, arena.clientWidth - s - p * 2) + 'px';
      target.style.top = p + 28 + Math.random() * Math.max(0, arena.clientHeight - s - p * 2 - 28) + 'px';
      target.classList.remove('in');
      void target.offsetWidth;
      target.classList.add('in');
      t0 = performance.now();
      sc.frame(() => { t0 = performance.now(); });
    };
    sc.on(arena, 'pointerdown', e => {
      e.preventDefault();
      if (e.target !== target) {
        misses++;
        arena.classList.remove('miss');
        void arena.offsetWidth;
        arena.classList.add('miss');
        return;
      }
      times.push(performance.now() - t0);
      if (times.length >= TOTAL) return done(avg(times), `${TOTAL} targets · ${plural(misses, 'miss')}`);
      place();
    });
    place();
  }

  function sequence(stage, sc, done) {
    const seq = [];
    let pos = 0;
    let open = false;
    const cells = Array.from({ length: 9 }, (_, i) => h('button', { class: 'cell', type: 'button', 'data-i': i, 'aria-label': `Cell ${i + 1}` }));
    const count = h('div', { class: 'label corner' });
    const board = h('div', { class: 'board locked', style: '--n:3' }, cells);
    stage.replaceChildren(h('div', { class: 'field plain' }, board, count));

    const round = async () => {
      open = false;
      board.classList.add('locked');
      let n;
      do { n = Math.floor(Math.random() * 9); } while (n === seq[seq.length - 1]);
      seq.push(n);
      pos = 0;
      count.textContent = `Length ${seq.length}`;
      await sc.wait(650);
      for (const i of seq) {
        cells[i].classList.add('lit');
        await sc.wait(400);
        cells[i].classList.remove('lit');
        await sc.wait(170);
      }
      open = true;
      board.classList.remove('locked');
    };
    const pick = c => {
      if (!open) return;
      const i = +c.dataset.i;
      if (i !== seq[pos]) {
        open = false;
        board.classList.add('locked');
        c.classList.add('wrong');
        cells[seq[pos]].classList.add('lit');
        const step = pos + 1;
        sc.after(1000, () => done(seq.length - 1, `Missed step ${step} of ${seq.length}`));
        return;
      }
      c.classList.remove('tap');
      void c.offsetWidth;
      c.classList.add('tap');
      pos++;
      if (pos === seq.length) round();
    };
    sc.on(board, 'pointerdown', e => {
      const c = e.target.closest('.cell');
      if (c) { e.preventDefault(); pick(c); }
    });
    sc.on(board, 'click', e => {
      const c = e.target.closest('.cell');
      if (c && e.detail === 0) pick(c);
    });
    round();
  }

  function digits(stage, sc, done) {
    let n = 3;
    const field = h('div', { class: 'field plain' });
    stage.replaceChildren(field);

    const gen = len => {
      let s = String(1 + Math.floor(Math.random() * 9));
      while (s.length < len) s += Math.floor(Math.random() * 10);
      return s;
    };
    const round = () => {
      const num = gen(n);
      const ms = 1200 + n * 550;
      field.replaceChildren(
        h('div', { class: 'digits', style: `--len:${n}`, text: num }),
        h('div', { class: 'bar', style: `animation-duration:${ms}ms` }),
        h('div', { class: 'label corner', text: `${n} digits` })
      );
      sc.after(ms, () => {
        const input = h('input', { class: 'entry', type: 'text', inputmode: 'numeric', autocomplete: 'off', spellcheck: 'false', maxlength: String(n + 6), 'aria-label': 'Number' });
        const form = h('form', {
          class: 'entryform',
          onsubmit: e => {
            e.preventDefault();
            const v = input.value.replace(/\D/g, '');
            if (!v) return;
            if (v === num) { n++; round(); }
            else done(n - 1, `Shown ${num} · entered ${v}`);
          }
        }, input, h('button', { class: 'btn', type: 'submit', text: 'Enter' }));
        field.replaceChildren(form, h('div', { class: 'label corner', text: `${n} digits` }));
        input.focus();
      });
    };
    round();
  }

  function grid(stage, sc, done) {
    let level = 1;
    let lives = 3;
    let cleared = 0;
    let targets = new Set();
    let found = 0;
    let wrong = 0;
    let open = false;
    const count = h('div', { class: 'label corner' });
    const board = h('div', { class: 'board locked' });
    stage.replaceChildren(h('div', { class: 'field plain' }, board, count));

    const status = () => { count.textContent = `Level ${level} · ${'●'.repeat(lives)}${'○'.repeat(3 - lives)}`; };
    const round = () => {
      const tiles = Math.min(level + 2, 24);
      const n = tiles <= 4 ? 3 : tiles <= 7 ? 4 : tiles <= 11 ? 5 : tiles <= 17 ? 6 : 7;
      targets = new Set(shuffle([...Array(n * n).keys()]).slice(0, tiles));
      found = 0;
      wrong = 0;
      open = false;
      status();
      board.style.setProperty('--n', n);
      board.classList.add('locked');
      const cells = Array.from({ length: n * n }, (_, i) => h('button', { class: 'cell', type: 'button', 'data-i': i, 'aria-label': `Tile ${i + 1}` }));
      board.replaceChildren(...cells);
      sc.after(500, () => {
        cells.forEach((c, i) => { if (targets.has(i)) c.classList.add('lit'); });
        sc.after(1100 + tiles * 60, () => {
          cells.forEach(c => c.classList.remove('lit'));
          open = true;
          board.classList.remove('locked');
        });
      });
    };
    const pick = c => {
      if (!open || c.classList.contains('hit') || c.classList.contains('wrong')) return;
      const i = +c.dataset.i;
      if (targets.has(i)) {
        c.classList.add('hit');
        if (++found === targets.size) {
          open = false;
          board.classList.add('locked');
          cleared = level;
          level++;
          sc.after(550, round);
        }
        return;
      }
      c.classList.add('wrong');
      if (++wrong === 3) {
        open = false;
        board.classList.add('locked');
        lives--;
        status();
        board.querySelectorAll('.cell').forEach((x, j) => { if (targets.has(j)) x.classList.add('lit'); });
        sc.after(1100, () => (lives ? round() : done(cleared, `Stopped at level ${level}`)));
      }
    };
    sc.on(board, 'pointerdown', e => {
      const c = e.target.closest('.cell');
      if (c) { e.preventDefault(); pick(c); }
    });
    sc.on(board, 'click', e => {
      const c = e.target.closest('.cell');
      if (c && e.detail === 0) pick(c);
    });
    round();
  }

  const TESTS = [
    { id: 'reaction', name: 'Reaction', unit: 'ms', lower: true, rule: 'Press the moment the field lights. Five trials.', run: reaction },
    { id: 'inhibit', name: 'Go / No-Go', unit: 'ms', lower: true, rule: 'Press for the disc. Hold for the square.', run: inhibit },
    { id: 'choice', name: 'Choice', unit: 'ms', lower: true, rule: 'Follow the arrow. Arrow keys or tap that side.', run: choice },
    { id: 'stroop', name: 'Stroop', unit: 'ms', lower: true, rule: 'Name the ink, not the word. Keys R G B Y.', run: stroop },
    { id: 'aim', name: 'Aim', unit: 'ms', lower: true, rule: 'Hit twenty targets. Mean time per target.', run: aim },
    { id: 'sequence', name: 'Sequence', unit: 'steps', lower: false, rule: 'Repeat the pattern. It grows by one.', run: sequence },
    { id: 'digits', name: 'Digits', unit: 'digits', lower: false, rule: 'Read the number. Type it back.', run: digits },
    { id: 'grid', name: 'Grid', unit: 'levels', lower: false, rule: 'Recall the lit tiles. Three lives.', run: grid }
  ];

  const fmt = (t, v) => (v == null ? '—' : t.unit === 'ms' ? String(Math.round(v)) : Number.isInteger(v) ? String(v) : v.toFixed(1));
  const unitOf = (t, v) => (t.unit === 'ms' || v !== 1 ? t.unit : t.unit.slice(0, -1));

  function stats(t) {
    const list = store.runs(t.id).map(r => r.s).filter(v => typeof v === 'number' && isFinite(v));
    if (!list.length) return { n: 0, list };
    return { n: list.length, list, best: t.lower ? Math.min(...list) : Math.max(...list), mean: avg(list) };
  }

  function spark(t, list) {
    if (list.length < 2) return h('div', { class: 'spark empty' });
    const w = 240;
    const ht = 56;
    const p = 5;
    const lo = Math.min(...list);
    const hi = Math.max(...list);
    const span = hi - lo || 1;
    const pts = list.map((v, i) => [
      p + i * (w - 2 * p) / (list.length - 1),
      p + (t.lower ? v - lo : hi - v) / span * (ht - 2 * p)
    ]);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    const last = pts[pts.length - 1];
    const box = h('div', { class: 'spark', role: 'img', 'aria-label': `Last ${list.length} results` });
    box.innerHTML = `<svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
    box.append(h('i', { style: `left:${(last[0] / w * 100).toFixed(2)}%;top:${(last[1] / ht * 100).toFixed(2)}%` }));
    return box;
  }

  let notice = '';

  function exportRecords() {
    const d = store.all();
    const records = {};
    for (const t of TESTS) {
      const a = clean(d[t.id]);
      if (a.length) records[t.id] = a;
    }
    const now = new Date();
    const body = JSON.stringify({ app: 'reaction-time', version: 1, exported: now.toISOString(), records }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const a = h('a', { href: url, download: `reaction-time-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function homeView() {
    const rows = TESTS.map((t, i) => {
      const s = stats(t);
      return h('a', { class: 'row', href: `#/${t.id}`, style: `--d:${i}` },
        h('span', { class: 'no', text: pad(i + 1) }),
        h('span', { class: 'name', text: t.name }),
        h('span', { class: 'rule', text: t.rule }),
        h('span', { class: 'bestcol' },
          h('b', { text: fmt(t, s.best) }),
          h('small', { text: s.n ? unitOf(t, s.best) : 'no record' })));
    });
    let armed = false;
    const erase = h('button', { class: 'link label', type: 'button', text: 'Erase records' });
    erase.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        erase.textContent = 'Confirm erase';
        erase.classList.add('warn');
        return;
      }
      store.clear();
      route();
    });
    erase.addEventListener('blur', () => {
      armed = false;
      erase.textContent = 'Erase records';
      erase.classList.remove('warn');
    });
    const has = store.any();
    const note = notice;
    notice = '';
    const save = h('button', { class: 'link label', type: 'button', text: 'Export', onclick: exportRecords });
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
    const load = h('button', { class: 'link label load', type: 'button', text: 'Import', onclick: () => file.click() });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      let msg = 'Not a records file';
      try {
        const d = f.size > 2e6 ? null : JSON.parse(await f.text());
        const src = d && d.records && typeof d.records === 'object' ? d.records : d;
        if (src && typeof src === 'object' && TESTS.some(t => Array.isArray(src[t.id]))) {
          const n = store.merge(src);
          msg = n < 0 ? 'Could not save in this browser' : n ? `Imported ${plural(n, 'run')}` : 'Nothing new to import';
        }
      } catch (e) {}
      if (!file.isConnected) return;
      notice = msg;
      view.replaceChildren(homeView());
      const b = view.querySelector('.load');
      if (b) b.focus({ preventScroll: true });
    });
    return h('section', { class: 'home' },
      h('div', { class: 'head' },
        h('h1', null, 'Reaction ', h('em', { text: 'Time' })),
        h('p', { class: 'label', text: 'Eight measures of speed and memory' })),
      h('div', { class: 'index' }, rows),
      h('div', { class: 'foot' },
        h('span', { class: 'label' + (note ? ' note' : ''), role: 'status', text: note || 'Records stay in this browser' }),
        h('div', { class: 'acts' }, has && save, load, has && erase, file)));
  }

  function testView(t) {
    const idx = TESTS.indexOf(t);
    const prev = TESTS[(idx + TESTS.length - 1) % TESTS.length];
    const next = TESTS[(idx + 1) % TESTS.length];
    const meta = h('aside', { class: 'meta' });
    const stage = h('div', { class: 'stage' });
    const fig = (k, v) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }));

    const paint = () => {
      const s = stats(t);
      meta.replaceChildren(
        h('div', { class: 'no', text: `${pad(idx + 1)} / ${pad(TESTS.length)}` }),
        h('h1', { text: t.name }),
        h('p', { class: 'rule', text: t.rule }),
        h('dl', { class: 'figures' }, fig('Best', fmt(t, s.best)), fig('Mean', fmt(t, s.mean)), fig('Runs', s.n)),
        spark(t, s.list.slice(-24)),
        h('nav', { class: 'pager label', 'aria-label': 'Adjacent tests' },
          h('a', { href: `#/${prev.id}`, text: `← ${prev.name}` }),
          h('a', { href: `#/${next.id}`, text: `${next.name} →` })));
    };

    const finish = (score, detail) => {
      if (current) current.end();
      const sc = current = scope();
      document.body.classList.remove('running');
      const before = stats(t);
      const valid = score != null;
      if (valid) {
        score = t.unit === 'ms' ? Math.round(score) : score;
        store.add(t.id, score);
      }
      const record = valid && (!before.n || (t.lower ? score < before.best : score > before.best));
      const note = !valid ? 'No score' : !before.n ? 'First record' : record ? 'New best' : `Best ${fmt(t, before.best)} ${unitOf(t, before.best)}`;
      const again = h('button', { class: 'btn', type: 'button', text: 'Again', onclick: start });
      stage.replaceChildren(h('div', { class: 'panel' + (record ? ' record' : '') },
        h('div', { class: 'label', text: note }),
        h('div', { class: 'score' }, h('b', { text: valid ? fmt(t, score) : '—' }), valid && h('span', { text: unitOf(t, score) })),
        h('p', { class: 'detail', text: detail || '' }),
        again));
      paint();
      sc.after(500, () => again.focus({ preventScroll: true }));
    };

    function start() {
      if (current) current.end();
      const sc = current = scope();
      document.body.classList.add('running');
      t.run(stage, sc, finish);
    }

    const btn = h('button', { class: 'btn start', type: 'button', text: 'Start', onclick: start });
    stage.replaceChildren(h('div', { class: 'panel' },
      h('div', { class: 'intro' },
        h('div', { class: 'label', text: `${pad(idx + 1)} / ${pad(TESTS.length)}` }),
        h('h2', { text: t.name }),
        h('p', { text: t.rule })),
      btn,
      h('div', { class: 'label keyhint', text: 'Space' })));
    setTimeout(() => { if (btn.isConnected) btn.focus({ preventScroll: true }); }, 0);
    paint();

    return h('section', { class: 'test' }, meta,
      h('div', { class: 'stagewrap' }, stage,
        h('button', { class: 'stop label', type: 'button', text: 'Stop', onclick: () => route() })));
  }

  function route() {
    if (current) { current.end(); current = null; }
    document.body.classList.remove('running');
    const id = location.hash.replace(/^#\/?/, '');
    const t = TESTS.find(x => x.id === id);
    navEl.querySelectorAll('a').forEach(a => {
      if (t && a.getAttribute('href') === `#/${t.id}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = t ? `${t.name} · Reaction Time` : 'Reaction Time';
    view.replaceChildren(t ? testView(t) : homeView());
    window.scrollTo(0, 0);
  }

  navEl.append(...TESTS.map((t, i) => h('a', { href: `#/${t.id}`, title: t.name, 'aria-label': t.name, text: pad(i + 1) })));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('running')) route();
    else if (location.hash.replace(/^#\/?/, '')) location.hash = '#/';
  });
  window.addEventListener('hashchange', route);
  route();
})();
