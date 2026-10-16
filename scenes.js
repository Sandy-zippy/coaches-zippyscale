// Scroll-driven scenes for the coaches page. Every scene is pose(p): p in 0..1 comes from scroll,
// so any scroll position gives the same frame. Only the hero runs on time (8 s loop, pausable).
// Each scene is HTML UI (ad cards, an ads table, a calendar, a phone), so text stays sharp and never overlaps.
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (el, s) => el.querySelector(s), $$ = (el, s) => [...el.querySelectorAll(s)];
const show = (e, o, y = 0, unit = 'em') => { e.style.opacity = o; e.style.transform = y ? `translateY(${(y * (1 - o)).toFixed(2)}${unit})` : ''; };
const txt = (e, t) => { if (e.textContent !== t) e.textContent = t; };

// ---------- 1 hero: your phone shoot becomes 5 ads, the test pauses 4, the winner books a call (time loop) ----------
function hero(el) {
  const tm = $(el, '.tm'), wav = $$(el, '.wav i'), ads = $$(el, '.ad'), arw = $$(el, '.arw'), slots = $$(el, '.gr i'), toast = $(el, '.toast'), W = 2;
  const spend = [.55, .7, 1, .45, .35];
  return t => {
    const back = 1 - seg(t, .93, .99), rec = seg(t, .04, .3);
    txt(tm, String(Math.round(20 * rec)).padStart(2, '0') + ':00');
    wav.forEach((w, i) => w.style.transform = `scaleY(${(rec > 0 && rec < 1 ? .3 + .7 * Math.abs(Math.sin(t * 90 + i * 1.7)) : .25).toFixed(2)})`);
    arw[0].style.setProperty('--k', ease(seg(t, .28, .34)) * back);
    const dec = seg(t, .6, .62) > .5;
    ads.forEach((a, i) => {
      const u = ease(seg(t, .32 + i * .03, .4 + i * .03)) * back;
      a.style.opacity = .3 + .7 * u; a.classList.toggle('ph', u < .5);
      const s = i === W ? ease(seg(t, .46, .58)) * .55 + ease(seg(t, .62, .78)) * .45 : ease(seg(t, .46, .58)) * spend[i] * .55;
      a.querySelector('.sp i').style.transform = `scaleX(${s.toFixed(3)})`;
      a.classList.toggle('off', dec && i !== W); a.classList.toggle('win', dec && i === W);
      const st = a.querySelector('.st'); txt(st, i === W ? 'Winner' : 'Paused'); st.style.opacity = dec ? 1 : 0;
    });
    arw[1].style.setProperty('--k', ease(seg(t, .64, .7)) * back);
    const k = ease(seg(t, .68, .73)) * back;
    show(toast, k, 1); slots.forEach((s, i) => s.classList.toggle('on', i === 3 && k > .5));
  };
}

// ---------- 2 problem: referrals arrive in month 1, stop, and the calendar empties by month 3 ----------
function network(el) {
  const msgs = $$(el, '.msg'), quiet = $(el, '.quiet'), bd = $(el, '.bd'), tabs = $$(el, '.tabs b'), cells = $$(el, '.mc i'), cc = $(el, '.cc b'), ccl = $(el, '.cc span');
  const plan = [[0, 1, 3, 4, 6, 7, 8, 10, 11, 13, 15, 16, 18], [2, 8, 12, 17, 19], [11]]; // booked slots per month
  return p => {
    const m = p < .38 ? 0 : p < .7 ? 1 : 2, st = [0, .38, .7][m], f = ease(seg(p, st + .02, st + .2)), n = Math.round(plan[m].length * f);
    tabs.forEach((b, i) => b.classList.toggle('on', i === m));
    const on = new Set(plan[m].slice(0, n)); cells.forEach((c, i) => c.classList.toggle('on', on.has(i)));
    txt(cc, String(n)); txt(ccl, n === 1 ? 'call booked' : 'calls booked');
    msgs.forEach((e, i) => show(e, seg(p, .03 + i * .07, .08 + i * .07) * (m ? .45 : 1) + 0, 0));
    txt(bd, m ? '0' : String(msgs.filter((_, i) => p > .06 + i * .07).length));
    show(quiet, seg(p, .42, .48));
  };
}

// ---------- 4 the loop: clips become 6 ads, the week's test switches 4 off, the 2 winners get the budget and book calls ----------
function sweep(el) {
  const rows = $$(el, '.srow'), wl = $(el, '.wl'), ft = $(el, '.s-ft'), win = [1, 4], base = [.5, .8, .6, .4, .75, .3];
  return p => {
    const dec = p > .58;
    txt(wl, dec ? 'Week 2: budget on the winners' : 'Week 1: testing 6 new ads');
    rows.forEach((r, i) => {
      const w = win.includes(i), o = ease(seg(p, .02 + i * .05, .12 + i * .05));
      r.style.opacity = o; r.style.transform = `translateX(${((1 - o) * -1.5).toFixed(2)}em)`;
      const s = ease(seg(p, .32, .55)) * base[i] * .6 + (w ? ease(seg(p, .6, .8)) * (1 - base[i] * .6) : 0);
      r.querySelector('.bar i').style.transform = `scaleX(${s.toFixed(3)})`;
      r.classList.toggle('off', dec && !w); r.classList.toggle('win', dec && w);
      r.querySelector('.badge').style.opacity = w ? seg(p, .62, .68) : 0;
      txt(r.querySelector('.dots'), w ? '\u25CF'.repeat(Math.round(3 * seg(p, .66, .86))) : '');
    });
    show(ft, seg(p, .82, .9), .8);
  };
}

// ---------- 6 record: 10+ coaches, then bookings stack up on a lock screen as the count climbs to 912 ----------
function creds(el) {
  const ppl = $$(el, '.ppl i'), num = $(el, '.num'), feed = $(el, '.feed'), scr = $(el, '.c-ph .scr'), nts = $$(el, '.nt');
  return p => {
    ppl.forEach((e, i) => e.style.transform = `scale(${ease(seg(p, .02 + i * .025, .1 + i * .025)).toFixed(3)})`);
    const c = ease(seg(p, .25, .85));
    txt(num, String(Math.round(912 * c)));
    // notifications arrive from the top, newest first: the feed shows the last few to land
    const k = c * nts.length;
    nts.forEach((e, i) => { const o = clamp(k - (nts.length - 1 - i)); e.style.opacity = o; });
    const hgt = nts[0].offsetHeight + 6, hidden = Math.max(0, nts.length - k);
    feed.style.transform = `translateY(${(-hidden * hgt).toFixed(1)}px)`;
  };
}

// ---------- 7 proof: the client's own booking sheet, month by month; cost per call ticks from $250 to $70 ----------
const MONTHS = [21, 31, 45, 40, 33, 57, 51, 12, 34, 17, 22, 34, 28, 21, 26, 13, 7, 38, 9, 16, 23, 8, 6, 29, 11, 11, 24]; // first calls per month, Aug 2024 to Oct 2026
function proof(el) {
  const bars = $$(el, '.bars i');
  bars.forEach((b, i) => b.style.setProperty('--h', (MONTHS[i] / 60 * 90).toFixed(2) + '%')); // 60 sits on the top gridline (90%)
  return p => {
    let last = -1;
    bars.forEach((b, i) => { const u = ease(seg(p, .02 + i * .026, .08 + i * .026)); b.style.transform = `scaleY(${u.toFixed(3)})`; if (u > .5) last = i; });
    bars.forEach((b, i) => b.classList.toggle('pen', i === last && p < .8));
  };
}

// ---------- 9 guarantee: held calls fill 25 slots on a 90-day tracker ----------
function scale(el) {
  const cells = $$(el, '.g25 i'), num = $(el, '.num'), day = $(el, '.dnum'), fill = $(el, '.fill'), hit = $(el, '.hit');
  return p => {
    const k = ease(seg(p, .06, .8)), n = Math.round(25 * k), d = Math.round(lerp(1, 76, k)); // example pace: 25 by about day 76
    cells.forEach((c, i) => c.classList.toggle('on', i < n));
    txt(num, String(n)); txt(day, String(d));
    fill.style.transform = `scaleX(${(d / 90).toFixed(3)})`;
    show(hit, seg(p, .82, .88), .6);
  };
}

// ---------- 10 not for: five coaches apply; high-ticket on calls stays, the rest drop through ----------
function sieve(el) {
  const cards = $$(el, '.vc'), port = () => el.clientWidth < el.clientHeight;
  return p => {
    const pt = port();
    cards.forEach((c, i) => {
      const ok = c.dataset.ok === '1', a = ease(seg(p, .02 + i * .05, .14 + i * .05)), j = seg(p, .3 + i * .1, .38 + i * .1), fall = ok ? 0 : ease(j);
      c.style.opacity = a;
      c.style.transform = pt ? `translateY(${((1 - a) * -1).toFixed(2)}em)` : `translateY(${((1 - a) * -2 + fall * 10.6).toFixed(2)}em) rotate(${(fall * (i % 2 ? 4 : -4)).toFixed(1)}deg)`;
      c.classList.toggle('ok', ok && j > .5); c.classList.toggle('no', !ok && j > .5);
      c.querySelector('.stamp').style.opacity = seg(j, .5, 1);
    });
  };
}

// ---------- 13 P.S.: your next client scrolls, taps your ad, passes the qualifier, the call is booked ----------
function race(el) {
  const feed = $(el, '.r-ph .feed'), you = $(el, '.post.you'), scr = $(el, '.r-ph .scr'), tap = $(el, '.tap'), ok = $(el, '.r-ok'), st = $$(el, '.r-st li');
  return p => {
    const end = you.offsetTop + you.offsetHeight / 2 - scr.clientHeight / 2;
    feed.style.transform = `translateY(${(-end * ease(seg(p, .04, .45))).toFixed(1)}px)`;
    const tp = seg(p, .5, .62); tap.style.transform = `scale(${(tp > 0 && tp < 1 ? .4 + 1.2 * tp : 0).toFixed(2)})`; tap.style.opacity = 1 - tp;
    ok.style.transform = `translateY(${(101 * (1 - ease(seg(p, .64, .76)))).toFixed(1)}%)`;
    const s = p < .12 ? 0 : p < .48 ? 1 : p < .64 ? 2 : 3; st.forEach((e, i) => e.classList.toggle('on', i <= s));
  };
}

// ---------- HTML scenes ----------
function fan(el) {
  const cards = [...el.querySelectorAll('.fx')], stack = el.querySelector('.stackcard'), mq = matchMedia('(max-width:1140px)');
  document.documentElement.classList.add('fanon');
  return p => {
    if (mq.matches) { // stacked grid: each card back tips up into place as it arrives
      stack.style.opacity = 1;
      cards.forEach((c, i) => { const e = ease(seg(p, .02 + i * .07, .2 + i * .07)); c.querySelector('.b').style.transform = `perspective(900px) rotateX(${((1 - e) * 70).toFixed(1)}deg)`; });
      return;
    }
    cards.forEach(c => c.querySelector('.b').style.transform = '');
    const spread = .45 + .55 * ease(seg(p, 0, .1)); // starts part-fanned so the first glance is readable
    cards.forEach((c, i) => {
      const x = (i - 2.5) * 178 * spread - 84, s = .16 + i * .09, fl = ease(seg(p, s, s + .1));
      c.style.transform = `translate3d(${x.toFixed(1)}px,0,0) rotateZ(${((i - 2.5) * 5 * (1 - spread)).toFixed(2)}deg) rotateY(${(fl * 180).toFixed(1)}deg)`;
    });
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
  const rows = [...el.querySelectorAll('.row')], keep = el.querySelector('.yk');
  return p => {
    rows.forEach((r, i) => { const o = seg(p, .05 + i * .1, .16 + i * .1); r.style.opacity = o; r.style.transform = `translateX(${((1 - o) * -16).toFixed(1)}px)`; });
    const k = ease(seg(p, .55, .66)); keep.style.opacity = k; keep.style.transform = `scale(${(1.3 - .3 * k).toFixed(3)})`;
  };
}
// ---------- 12 the call: pick a time, upload 3 videos, 3 ads get made, the call shows them ----------
function flow(el) {
  const fp = $$(el, '.fp'), slots = $$(el, '.fg i'), ok = $(el, '.ok'), pbs = $$(el, '.pb i'), dns = $$(el, '.fl .dn'), ads = $$(el, '.fad'), sh = $$(el, '.share i'), keep = $(el, '.keep');
  [1, 4, 8, 12].forEach(i => slots[i].classList.add('x')); // taken slots
  return p => {
    const st = [0, .24, .48, .72].map(a => seg(p, a, a + .22));
    fp.forEach((e, i) => e.classList.toggle('on', st[i] > 0 && (i === 3 || st[i + 1] === 0)));
    slots[7].classList.toggle('on', st[0] > .5); show(ok, seg(st[0], .55, .9), .5);
    pbs.forEach((b, i) => { const u = ease(seg(st[1], i * .2, .5 + i * .2)); b.style.transform = `scaleX(${u.toFixed(3)})`; dns[i].style.transform = `scale(${u >= 1 ? 1 : 0})`; });
    ads.forEach((a, i) => { const u = ease(seg(st[2], i * .25, .4 + i * .25)); a.style.opacity = .22 + .78 * u; a.style.borderStyle = u > .5 ? 'solid' : 'dashed'; });
    sh.forEach((e, i) => e.style.transform = `scale(${ease(seg(st[3], .1 + i * .15, .4 + i * .15)).toFixed(3)})`);
    show(keep, seg(st[3], .75, 1), .5);
  };
}

// ---------- loop ----------
const HT = { hero, network, sweep, creds, proof, scale, sieve, race, fan, week, sheet, flow };
// still frame for reduced motion, per the storyboard: the payoff state of each scene
const STILL = { hero: .8 };
const list = [...document.querySelectorAll('[data-scene]')].map(el => ({ el, k: el.dataset.scene, f: HT[el.dataset.scene](el) }));

// hero clock: only advances while the hero is on screen and not paused
const pauseBtn = document.querySelector('.pause');
let heroPaused = RM, heroMs = 0, heroLast = null;
if (RM) pauseBtn.hidden = true;
pauseBtn.addEventListener('click', () => {
  heroPaused = !heroPaused; pauseBtn.setAttribute('aria-pressed', heroPaused); pauseBtn.textContent = heroPaused ? 'Play' : 'Pause';
});

const Q = new URLSearchParams(location.search), FREEZE = Q.get('p'), HERO_T = Q.get('t'); // frame-check hooks: ?p=0.5 freezes scroll scenes, ?t=0.5 the hero
// pin: each scroll scene holds still mid-screen while its animation plays, so the motion happens in full view
// (unpinned, a 16:9 stage finished animating while still sliding in from the bottom). Skipped for scenes taller than the screen.
const PIN = !RM && FREEZE === null;
if (PIN) for (const s of list) if (s.k !== 'hero') {
  const w = document.createElement('div'); w.className = 'pin'; s.el.before(w); w.appendChild(s.el); s.pin = w;
  w.style.marginTop = getComputedStyle(s.el).marginTop; s.el.style.marginTop = '0';
}
function pinSize() {
  for (const s of list) if (s.pin) {
    const h = s.el.offsetHeight, on = h < innerHeight * .9;
    s.pinOn = on; s.pinTop = Math.max(12, (innerHeight - h) / 2);
    s.pin.style.height = on ? h + innerHeight * 1.1 + 'px' : '';
    s.el.style.position = on ? 'sticky' : ''; s.el.style.top = on ? s.pinTop + 'px' : '';
  }
}
// scene labels never render under 11px (they are sized in em off a container-width base)
function textFloor() {
  const els = [...document.querySelectorAll('.stage.ui *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  els.forEach(e => e.style.fontSize = '');
  els.forEach(e => { if (parseFloat(getComputedStyle(e).fontSize) < 11) e.style.fontSize = '11px'; });
}
function sizeAll() { textFloor(); pinSize(); }
sizeAll(); addEventListener('resize', sizeAll); addEventListener('load', sizeAll);
addEventListener('resize', () => list.forEach(s => s.last = null)); // layouts change at the portrait switch: re-pose
function frame(now) {
  requestAnimationFrame(frame);
  const vh = innerHeight;
  for (const s of list) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width === 0) { if (s.k === 'hero') heroLast = null; continue; }
    let p;
    if (s.k === 'hero') {
      if (heroLast !== null && !heroPaused) heroMs += now - heroLast;
      heroLast = now; p = RM ? STILL.hero : HERO_T !== null ? +HERO_T : (heroMs % 8000) / 8000;
    } else if (RM || FREEZE !== null) p = RM ? (STILL[s.k] ?? 1) : +FREEZE;
    else if (s.pinOn) { const w = s.pin.getBoundingClientRect(); p = clamp((.9 * vh - w.top) / ((w.height - r.height) * .85 + .9 * vh - s.pinTop)); } // starts on entry; last 15% of the hold shows the end state
    else p = clamp((.85 * vh - r.top) / (.7 * vh));
    if (p !== s.last) { s.f(p); s.last = p; }
  }
}
requestAnimationFrame(frame);
