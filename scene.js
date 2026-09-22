/* ──────────────────────────────────────────────────────────────────────────
   One WebGL scene, four stations, one idea: every station shows something
   going wrong and the system absorbing it. Colour is the grammar — the whole
   scene is bone-white until something fails, and only then is it warm.

   The scene is decoration. It is gated on viewport, motion preference and
   WebGL support, loaded after the page is usable, and every failure path
   leaves the page working with nothing missing but the picture.
   ────────────────────────────────────────────────────────────────────────── */

const WHITE  = 0xEDEDF0;
const DIM    = 0x3A3A44;
const SIGNAL = 0xFF6B4A;
const STATION_GAP = 60;

/* ── things that must work with or without WebGL ─────────────────────── */

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.up').forEach(el => io.observe(el));

// Project cards open centred, in a native <dialog>. The card element itself is
// moved into the dialog and a same-sized placeholder holds its slot, so the
// grid behind never reflows and nothing jumps when it closes.
//
// The markup ships expanded and JS collapses it, so with no JS every word is
// still on the page; the opening is the enhancement, not the content.
(() => {
  const cards = [...document.querySelectorAll('[data-card]')];
  if (!cards.length) return;

  const dlg = document.createElement('dialog');
  dlg.className = 'card-modal';
  // Persistent, empty until a card is open. The title lives here instead of
  // being cloned, so there is exactly one h4 for the card at all times — one
  // accessible name, one focus target — whether it's sitting in the grid or
  // floating above the open card.
  const titleWrap = document.createElement('div');
  titleWrap.className = 'modal-title';
  dlg.appendChild(titleWrap);
  document.body.appendChild(dlg);

  let current = null, slot = null;

  const close = () => {
    if (!current) return;
    const head = current.querySelector('.card-head');
    // Move the title back to the front of the card's own head, restoring the
    // original h4, .sub, p, .cue order.
    const h4 = titleWrap.querySelector('h4');
    const sub = titleWrap.querySelector('.sub');
    h4.removeAttribute('tabindex');             // was only ever a modal focus target
    head.insertBefore(sub, head.firstChild);
    head.insertBefore(h4, head.firstChild);
    current.classList.remove('open');
    head.setAttribute('aria-expanded', 'false');
    slot.replaceWith(current);                 // back into its own grid cell
    current = null; slot = null;
    if (dlg.open) dlg.close();
    head.focus();                               // never strand the caret
  };

  const open = (card) => {
    if (current) close();
    const r = card.getBoundingClientRect();
    slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.style.height = r.height + 'px';       // hold the space exactly
    card.replaceWith(slot);

    // Lift the title out of the card's head and into its own slot above the
    // card, rather than leaving that space blank above the dialog.
    const head = card.querySelector('.card-head');
    const heading = head.querySelector('h4');
    const sub = head.querySelector('.sub');
    titleWrap.appendChild(heading);
    titleWrap.appendChild(sub);

    dlg.appendChild(card);
    card.classList.add('open');
    head.setAttribute('aria-expanded', 'true');
    current = card;
    dlg.showModal();
    // showModal()'s default focus target landed on the (non-interactive)
    // article in testing, which is both an odd tab stop and paints the
    // browser's native focus ring on the whole card. Focus the heading
    // instead — the standard modal pattern, and what a screen reader should
    // announce on open. It is now in titleWrap, but it's the same element.
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  };

  cards.forEach((card) => {
    card.querySelector('.card-head').addEventListener('click', () => {
      if (current === card) close(); else open(card);
    });
  });

  // Escape fires dialog's own close event; keep the DOM in step with it.
  dlg.addEventListener('close', () => { if (current) close(); });
  // Clicking the backdrop means clicking the dialog itself, not the card.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
})();

const loader = document.getElementById('loader');
const pctEl  = document.getElementById('pct');
const barEl  = document.getElementById('bar');

const steps = { fonts: false, load: false, scene: false };
let shownPct = 0;

function settle(name) {
  steps[name] = true;
  if (Object.values(steps).every(Boolean)) finish();
}
function finish() {
  const done = () => {
    loader.classList.add('done');
    barEl.style.opacity = '0';
    document.body.style.overflow = '';
  };
  // let the counter visibly reach 100 before the curtain lifts
  setTimeout(done, 260);
}
(function tickPct() {
  const target = (Object.values(steps).filter(Boolean).length / 3) * 100;
  shownPct += (target - shownPct) * 0.12;
  const n = Math.min(100, Math.round(shownPct));
  pctEl.textContent = String(n).padStart(3, '0');
  barEl.style.width = n + '%';
  if (n < 100 || !Object.values(steps).every(Boolean)) requestAnimationFrame(tickPct);
  else pctEl.textContent = '100';
})();

document.body.style.overflow = 'hidden';
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => settle('fonts'));
if (document.readyState === 'complete') settle('load');
else addEventListener('load', () => settle('load'), { once: true });
// Never let a stuck dependency hold the page hostage.
setTimeout(() => { Object.keys(steps).forEach(k => steps[k] = true); finish(); }, 4000);

/* ── from here down is the scene, and it is optional ─────────────────── */

const reduce  = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow  = innerWidth < 861;
let hasWebGL = false;
try {
  const t = document.createElement('canvas');
  hasWebGL = !!(t.getContext('webgl2') || t.getContext('webgl'));
} catch { hasWebGL = false; }

if (reduce || narrow || !hasWebGL) {
  settle('scene');
} else {
  build().catch((e) => { console.warn('[scene] disabled:', e); settle('scene'); });
}

async function build() {
  let THREE;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
  } catch (e) { console.warn('[scene] three.js failed to load:', e); settle('scene'); return; }

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08080B, 26, 74);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(4, 8, 6);
  scene.add(key);

  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.1, ...opts });
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const seg = (a, b, m) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), m);

  const stations = [];
  const makeStation = (i) => {
    const g = new THREE.Group();
    g.position.z = -i * STATION_GAP;
    scene.add(g);
    return g;
  };

  /* ── 00 · Access AI Gateway ──────────────────────────────────────────
     Records stream toward a gate. Most pass. One carries an instruction it
     should not, and is caught at the boundary rather than downstream.      */
  const g0 = makeStation(0);
  {
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(7, 5),
      new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.045, side: THREE.DoubleSide }));
    g0.add(gate);
    for (const y of [-2.5, 2.5]) g0.add(seg(new THREE.Vector3(-3.5, y, 0), new THREE.Vector3(3.5, y, 0), lineMat(WHITE, 0.3)));

    const geo = new THREE.BoxGeometry(1.5, 0.12, 0.12);
    const recs = Array.from({ length: 26 }, () => {
      const m = new THREE.Mesh(geo, mat(DIM));
      m.userData = { bad: false, held: 0 };
      reset(m, true);
      g0.add(m);
      return m;
    });
    function reset(m, initial) {
      // Kept deliberately narrow: a wider field drifts behind the text column.
      m.position.set(initial ? -4.6 + Math.random() * 9.2 : -4.6 - Math.random() * 2.5,
        -2.1 + Math.random() * 4.2, -1.6 + Math.random() * 3.2);
      m.userData.bad = Math.random() < 0.13;
      m.userData.held = 0;
      m.material = mat(m.userData.bad ? SIGNAL : DIM,
        m.userData.bad ? { emissive: SIGNAL, emissiveIntensity: 0.35 } : {});
      m.scale.setScalar(1);
      m.userData.v = 0.026 + Math.random() * 0.03;
    }
    g0.userData.step = (dt) => {
      for (const m of recs) {
        const d = m.userData;
        if (d.held > 0) {                       // caught at the gate, dissolving
          d.held += dt;
          m.scale.setScalar(Math.max(0, 1 - d.held * 1.6));
          m.position.x += 0.004;
          if (d.held > 0.85) reset(m);
          continue;
        }
        m.position.x += d.v * (dt * 60);
        if (d.bad && m.position.x >= 0) { d.held = 0.001; m.position.x = 0; }
        else if (m.position.x > 4.6) reset(m);
      }
    };
  }

  /* ── 01 · Distributed Object Storage ─────────────────────────────────
     Chunks scored against every node, placed on the winner — and when a
     node stops answering, the write walks down the ranking instead.       */
  const g1 = makeStation(1);
  {
    const N = 5, GAP = 2.05;
    const nodes = [];
    const nodeGeo = new THREE.BoxGeometry(1.25, 0.22, 1.25);
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(nodeGeo, mat(0x23232A, { emissive: WHITE, emissiveIntensity: 0.05 }));
      m.position.set((i - (N - 1) / 2) * GAP, -1.7, 0);
      g1.add(m);
      nodes.push({ mesh: m, pile: 0, down: false, flash: 0 });
    }
    const lines = nodes.map(() => { const l = seg(new THREE.Vector3(), new THREE.Vector3(), lineMat(WHITE, 0)); g1.add(l); return l; });
    const hash = (a, b) => { let h = 2166136261 ^ a; h = Math.imul(h ^ b, 16777619);
      h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const rank = id => nodes.map((n, i) => ({ i, w: hash(id, i * 2654435761) }))
                            .sort((a, b) => b.w - a.w).map(r => r.i);
    const cGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const chunks = Array.from({ length: 10 }, () => {
      const m = new THREE.Mesh(cGeo, mat(WHITE, { emissive: WHITE, emissiveIntensity: 0.18 }));
      m.visible = false; g1.add(m);
      return { mesh: m, state: 'idle', t: 0, target: 0, from: new THREE.Vector3(), fell: false };
    });
    let id = 1, spawnT = 0, downT = 3;
    const SPAWN = new THREE.Vector3(0, 2.6, 0);
    g1.userData.step = (dt) => {
      downT -= dt;
      if (downT <= 0) {
        const d = nodes.find(n => n.down);
        if (d) { d.down = false; downT = 6 + Math.random() * 4; }
        else { nodes[Math.floor(Math.random() * N)].down = true; downT = 4 + Math.random() * 3; }
      }
      spawnT -= dt;
      if (spawnT <= 0) {
        const c = chunks.find(c => c.state === 'idle');
        if (c) {
          c.id = id++;
          const r = rank(c.id);
          c.target = r.find(i => !nodes[i].down);
          c.fell = c.target !== r[0];
          c.state = 'scoring'; c.t = 0;
          c.mesh.visible = true; c.mesh.position.copy(SPAWN);
          c.mesh.material = mat(c.fell ? SIGNAL : WHITE,
            { emissive: c.fell ? SIGNAL : WHITE, emissiveIntensity: c.fell ? 0.4 : 0.18 });
        }
        spawnT = 1.05;
      }
      lines.forEach(l => { l.material.opacity *= 0.88; });
      for (const c of chunks) {
        if (c.state === 'idle') continue;
        c.t += dt;
        const n = nodes[c.target];
        if (c.state === 'scoring') {
          c.mesh.position.y = SPAWN.y - c.t * 0.3;
          c.mesh.rotation.y += dt * 1.1; c.mesh.rotation.x += dt * 0.6;
          nodes.forEach((nd, i) => {
            const p = lines[i].geometry.attributes.position;
            p.setXYZ(0, c.mesh.position.x, c.mesh.position.y, 0);
            p.setXYZ(1, nd.mesh.position.x, nd.mesh.position.y + 0.12, 0);
            p.needsUpdate = true;
            const win = i === c.target;
            lines[i].material.opacity = Math.max(lines[i].material.opacity, nd.down ? 0.03 : (win ? 0.45 : 0.1));
            lines[i].material.color.setHex(win && c.fell ? SIGNAL : WHITE);
          });
          if (c.t > 0.8) { c.state = 'flying'; c.t = 0; c.from.copy(c.mesh.position); }
        } else if (c.state === 'flying') {
          const k = Math.min(c.t / 0.8, 1);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          c.mesh.position.lerpVectors(c.from, new THREE.Vector3(n.mesh.position.x, -1.4 + n.pile * 0.38, 0), e);
          c.mesh.position.y += Math.sin(k * Math.PI) * 0.45;
          c.mesh.rotation.y += dt * 1.8;
          if (k >= 1) { c.state = 'rest'; c.t = 0; n.pile++; n.flash = 1; c.mesh.rotation.set(0, 0, 0); }
        } else {
          if (c.t > 2.8) {
            const o = Math.max(0, 1 - (c.t - 2.8) / 0.7);
            c.mesh.scale.setScalar(o);
            if (o <= 0.01) { c.state = 'idle'; c.mesh.visible = false; c.mesh.scale.setScalar(1); n.pile = Math.max(0, n.pile - 1); }
          }
        }
      }
      nodes.forEach(n => {
        n.flash = Math.max(0, n.flash - dt * 2);
        const want = n.down ? 0 : 0.05 + n.flash * 0.45;
        n.mesh.material.emissiveIntensity += (want - n.mesh.material.emissiveIntensity) * 0.2;
        n.mesh.material.color.setHex(n.down ? 0x14141A : 0x23232A);
      });
    };
  }

  /* ── 02 · pmbench ────────────────────────────────────────────────────
     Forecasts against the diagonal of perfect calibration. They settle
     onto a bowed curve — confident, and wrong about being confident.      */
  const g2 = makeStation(2);
  {
    const S = 4.4;
    g2.add(seg(new THREE.Vector3(-S / 2, -S / 2, 0), new THREE.Vector3(S / 2, S / 2, 0), lineMat(WHITE, 0.35)));
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(S, S)), lineMat(WHITE, 0.12));
    g2.add(frame);
    const bow = [];
    for (let i = 0; i <= 24; i++) {
      const x = i / 24, y = Math.pow(x, 1.9);     // overconfidence, bowed below
      bow.push(new THREE.Vector3((x - 0.5) * S, (y - 0.5) * S, 0));
    }
    const curve = new THREE.Line(new THREE.BufferGeometry().setFromPoints(bow), lineMat(SIGNAL, 0));
    g2.add(curve);
    const dotGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const dots = Array.from({ length: 70 }, () => {
      const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.5 }));
      g2.add(m); return { mesh: m, t: Math.random() };
    });
    let phase = 0;
    g2.userData.step = (dt) => {
      phase += dt * 0.22;
      const settle = (Math.sin(phase) + 1) / 2;         // scatter ⇄ fitted curve
      curve.material.opacity = settle * 0.8;
      dots.forEach((d, i) => {
        const x = d.t;
        const perfect = x, over = Math.pow(x, 1.9);
        const jitter = Math.sin(i * 12.9898 + phase * 0.6) * 0.12 * (1 - settle);
        const y = perfect * (1 - settle) + over * settle + jitter;
        d.mesh.position.set((x - 0.5) * S, (y - 0.5) * S, Math.sin(i) * 0.15);
        const wrong = settle > 0.55 && (i % 7 === 0);
        d.mesh.material.color.setHex(wrong ? SIGNAL : WHITE);
        d.mesh.material.opacity = wrong ? 0.85 : 0.42;
      });
    };
  }

  /* ── 03 · SOP-guided agent ───────────────────────────────────────────
     Four gates in fixed order. A reply that breaks one is discarded and
     replaced by a computed line — the workflow never skips a phase.       */
  const g3 = makeStation(3);
  {
    const PH = 4, GAP = 2.4;
    const gates = [];
    for (let i = 0; i < PH; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.022, 8, 48),
        new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.3 }));
      ring.position.x = (i - (PH - 1) / 2) * GAP;
      g3.add(ring);
      gates.push({ ring, flash: 0 });
    }
    const tokGeo = new THREE.OctahedronGeometry(0.22);
    const tok = new THREE.Mesh(tokGeo, mat(WHITE, { emissive: WHITE, emissiveIntensity: 0.3 }));
    g3.add(tok);
    const ghost = new THREE.Mesh(tokGeo, new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0 }));
    g3.add(ghost);
    let t = 0, blockAt = 1 + Math.floor(Math.random() * 3), blocked = -1;
    const xOf = (i) => (i - (PH - 1) / 2) * GAP;
    g3.userData.step = (dt) => {
      t += dt * 0.42;
      if (t >= PH) { t = 0; blockAt = 1 + Math.floor(Math.random() * 3); blocked = -1; }
      const i = Math.floor(t), f = t - i;
      tok.position.x = xOf(i) + f * GAP;
      tok.position.y = Math.sin(t * 2.2) * 0.06;
      tok.rotation.y += dt * 1.4; tok.rotation.x += dt * 0.9;

      // at the blocking gate the model's reply is refused and swapped out
      if (i === blockAt && f > 0.42 && blocked !== blockAt) {
        blocked = blockAt;
        gates[blockAt].flash = 1;
        ghost.position.copy(tok.position);
        ghost.material.opacity = 0.9;
      }
      if (ghost.material.opacity > 0) {
        ghost.material.opacity -= dt * 1.1;
        ghost.position.y += dt * 0.7;
        ghost.rotation.z += dt * 2;
      }
      gates.forEach((g, gi) => {
        g.flash = Math.max(0, g.flash - dt * 1.6);
        g.ring.material.color.setHex(g.flash > 0 ? SIGNAL : WHITE);
        const near = Math.max(0, 1 - Math.abs(t - gi));
        g.ring.material.opacity = 0.16 + near * 0.5 + g.flash * 0.4;
        g.ring.scale.setScalar(1 + g.flash * 0.12);
      });
    };
  }

  stations.push(g0, g1, g2, g3);

  /* ── camera rides the scroll through the stations ──────────────────── */
  const keyEls = [document.querySelector('.hero'), ...document.querySelectorAll('.station')];
  // An object appears on the RIGHT of frame when the camera looks to the LEFT
  // of it, so these mirror the panels: the text column and the scene never
  // occupy the same half. Panels alternate right/left down the page.
  const anchors = [
    { p: new THREE.Vector3(-1.7, 1.3, 13.5), l: new THREE.Vector3(-2.8, 0.3, 0) },  // hero — text left,  scene right
    { p: new THREE.Vector3( 1.7, 0.7,  9.0), l: new THREE.Vector3( 2.8, 0.1, 0) },  // 00   — panel right, scene left
    { p: new THREE.Vector3(-1.4, 2.0, 13.0), l: new THREE.Vector3(-2.2,-0.2, 0) },  // 01   — panel left,  scene right
    { p: new THREE.Vector3( 1.7, 0.5,  8.8), l: new THREE.Vector3( 2.8, 0.0, 0) },  // 02   — panel right, scene left
    { p: new THREE.Vector3(-1.9, 0.7, 14.0), l: new THREE.Vector3(-3.0, 0.0, 0) },  // 03   — panel left,  scene right (all four gates)
  ];
  const focusOf = (el) => {
    const r = el.getBoundingClientRect();
    return r.top + scrollY + r.height / 2 - innerHeight / 2;
  };
  const lastPanel = keyEls[keyEls.length - 1].querySelector('.panel');
  let focuses = keyEls.map(focusOf);
  const recomputeFocuses = () => { focuses = keyEls.map(focusOf); };

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    recomputeFocuses();
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  const curPos = anchors[0].p.clone();
  const curLook = anchors[0].l.clone();
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const clock = new THREE.Clock();
  let started = false, intro = 0;

  function progress() {
    const y = scrollY;
    if (y <= focuses[0]) return 0;
    for (let i = 0; i < focuses.length - 1; i++) {
      if (y >= focuses[i] && y <= focuses[i + 1]) {
        const span = Math.max(1, focuses[i + 1] - focuses[i]);
        return i + (y - focuses[i]) / span;
      }
    }
    return focuses.length - 1;
  }

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    // The scene has an ending, and it is tied to the last panel rather than to a
    // scroll distance: it is gone by the time that panel has risen past the
    // middle of the screen. Anchoring it to a distance instead left the gates
    // half-visible in the gap below the panel, which is exactly where there is
    // no content to cover them.
    const pr = lastPanel.getBoundingClientRect();
    const exit = Math.max(0, Math.min(1, (pr.bottom - innerHeight * 0.55) / (innerHeight * 0.35)));
    intro = Math.min(1, intro + dt / 1.2);
    canvas.style.opacity = (exit * intro).toFixed(3);
    canvas.style.visibility = exit < 0.02 ? 'hidden' : 'visible';
    if (exit < 0.02) return;

    // Skip the work while hidden — but never before the first frame, or a page
    // opened in a background tab would never initialise the scene at all and
    // the loader's scene step would never settle.
    if (document.hidden && started) return;

    const t = progress();
    const i = Math.min(anchors.length - 2, Math.floor(t));
    const f = Math.min(1, Math.max(0, t - i));
    const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;

    tmpP.lerpVectors(anchors[i].p, anchors[i + 1].p, ease);
    tmpP.z += -(i + ease) * STATION_GAP + STATION_GAP;   // ride down the line of stations
    if (t < 1) tmpP.z = anchors[0].p.z + (anchors[1].p.z - anchors[0].p.z) * ease;
    tmpL.lerpVectors(anchors[i].l, anchors[i + 1].l, ease);
    tmpL.z = -Math.max(0, Math.min(stations.length - 1, t - 1)) * STATION_GAP;

    // Frame-rate independent damping. dt is clamped generously rather than
    // tightly: under a throttled rAF a small clamp leaves the camera stranded
    // several stations behind the scroll position.
    const damp = 1 - Math.pow(0.0015, Math.min(dt, 0.3));
    curPos.lerp(tmpP, damp);
    curLook.lerp(tmpL, damp);
    camera.position.copy(curPos);
    camera.lookAt(curLook);

    // animate only what is nearby; the rest is fogged out anyway
    const active = Math.round(Math.max(0, t - 1));
    for (let s = 0; s < stations.length; s++) {
      if (Math.abs(s - active) <= 1) stations[s].userData.step(dt);
    }

    renderer.render(scene, camera);
    if (!started) { started = true; canvas.classList.add('on'); settle('scene'); }
  }
  frame();
}
