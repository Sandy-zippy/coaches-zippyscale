// Scroll-driven scenes for the coaches page. Every scene is pose(p): p in 0..1 comes from scroll,
// so any scroll position gives the same frame. Only the hero runs on time (8 s loop, pausable).
// One WebGL renderer draws every 3D stage into a fixed canvas (scissor per stage);
// labels are HTML, placed from projected 3D anchors each frame so text stays sharp.
import * as THREE from 'three';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { cream: 0xFFFDF7, sand: 0xEFEBDD, line: 0xD6D1C1, char: 0x2A2A35, lime: 0xD5EB4B, grey: 0xB9B5A8, cream2: 0xE9E4D4 };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t;
const lerp = (a, b, t) => a + (b - a) * t;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const col = c => new THREE.Color(c);
const LIME = col(C.lime), CREAM = col(C.cream), GREY = col(C.grey), CHAR = col(C.char);

// ---------- 3D kit ----------
function edges(g, angle = 30) { return new THREE.LineSegments(new THREE.EdgesGeometry(g, angle), new THREE.LineBasicMaterial({ color: C.char, transparent: true })); }
function mesh(g, c) {
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: .85, transparent: true }));
  m.castShadow = m.receiveShadow = true; m.add(edges(g)); return m;
}
function block(w, h, d, c = C.cream) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return mesh(g, c); }
function cyl(r, h, c = C.cream) { const g = new THREE.CylinderGeometry(r, r, h, 32); g.translate(0, h / 2, 0); return mesh(g, c); }
function ball(r, c = C.lime) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ color: c, roughness: .6, transparent: true })); m.castShadow = true; return m; }
function outline(w, h, d, c = C.char) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: c, transparent: true })); }
const at = (o, x, y, z) => (o.position.set(x, y, z), o);
const pin = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
function fade(o, a) { o.visible = a > .01; o.traverse(n => { if (n.material) n.material.opacity = a; }); }
const paint = (m, c) => m.material.color.copy(c);

let LAST = null; // ponytail: each GL factory calls stage() once; the loop picks it up right after
function stage({ fit, fitP, dir = [10, 11, 10], look = [0, 0, 0], dark = false, groundY = 0, rotP, rotL, lookP }) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x5a5a66 : 0xd6d1c1, dark ? 1.5 : 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(5, 12, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: dark ? .08 : .13 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; ground.receiveShadow = true; scene.add(ground);
  const group = new THREE.Group(); scene.add(group);
  return LAST = { scene, cam, group, fit, fitP, rotP, rotL, dir: new THREE.Vector3(...dir), look: new THREE.Vector3(...look), lookP: lookP && new THREE.Vector3(...lookP) };
}
function fitCam(S, w, h) {
  const a = w / h, port = a < 1, [fw, fh] = port && S.fitP ? S.fitP : S.fit, hh = Math.max(fh / 2, fw / 2 / a);
  Object.assign(S.cam, { left: -hh * a, right: hh * a, top: hh, bottom: -hh }); S.cam.updateProjectionMatrix();
  if (S.rotP !== undefined || S.rotL !== undefined) S.group.rotation.y = port ? (S.rotP ?? 0) : (S.rotL ?? 0);
  const lk = port && S.lookP ? S.lookP : S.look;
  S.cam.position.copy(lk).add(S.dir); S.cam.lookAt(lk);
}

// ---------- HTML labels pinned to 3D anchors ----------
function lab(el, text, cls = 'lab') {
  const e = document.createElement('div'); e.className = cls;
  if (cls.startsWith('tag')) { e.innerHTML = '<span class="tg"></span>'; e.firstChild.textContent = text; } else e.textContent = text;
  el.querySelector('.ov').appendChild(e); return e;
}
function setText(e, t, lime) {
  const n = e.classList.contains('tag') ? e.firstChild : e;
  if (n.textContent !== t) { n.textContent = t; e._w = e._h = 0; }
  if (lime !== undefined) n.classList.toggle('l', lime);
}
const _v = new THREE.Vector3();
function put(e, obj, S, w, h, o = 1) {
  if (o <= .01) { if (e._o !== 0) { e.style.opacity = 0; e.style.visibility = 'hidden'; e._o = 0; } return; }
  obj.getWorldPosition(_v).project(S.cam);
  let x = (_v.x + 1) / 2 * w; const y = (1 - _v.y) / 2 * h;
  const ew = e._w || (e._w = e.offsetWidth);
  if (e.classList.contains('tag') && !e.classList.contains('c')) { x += 14; if (x + ew > w - 8) x -= ew + 28; x = clamp(x, 8, Math.max(8, w - ew - 8)); }   // tag sits right of its anchor, flips near the edge, never leaves the stage
  else x = clamp(x - ew / 2, 8, w - ew - 8);                                        // centred label, kept inside the stage
  let y2 = y; const eh = e._h || (e._h = e.offsetHeight);
  for (let moved = true, n = 0; moved && n < 6; n++) { moved = false;
    for (const b of S.boxes) if (x < b.x + b.w + 4 && x + ew + 4 > b.x && Math.abs(y2 - b.y) < (eh + b.h) / 2 + 2) { y2 = b.y + (eh + b.h) / 2 + 3; moved = true; } }
  if (y2 - y > eh * 2.2) { e.style.opacity = 0; e.style.visibility = 'hidden'; e._o = 0; return; }
  S.boxes.push({ x, y: y2, w: ew, h: eh });
  e.style.transform = `translate(${x.toFixed(1)}px,${y2.toFixed(1)}px) translateY(-50%)`;
  e.style.opacity = o; e.style.visibility = 'visible'; e._o = o;
}
const arc = (a, b, u, hgt, out) => out.lerpVectors(a, b, u).setY(lerp(a.y, b.y, u) + Math.sin(Math.PI * u) * hgt);

// ---------- 1 hero: phone footage becomes ads, the test picks a winner, a call lands (time-driven loop) ----------
function hero(el) {
  const S = stage({ fit: [15, 6.2], fitP: [12, 13], groundY: -.3, look: [0, .9, 0], rotL: Math.PI / 4 }), g = S.group; // landscape: the row runs across the frame
  g.add(at(block(15, .3, 5, C.sand), 0, -.3, 0));
  const px = -5.6, phone = at(block(1.3, 2.6, .3, C.cream), px, 0, 0), scr = at(block(1.05, 2.1, .06, C.char), px, .25, .15);
  g.add(phone, scr);
  const cards = [0, 1, 2, 3, 4].map(i => { const m = block(1.1, 1.5, .12, C.cream); g.add(m); return { m, x: (i - 2) * 1.45 - .4 }; });
  const tiles = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const m = at(block(.62, .12, .62, C.cream), 4.3 + c * .78, 0, -.8 + r * .8); g.add(m); tiles.push(m); }
  const tile = tiles[6], tok = ball(.26); g.add(tok);
  const T = {
    shoot: [lab(el, 'Your 20-min shoot', 'tag'), pin(g, px, 2.9, 0)],
    win: [lab(el, 'Winner', 'tag'), pin(cards[2].m, .3, 1.8, 0)],
    cal: [lab(el, 'Call held: Tue 2pm', 'tag'), pin(tile, 0, .5, 0)],
  };
  S.labels = (w, h) => { for (const k in T) put(T[k][0], T[k][1], S, w, h, T[k].o); };
  const from = new THREE.Vector3(px, 1.4, 0), to = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();
  return t => {
    const back = 1 - seg(t, .9, .98), a = Math.PI / 4 + .09 * Math.sin(2 * Math.PI * t);
    S.dir.set(14.1 * Math.sin(a), 11, 14.1 * Math.cos(a));
    paint(scr, CHAR.clone().lerp(LIME, seg(t, .02, .06) * (1 - seg(t, .3, .36))));
    const q = ease(seg(t, .36, .46));
    cards.forEach((c, i) => {
      const s = .1 + i * .035, u = ease(seg(t, s, s + .12)), win = i === 2;
      to.set(c.x, win ? .6 * q : 0, 0); arc(from, to, u, 1.2, c.m.position);
      c.m.scale.setScalar(Math.max(.001, u * back));
      paint(c.m, win ? CREAM.clone().lerp(LIME, q) : CREAM.clone().lerp(GREY, q * .9));
      fade(c.m, win ? 1 : 1 - q * .55);
    });
    paint(tile, CREAM.clone().lerp(LIME, ease(seg(t, .68, .72)) * back));
    A.set(cards[2].x, 2.5, 0); B.set(tile.position.x, .5, tile.position.z);
    arc(A, B, ease(seg(t, .56, .68)), 1.4, tok.position);
    tok.scale.setScalar(Math.max(.001, seg(t, .46, .5) * (1 - seg(t, .7, .74))));
    T.shoot.o = seg(t, .03, .08) * (1 - seg(t, .3, .36)); T.win.o = seg(t, .44, .5) * back; T.cal.o = seg(t, .7, .76) * back;
  };
}

// ---------- 2 problem: your network, three clients enroll and drift off, the calendar drains ----------
function network(el) {
  const S = stage({ fit: [15.5, 10.4], fitP: [11.5, 11.5], dark: true, look: [.4, .9, .3] }), g = S.group, cx = -2;
  const you = at(cyl(.6, .5, C.lime), cx, 0, 0); g.add(you);
  const nodes = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 + 18) * Math.PI / 180, n = cyl(.32, .55, C.cream), rod = block(1, .06, .06, C.line);
    g.add(n, rod); nodes.push({ a, n, rod, closer: [1, 4, 7].indexOf(i) });
  }
  const tankX = 4.4, tankZ = -1.6;
  g.add(at(outline(1.7, 2.8, 1.7, C.cream), tankX, 0, tankZ));
  const fill = at(block(1.5, 2.6, 1.5, C.lime), tankX, 0, tankZ); g.add(fill);
  const L = {
    you: [lab(el, 'You'), pin(g, cx, 1.3, 0)],
    tank: [lab(el, 'Your calendar'), pin(g, tankX, 3.5, tankZ)],
    none: [lab(el, 'Empty slots'), pin(g, tankX, -.2, tankZ + 1.6)],
  };
  const closed = nodes.filter(o => o.closer >= 0).map(o => [lab(el, 'Enrolled'), pin(g, 0, 0, 0), o]);
  S.labels = (w, h) => {
    for (const k in L) put(L[k][0], L[k][1], S, w, h, L[k].o ?? 1);
    closed.forEach(([e, a, o]) => { a.position.copy(o.n.position).setY(1.25); put(e, a, S, w, h, o.lo); });
  };
  return p => {
    nodes.forEach(o => {
      const j = o.closer, s = j >= 0 ? .08 + j * .07 : 0, pull = j >= 0 ? ease(seg(p, s, s + .3)) : 0, R = 3.2 + 2.3 * pull;
      const x = cx + Math.cos(o.a) * R, z = Math.sin(o.a) * R;
      o.n.position.set(x, 0, z);
      if (j >= 0) { paint(o.n, CREAM.clone().lerp(LIME, seg(p, s, s + .05))); o.lo = seg(p, s, s + .05); }
      const len = R - .9; o.rod.scale.x = len; o.rod.position.set(cx + Math.cos(o.a) * (R / 2 + .3), .25, Math.sin(o.a) * (R / 2 + .3)); o.rod.rotation.y = -o.a;
      fade(o.rod, j >= 0 ? 1 - seg(p, s + .05, s + .2) : 1);
    });
    fill.scale.y = Math.max(.002, 1 - ease(seg(p, .35, .92)));
    L.none.o = seg(p, .88, .95);
  };
}

// ---------- 4 mechanism: clips ride a belt under the weekly test; winners go live; only a qualified booking becomes a call ----------
function sweep(el) {
  const S = stage({ fit: [19.5, 6.8], fitP: [6.4, 16], dir: [3, 13, 10], look: [.3, .5, 0], rotP: -Math.PI / 2 }), g = S.group;
  g.add(at(block(11.4, .25, 2.2, C.sand), -3.9, 0, 0));
  const archX = -6;
  [-1.15, 1.15].forEach(z => g.add(at(block(.22, 2, .22, C.lime), archX, 0, z)));
  g.add(at(block(.22, .22, 2.52, C.lime), archX, 2, 0));
  const names = ['Reel', 'Podcast', 'Zoom', 'Selfie', 'Story', 'Q&A'], hot = [false, false, true, false, true, false];
  const cards = names.map((n, i) => {
    const m = block(1.15, .14, 1.5, C.cream); g.add(m);
    return { m, i, hot: hot[i], nm: [lab(el, n, 'lab nm'), pin(m, 0, -.15, 1.25)], chip: [lab(el, hot[i] ? 'Winner' : 'Cut', 'tag c'), pin(m, 0, .55, 0)] };
  });
  cards.forEach(c => c.hot && c.chip[0].firstChild.classList.add('l'));
  const out = at(block(1.6, 1.1, 1.6, C.cream), 3.6, 0, 0), gx = 6.1, mt = at(block(1.7, .3, 1.7, C.cream), 8.6, 0, 0);
  [-.8, .8].forEach(z => g.add(at(block(.2, 1.9, .2, C.cream2), gx, 0, z))); g.add(at(block(.2, .2, 1.8, C.cream2), gx, 1.9, 0));
  g.add(out, mt);
  const tok = ball(.24); g.add(tok);
  const L = {
    sw: [lab(el, 'Weekly test'), pin(g, archX, 3.15, 0)],
    out: [lab(el, 'Ads live'), pin(g, 3.6, 1.75, 0)],
    gate: [lab(el, 'Passed qualifier?'), pin(g, gx, 2.65, 0)],
    mt: [lab(el, 'Call held'), pin(g, 8.6, 1, 0)],
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  S.labels = (w, h) => {
    for (const k in L) put(L[k][0], L[k][1], S, w, h, L[k].o ?? 1);
    // portrait belt is foreshortened: only the winners keep a tag, cut clips just turn grey
    const port = w < h;
    cards.forEach(cd => { put(cd.nm[0], cd.nm[1], S, w, h, cd.o); put(cd.chip[0], cd.chip[1], S, w, h, port && !cd.hot ? 0 : cd.co); });
  };
  return p => {
    const off = 7.6 * ease(seg(p, 0, .5));
    cards.forEach(cd => {
      const x = -13.4 + cd.i * 1.4 + off, passed = seg(x, archX - .2, archX + .6);
      const lift = cd.hot ? .55 * ease(passed) : 0;
      cd.m.position.set(x, .25 + lift, 0);
      paint(cd.m, cd.hot ? CREAM.clone().lerp(LIME, passed) : CREAM.clone().lerp(GREY, passed * .8));
      cd.o = seg(x, -10.4, -9.2); fade(cd.m, cd.o); cd.co = passed * cd.o;
    });
    // token: lands on the winning Zoom clip, goes live as an ad, then only a qualified booking reaches the calendar
    const m = cards[2].m.position;
    a.set(m.x, m.y + .4, 0); b.set(3.6, 1.45, 0); c.set(8.6, .55, 0);
    const u1 = seg(p, .55, .72), u2 = seg(p, .76, .95);
    if (u2 > 0) arc(b, c, ease(u2), 1.3, tok.position); else arc(a, b, ease(u1), 1.6, tok.position);
    tok.scale.setScalar(Math.max(.001, seg(p, .5, .55)));
    paint(out, CREAM.clone().lerp(LIME, seg(p, .7, .74) * (1 - seg(p, .8, .86)) * .7));
    paint(mt, CREAM.clone().lerp(LIME, seg(p, .93, .97)));
    L.out.o = seg(p, .45, .55); L.gate.o = seg(p, .6, .7); L.mt.o = seg(p, .7, .8);
  };
}

// ---------- 6 credentials: 10 coaches rise, a ring of booked calls counts to 912, then turns lime ($70 a call) ----------
function creds(el) {
  const S = stage({ fit: [11, 9.8], fitP: [10.5, 11], dir: [2, 11, 13], look: [0, .8, -.4] }), g = S.group, r = rng(5);
  const pos = [];
  [[-1.725, 4], [-.575, 2], [.575, 4]].forEach(([z, n]) => { for (let i = 0; i < n; i++) pos.push([(i - (n - 1) / 2) * 1.15, z - .2]); });
  const types = pos.map(([x, z]) => { const m = at(block(.85, .9 + r() * 1.3, .85), x, 0, z); g.add(m); return m; });
  const ring = new THREE.Group(); g.add(ring);
  const dots = []; for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, d = at(i ? block(.17, .17, .17, C.grey) : ball(.2), Math.cos(a) * 4, i ? .05 : .22, Math.sin(a) * 4); ring.add(d); dots.push(d); }
  const cnt = el.querySelector('.cnt'), num = cnt.firstChild, cap = cnt.lastChild;
  return p => {
    types.forEach((m, i) => { m.scale.y = Math.max(.002, ease(seg(p, .02 + i * .025, .14 + i * .025))); });
    const c = seg(p, .35, .62), n = Math.round(72 * c); dots.forEach((d, i) => d.visible = i < n || (i === 0 && p > .35));
    const l = seg(p, .7, .8); dots.forEach((d, i) => i && paint(d, GREY.clone().lerp(LIME, l)));
    ring.rotation.y = -p * .9;
    const t = p < .35 ? '10+' : p < .7 ? String(Math.round(912 * c)) : '$70', k = p < .35 ? 0 : p < .7 ? 1 : 2;
    if (num.textContent !== t) num.textContent = t;
    if (cnt._ph !== k) { cnt._ph = k; cap.textContent = ['coaches helped', 'sales calls booked for one coaching company', 'per booked call, down from $250'][k]; }
  };
}

// ---------- 7 proof: cost per booked call, $250 down to $70 ----------
function proof(el) {
  const S = stage({ fit: [12.5, 5.6], fitP: [10.6, 8], dir: [2, 9, 13], look: [0, .6, .2] }), g = S.group, x0 = -4.5;
  g.add(at(outline(9, .8, 1, C.char), 0, 0, 0));
  const bg = new THREE.BoxGeometry(1, .8, 1); bg.translate(.5, .4, 0);
  const bar = at(mesh(bg, C.lime), x0, 0, 0); g.add(bar);
  const tok = ball(.24); g.add(tok);
  const L = {
    per: [lab(el, 'Cost per booked call', 'lab k'), pin(g, 0, -.35, .9)],
    hi: [lab(el, '$250'), pin(g, 4.5, 1.55, 0)],
    lo: [lab(el, '$70'), pin(g, 0, 1.55, 0)],
  };
  L.hi[0].style.fontSize = L.lo[0].style.fontSize = '22px';
  S.labels = (w, h) => { for (const k in L) put(L[k][0], L[k][1], S, w, h, L[k].o ?? 1); };
  return p => {
    const len = lerp(9, 2.52, ease(seg(p, .2, .8)));
    bar.scale.x = len; L.lo[1].position.x = x0 + len; tok.position.set(x0 + len, 1.05, 0);
    L.lo.o = seg(p, .8, .86);
  };
}

// ---------- 9 offer: five parts ring the promise, then the risk moves off your side of the scale ----------
function scale(el) {
  const S = stage({ fit: [11.5, 7.4], fitP: [8.6, 9], dir: [0, 10, 13], look: [0, 1.7, 0], dark: true }), g = S.group;
  const tok = ball(.32); g.add(tok);
  const names = ['Page', 'Tracker', 'Angle Map', 'Launch Batch', 'Show-Up'];
  const parts = names.map((n, i) => { const m = block(1.1, .8, 1.1, C.cream); g.add(m); return { m, a: -Math.PI / 2 + i * 2 * Math.PI / 5, e: lab(el, n, 'lab nm'), an: pin(m, 0, 1.55, 0) }; });
  const prom = [lab(el, '25 calls in 90 days'), pin(g, 0, -.2, 2.9)];
  prom[0].style.fontSize = '20px';
  // the scale: post, a beam that tilts toward the loaded side, two hanging pans
  const sc = new THREE.Group(); g.add(sc);
  sc.add(block(.32, 3.2, .32, C.cream), at(block(1.6, .2, 1.2, C.cream), 0, 0, 0));
  const beam = at(new THREE.Group(), 0, 3.35, 0); sc.add(beam);
  beam.add(mesh(new THREE.BoxGeometry(6.2, .16, .3), C.cream));
  const pans = [-1, 1].map(sd => { const pg = new THREE.Group(); sc.add(pg); pg.add(block(1.7, .12, 1.7, C.cream)); const str = at(block(.04, 1.5, .04, C.line), 0, .12, 0); pg.add(str); return pg; });
  const wt = block(.8, .6, .8, C.lime); sc.add(wt);
  const L = {
    you: [lab(el, 'Your side'), pin(sc, 0, 0, 0)], us: [lab(el, 'Our side'), pin(sc, 0, 0, 0)],
    risk: [lab(el, 'The risk', 'tag'), pin(wt, 0, 1.2, 0)], miss: [lab(el, 'Miss 25: every dollar of our fee back'), pin(sc, -2.6, 4.6, 0)],
  };
  L.miss[0].style.fontSize = '16px';
  S.labels = (w, h) => {
    parts.forEach(o => put(o.e, o.an, S, w, h, o.o)); put(prom[0], prom[1], S, w, h, prom.o);
    for (const k in L) put(L[k][0], L[k][1], S, w, h, L[k].o);
  };
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  return p => {
    const out = seg(p, .42, .5);
    parts.forEach((o, i) => {
      const u = ease(seg(p, .02 + i * .05, .2 + i * .05)), R = lerp(5, 2.4, u);
      o.m.position.set(Math.cos(o.a) * R, lerp(3, 0, u), Math.sin(o.a) * R);
      o.m.scale.setScalar(Math.max(.002, 1 - out)); o.o = u * (1 - out);
    });
    prom.o = seg(p, .25, .32) * (1 - out);
    const sIn = ease(seg(p, .48, .56)); sc.scale.setScalar(Math.max(.002, sIn)); sc.visible = sIn > 0;
    const s = ease(seg(p, .6, .85)), th = lerp(.22, -.22, s);
    beam.rotation.z = th;
    pans.forEach((pg, i) => { const sd = i ? 1 : -1; pg.position.set(sd * 2.9 * Math.cos(th), 3.35 + sd * 2.9 * Math.sin(th) - 1.6, 0); });
    A.copy(pans[0].position).setY(pans[0].position.y + .12); B.copy(pans[1].position).setY(pans[1].position.y + .12);
    arc(A, B, s, 1.6, wt.position);
    L.you[1].position.copy(pans[0].position).setY(pans[0].position.y - 1.05); L.us[1].position.copy(pans[1].position).setY(pans[1].position.y - 1.05);
    L.you.o = L.us.o = L.risk.o = sIn; L.miss.o = seg(p, .86, .93);
    tok.position.set(0, lerp(.32, 3.75, sIn), 0); tok.scale.setScalar(1);
  };
}

// ---------- 10 not for: small offers drop through the sieve, high-ticket programs stay on top ----------
function sieve(el) {
  const S = stage({ fit: [11, 10.6], fitP: [11, 12], look: [0, 2.2, 0] }), g = S.group; g.scale.setScalar(1.35);
  const y0 = 2.4, F = 4.6;
  [[-F / 2, 0, F, .2], [F / 2, 0, F, .2]].forEach(([x]) => g.add(at(block(.2, .2, F, C.cream2), x, y0, 0)));
  [-F / 2, F / 2].forEach(z => g.add(at(block(F, .2, .2, C.cream2), 0, y0, z)));
  for (let k = -1; k <= 1; k++) { g.add(at(block(.05, .1, F, C.line), k * .9, y0 + .05, 0), at(block(F, .1, .05, C.line), 0, y0 + .05, k * .9)); }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(block(.14, y0, .14, C.cream2), a * F / 2, 0, b * F / 2)));
  const house = () => { const h = new THREE.Group(); h.add(cyl(.26, .12, C.cream)); return h; }; // a small coin: a low-ticket sale
  const homes = [[-1.35, -1.35], [.45, -.45], [1.35, 1.35], [-.45, 1.35], [1.35, -1.35], [-1.35, .45]].map(([x, z], i) => { const h = house(); g.add(h); return { h, x, z, i }; });
  const biz = [[-.45, -1.35, 1.6, 'High-ticket'], [.45, .45, 1.2, 'Group program'], [-1.35, -.45, .9, 'Mastermind']].map(([x, z, ht, n], i) => {
    const m = block(.95, ht, .95, C.cream); g.add(m); return { m, x, z, i, ht, e: lab(el, n), an: pin(m, 0, ht + .35, 0) };
  });
  const homeL = [lab(el, 'Under $3k'), pin(g, homes[2].x, -.1, homes[2].z + .9)];
  S.labels = (w, h) => { biz.forEach(b => put(b.e, b.an, S, w, h, b.o)); put(homeL[0], homeL[1], S, w, h, homeL.o); };
  return p => {
    biz.forEach(b => { const u = easeIn(seg(p, .05 + b.i * .06, .28 + b.i * .06)); b.m.position.set(b.x, lerp(7, y0 + .2, u), b.z); b.o = seg(p, .3 + b.i * .06, .36 + b.i * .06); });
    homes.forEach(o => {
      const u = easeIn(seg(p, .12 + o.i * .05, .62 + o.i * .05)), y = lerp(7, 0, u);
      o.h.position.set(o.x, y, o.z); o.h.children.forEach(m => paint(m, y < y0 ? GREY : CREAM));
    });
    homeL.o = seg(p, .85, .92);
  };
}

// ---------- 13 P.S.: two ads race to one buyer's phone in January; yours lands first ----------
function race(el) {
  const S = stage({ fit: [11.5, 6.6], fitP: [8.6, 9], dir: [3, 10, 13], look: [1.3, .9, 0], lookP: [1.2, 1.2, 0] }), g = S.group;
  const bx = 2.4, bld = at(block(1.5, 3, .3, C.cream), bx, 0, 0), cap = at(block(1.2, 2.4, .06, C.cream), bx, .3, .16);
  g.add(bld, cap);
  const env = c => { const m = block(1, .14, .7, c); g.add(m); return m; };
  const ours = env(C.lime), theirs = env(C.grey);
  const tag = [lab(el, 'Ready to buy', 'tag'), pin(g, bx + .6, 3.4, 0)];
  const L = { you: [lab(el, 'You'), pin(ours, 0, .65, 0)], them: [lab(el, 'Another coach'), pin(theirs, 0, .65, 0)] };
  S.labels = (w, h) => { put(tag[0], tag[1], S, w, h, 1); for (const k in L) put(L[k][0], L[k][1], S, w, h, L[k].o); };
  // ours lands on the phone; theirs arrives late and stops short behind it, so the end state never overlaps
  const go = (m, u, z, x1) => m.position.set(lerp(innerWidth < 720 ? -1.4 : -3.4, x1, u), .7 + Math.sin(Math.PI * u) * .7, z * (1 - u * .4));
  return p => {
    const uo = ease(seg(p, .08, .55)), ut = seg(p, .12, .97);
    go(ours, uo, 1, bx - 1.5); go(theirs, ut, -1.4, bx - 3.4);
    const won = p > .58;
    paint(cap, won ? LIME : CREAM); setText(tag[0], won ? 'Call booked: Tue 10am' : 'Ready to buy', won);
    L.you.o = 1 - seg(p, .55, .62); L.them.o = 1 - seg(p, .95, .99);
  };
}

// ---------- HTML scenes ----------
function fan(el) {
  const cards = [...el.querySelectorAll('.fx')], stack = el.querySelector('.stackcard'), tok = el.querySelector('.gtok'), mq = matchMedia('(max-width:1140px)');
  document.documentElement.classList.add('fanon');
  return p => {
    if (mq.matches) { // stacked grid: each card back tips up into place as it arrives
      stack.style.opacity = 1;
      cards.forEach((c, i) => { const e = ease(seg(p, .02 + i * .07, .2 + i * .07)); c.querySelector('.b').style.transform = `perspective(900px) rotateX(${((1 - e) * 70).toFixed(1)}deg)`; });
      return;
    }
    cards.forEach(c => c.querySelector('.b').style.transform = '');
    const spread = ease(seg(p, 0, .16));
    let cur = -1;
    cards.forEach((c, i) => {
      const x = (i - 2.5) * 178 * spread - 84, s = .16 + i * .09, fl = ease(seg(p, s, s + .1));
      if (p >= s) cur = i;
      c.style.transform = `translate3d(${x.toFixed(1)}px,0,0) rotateZ(${((i - 2.5) * 5 * (1 - spread)).toFixed(2)}deg) rotateY(${(fl * 180).toFixed(1)}deg)`;
    });
    tok.style.transform = `translateX(${cur < 0 ? 0 : (cur - 2.5) * 178}px)`;
    tok.style.opacity = 1 - seg(p, .78, .86);
    const o = seg(p, .78, .9); stack.style.opacity = o; stack.style.transform = `translateX(-50%) translateY(${((1 - o) * 16).toFixed(1)}px)`;
  };
}
function week(el) {
  const wk = el.querySelector('.wk'), items = ['appr', 'mail', 'c2', 'li', 'meet', 'c3'].map(k => el.querySelector(`[data-k="${k}"]`)), mq = matchMedia('(max-width:720px)');
  return p => {
    wk.style.transform = mq.matches ? 'none' : `rotateX(${(18 * (1 - ease(seg(p, 0, .5)))).toFixed(2)}deg)`;
    items.forEach((e, i) => { const o = seg(p, .08 + i * .11, .18 + i * .11); e.style.opacity = o; e.style.transform = `translateY(${((1 - o) * 12).toFixed(1)}px)`; });
  };
}
function sheet(el) {
  const sh = el.querySelector('.sheet'), rows = [...el.querySelectorAll('.row')], env = el.querySelector('.env');
  return p => {
    rows.forEach((r, i) => { const o = seg(p, .05 + i * .08, .14 + i * .08); r.style.opacity = o; r.style.transform = `translateX(${((1 - o) * -16).toFixed(1)}px)`; });
    const f = ease(seg(p, .62, .86));
    sh.style.transform = `translateY(${(f * 140).toFixed(1)}px) rotateX(${(f * 70).toFixed(1)}deg) scale(${(1 - f * .4).toFixed(3)})`;
    sh.style.opacity = 1 - seg(p, .8, .9);
    const eo = seg(p, .7, .84); env.style.opacity = eo; env.style.visibility = eo > 0 ? 'visible' : 'hidden';
    sh.style.visibility = p < .9 ? 'visible' : 'hidden';
  };
}
function path(el) {
  const pd = el.querySelector('#pd'), L = pd.getTotalLength(), stops = [...el.querySelectorAll('.stop')], tok = el.querySelector('.ptok');
  pd.style.strokeDasharray = L;
  const sx = [80, 330, 600, 900], th = sx.map(x => { let l = 0; while (l < L && pd.getPointAtLength(l).x < x) l += L / 400; return l / L; });
  return p => {
    const q = ease(seg(p, .05, .9));
    pd.style.strokeDashoffset = L * (1 - q);
    stops.forEach((s, i) => s.classList.toggle('on', q >= th[i] - .01));
    const pt = pd.getPointAtLength(L * q);
    tok.style.transform = `translate(${(pt.x / 1000 * el.clientWidth).toFixed(1)}px,${(pt.y / 360 * el.clientHeight).toFixed(1)}px)`;
    tok.style.visibility = q > .97 ? 'hidden' : 'visible'; // arrived: stop 4 lights up instead
  };
}

// ---------- loop ----------
const GL = { hero, network, sweep, creds, proof, scale, sieve, race }, HT = { fan, week, sheet, path };
// still frame for reduced motion, per the storyboard: the payoff state of each scene
const STILL = { hero: .8, sheet: .45 };
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, alpha: true });
  renderer.setClearColor(0, 0); renderer.autoClear = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (e) { document.documentElement.classList.add('nogl'); }
function size() { if (!renderer) return; renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 640 ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight); }
size(); addEventListener('resize', size);

const list = [...document.querySelectorAll('[data-scene]')].map(el => {
  const k = el.dataset.scene;
  if (GL[k]) { if (!renderer) return null; const f = GL[k](el); return { el, k, gl: true, f, S: LAST }; }
  return { el, k, f: HT[k](el) };
}).filter(Boolean);

// hero clock: only advances while the hero is on screen and not paused
const pauseBtn = document.querySelector('.pause');
let heroPaused = RM, heroMs = 0, heroLast = null;
if (RM) pauseBtn.hidden = true;
pauseBtn.addEventListener('click', () => {
  heroPaused = !heroPaused; pauseBtn.setAttribute('aria-pressed', heroPaused); pauseBtn.textContent = heroPaused ? 'Play' : 'Pause';
});
document.fonts && document.fonts.ready.then(() => document.querySelectorAll('.lab,.tag').forEach(e => e._w = e._h = 0));

const Q = new URLSearchParams(location.search), FREEZE = Q.get('p'), HERO_T = Q.get('t'); // frame-check hooks: ?p=0.5 freezes scroll scenes, ?t=0.5 the hero
let lastSig = '';
function frame(now) {
  requestAnimationFrame(frame);
  if (renderer && (renderer.domElement.clientWidth !== innerWidth || renderer.domElement.clientHeight !== innerHeight)) size(); // some viewport changes fire no resize event
  const vh = innerHeight, todo = [];
  let sig = innerWidth + 'x' + vh;
  for (const s of list) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width === 0) { if (s.k === 'hero') heroLast = null; continue; }
    let p;
    if (s.k === 'hero') {
      if (heroLast !== null && !heroPaused) heroMs += now - heroLast;
      heroLast = now; p = RM ? STILL.hero : HERO_T !== null ? +HERO_T : (heroMs % 8000) / 8000;
    } else p = RM ? (STILL[s.k] ?? 1) : FREEZE !== null ? +FREEZE : clamp((.85 * vh - r.top) / (.7 * vh));
    if (!s.gl) { if (p !== s.last) { s.f(p); s.last = p; } continue; }
    todo.push([s, r, p]); sig += `|${s.k}:${p.toFixed(4)}:${r.left.toFixed(1)}:${r.top.toFixed(1)}:${r.width.toFixed(1)}:${r.height.toFixed(1)}`;
  }
  if (!renderer || sig === lastSig) return;   // nothing moved: keep the last frame, no redraw
  lastSig = sig;
  renderer.setScissorTest(false); renderer.clear();
  for (const [s, r, p] of todo) {
    const S = s.S;
    fitCam(S, r.width, r.height); s.f(p);
    S.scene.updateMatrixWorld(); S.cam.updateMatrixWorld();
    S.boxes = []; S.labels && S.labels(r.width, r.height);
    renderer.setViewport(r.left, vh - r.bottom, r.width, r.height);
    renderer.setScissor(r.left, vh - r.bottom, r.width, r.height);
    renderer.setScissorTest(true);
    renderer.render(S.scene, S.cam);
  }
}
requestAnimationFrame(frame);
