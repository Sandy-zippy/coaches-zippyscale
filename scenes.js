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
// motion grammar (prompt-motion skill): closed-form springs with a small overshoot, a cursor that makes the real clicks,
// blur that follows speed, text that swaps through a short blur. Every value is a pure function of p.
const spr = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-7 * x) * Math.cos(7 * x); // about 4% overshoot, settles by x = 1
const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// swap text through a blur: old text blurs out over the first half of the window, new text sharpens in over the second
const swap = (e, p, at, a, b, w = .04) => { const u = seg(p, at - w / 2, at + w / 2); txt(e, u < .5 ? a : b); const k = 1 - Math.abs(u - .5) * 2; e.style.filter = k > .01 ? `blur(${(k * 4).toFixed(1)}px)` : ''; e.style.opacity = 1 - k * .6; };
// cursor: keys = [[p, element], ...]. It fades in just below-right of its first target and fades out on its last,
// so it never glides in from outside the box (rejected in review, 16 Oct); between targets it eases, dips and rings on each click
function cursor(stage) {
  const c = document.createElement('div'); c.className = 'cur'; c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<i class="ring"></i><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z"/></svg>';
  stage.appendChild(c);
  const pos = e => { const a = stage.getBoundingClientRect(), b = e.getBoundingClientRect(); return [b.left - a.left + b.width * .6, b.top - a.top + b.height * .62]; };
  return (p, keys, clicks = []) => {
    let x, y, o = 1, i = keys.findIndex(k => p < k[0]);
    if (i === 0) { const [tx, ty] = pos(keys[0][1]), a = keys[0][0], u = ease(seg(p, a - .08, a)); x = tx + 36 * (1 - u); y = ty + 28 * (1 - u); o = seg(p, a - .08, a - .05); }
    else if (i === -1) { const L = keys.at(-1); [x, y] = pos(L[1]); o = 1 - seg(p, L[0] + .05, L[0] + .09); }
    else { const [ax, ay] = pos(keys[i - 1][1]), [bx, by] = pos(keys[i][1]), u = io(seg(p, keys[i - 1][0] + .035, keys[i][0])); /* hold through the click */ x = lerp(ax, bx, u); y = lerp(ay, by, u); }
    x = clamp(x, 0, stage.clientWidth - 24); y = clamp(y, 0, stage.clientHeight - 24);
    const ck = clicks.map(t => seg(p, t, t + .03)).find(u => u > 0 && u < 1) ?? 0;
    c.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(1 - .18 * Math.sin(Math.PI * Math.min(1, ck * 2))).toFixed(3)})`;
    const ring = c.firstChild; ring.style.opacity = ck ? (1 - ck).toFixed(2) : 0; ring.style.transform = `scale(${(.4 + ck * 1.4).toFixed(2)})`;
    c.style.opacity = o.toFixed(2);
  };
}

// ---------- 1 hero: your phone shoot becomes 3 ads, the test pauses 2, the winner books a call (time loop) ----------
function hero(el) {
  const tm = $(el, '.tm'), wav = $$(el, '.wav i'), ads = $$(el, '.ad'), arw = $$(el, '.arw'), slots = $$(el, '.gr i'), toast = $(el, '.toast'), W = 1;
  const spend = [.6, 1, .45];
  slots.forEach((s, i) => s.classList.toggle('on', i === 0 || i === 6)); // calls already booked this week
  const mouse = cursor(el);
  return t => {
    // never a blank frame and no fade: last week's ads wait greyed while the shoot records, this week's cuts spring in over them,
    // and at the end of the loop every decided state eases back to grey, so the wrap from t = 1 to t = 0 is seamless
    const rec = seg(t, .02, .26), back = seg(t, .9, .98), on = 1 - back;
    txt(tm, String(Math.round(20 * rec)).padStart(2, '0') + ':00');
    wav.forEach((w, i) => w.style.transform = `scaleY(${(rec > 0 && rec < 1 ? .3 + .7 * Math.abs(Math.sin(t * 90 + i * 1.7)) : .25).toFixed(2)})`);
    arw[0].style.setProperty('--k', ease(seg(t, .24, .3)) * on);
    const dec = t > .545 && back < .5;
    ads.forEach((a, i) => {
      const u = seg(t, .26 + i * .03, .34 + i * .03), sp = spr(u), nw = Math.min(1, u * 3) * on; // nw: 0 = last week's ad (grey), 1 = this week's cut
      a.style.opacity = (.45 + .55 * nw).toFixed(2);
      a.style.filter = `grayscale(${(dec && i !== W ? 1 : 1 - nw).toFixed(2)})` + (u > 0 && u < .3 ? ` blur(${((.3 - u) * 8).toFixed(1)}px)` : '');
      a.classList.toggle('fresh', u > 0 && u < 1);
      a.style.transform = u > 0 && u < 1 ? `translateY(${((1 - sp) * 1.4).toFixed(2)}em)` : (i === W && dec ? `scale(${(1 + .06 * (1 - spr(seg(t, .55, .63)))).toFixed(3)})` : '');
      const s = (i === W ? ease(seg(t, .34, .5)) * .55 + ease(seg(t, .56, .66)) * .45 : ease(seg(t, .34, .5)) * spend[i] * .55) * on;
      a.querySelector('.sp i').style.transform = `scaleX(${s.toFixed(3)})`;
      a.classList.toggle('off', dec && i !== W); a.classList.toggle('win', dec && i === W);
      const st = a.querySelector('.st'); txt(st, i === W ? 'Winner' : 'Paused'); st.style.opacity = dec ? 1 : 0;
    });
    arw[1].style.setProperty('--k', ease(seg(t, .58, .62)) * on);
    const k = ease(seg(t, .62, .67)), ts = spr(seg(t, .62, .7));
    toast.style.opacity = (Math.min(1, ts * 2) * on).toFixed(2); toast.style.transform = `translateY(${((1 - ts) * 1.2).toFixed(2)}em) scale(${(.9 + .1 * ts).toFixed(3)})`;
    slots[3].classList.toggle('on', k > .5 && back < .5);
    mouse(t, [[.54, ads[W]], [.62, slots[3]]], [.54]);
  };
}

// ---------- 2 problem: referrals arrive in month 1, stop, and the calendar empties by month 3 ----------
function network(el) {
  const msgs = $$(el, '.msg'), quiet = $(el, '.quiet'), bd = $(el, '.bd'), tabs = $$(el, '.tabs b'), cells = $$(el, '.mc i'), cc = $(el, '.cc b'), ccl = $(el, '.cc span');
  const plan = [[0, 1, 3, 4, 6, 7, 8, 10, 11, 13, 15, 16, 18], [2, 8, 12, 17, 19], [11]]; // booked slots per month
  const bar = $(el, '.tabs'), ind = document.createElement('i'); ind.className = 'ind'; bar.prepend(ind);
  const mouse = cursor(el), T = [.36, .68];
  return p => {
    // indicator edges: leading edge springs first, trailing edge follows, so it stretches as it travels
    tabs.forEach(b => { b.L = b.offsetLeft; b.R = b.offsetLeft + b.offsetWidth; });
    const edge = (side, d) => T.reduce((v, t, i) => v + (tabs[i + 1][side] - tabs[i][side]) * spr(seg(p, t + d, t + d + .08)), tabs[0][side]);
    const l = edge('L', .025), r = edge('R', 0); ind.style.transform = `translateX(${l.toFixed(1)}px)`; ind.style.width = (r - l).toFixed(1) + 'px';
    mouse(p, [[T[0], tabs[1]], [T[1], tabs[2]]], T);
    // month 1 fills as the referrals arrive; months 2 and 3 land right after their tab is clicked
    const m = p < T[0] + .02 ? 0 : p < T[1] + .02 ? 1 : 2, s0 = [.02, T[0] + .02, T[1] + .02][m], win = m ? .06 : .18, len = plan[m].length;
    const n = Math.round(len * ease(seg(p, s0, s0 + win + .02)));
    tabs.forEach((b, i) => b.classList.toggle('on', i === m));
    const on = new Set(plan[m].slice(0, n)); cells.forEach((c, i) => { c.classList.toggle('on', on.has(i)); const j = plan[m].indexOf(i), u = j < 0 ? 1 : seg(p, s0 + j / len * win, s0 + .04 + j / len * win); c.style.transform = on.has(i) && u < 1 ? `scale(${(.6 + .4 * spr(u)).toFixed(3)})` : ''; }); // only a booked cell springs: empty cells stay full size, so the grid never shows the plan early
    // the count is the month's total: it counts up while month 1 fills, then switches straight to 5 and 1 (never back through 0)
    const total = m ? len : n; txt(cc, String(total)); txt(ccl, total === 1 ? 'call booked' : 'calls booked');
    // referrals arrive in month 1; from month 2 the inbox is empty
    const out = 1 - seg(p, T[0] + .02, T[0] + .08);
    msgs.forEach((e, i) => show(e, seg(p, .03 + i * .07, .08 + i * .07) * out, 0));
    txt(bd, m ? '0' : String(msgs.filter((e, i) => e.offsetParent && p > .06 + i * .07).length));
    show(quiet, seg(p, T[0] + .06, T[0] + .12));
  };
}

// ---------- 4 the loop: clips become 6 ads, the week's test switches 4 off, the 2 winners get the budget and book calls ----------
function sweep(el) {
  const rows = $$(el, '.srow'), wl = $(el, '.wl'), ft = $(el, '.s-ft'), win = [1, 4], base = [.5, .8, .6, .4, .75, .3];
  const mouse = cursor(el), loser = [0, 2, 3, 5], CK = [.44, .5, .56, .62], tg = rows.map(r => r.querySelector('.tgl'));
  return p => {
    const dec = p > .68;
    swap(wl, p, .68, 'Week 1: testing 6 new ads', 'Week 2: budget on the winners');
    mouse(p, loser.map((r, i) => [CK[i], tg[r]]), CK);
    rows.forEach((r, i) => {
      // every row is there from the first frame (never an empty table while the panel arrives); the test starts as spend fills in
      const w = win.includes(i), s = ease(seg(p, .04 + i * .03, .3 + i * .03)) * base[i] * .6 + (w ? spr(seg(p, .7, .84)) * (1 - base[i] * .6) : 0);
      r.querySelector('.bar i').style.transform = `scaleX(${s.toFixed(3)})`;
      const li = loser.indexOf(i); r.classList.toggle('off', li >= 0 && p > CK[li] + .012); r.classList.toggle('win', dec && w);
      { const b = r.querySelector('.badge'), k = w ? spr(seg(p, .7, .78)) : 0; b.style.opacity = Math.min(1, k * 2); r.classList.toggle('bdg', k > .4); b.style.transform = `scale(${(.7 + .3 * k).toFixed(3)})`; }
      txt(r.querySelector('.dots'), w && seg(p, .76, .9) > 0 ? '3 calls' : '');
    });
    show(ft, seg(p, .82, .9), .8);
  };
}

// ---------- 6 record: the client's real booking sheet flips through its month tabs, Aug 2024 to Oct 2026 ----------
function ledger(el) {
  const box = $(el, '.gs-tabs'), strip = $(el, '.gs-strip'), tabs = $$(el, '.gs-strip span'), cells = $$(el, 'tbody td i');
  const base = cells.map(c => parseFloat(c.style.width)), end = Math.max(0, tabs.findIndex(t => t.classList.contains('on')));
  let shown = -1;
  return p => {
    const a = Math.round(ease(seg(p, .04, .8)) * end), t = tabs[a], W = box.clientWidth - 12, S = strip.scrollWidth;
    strip.style.transform = `translateX(${clamp(W / 2 - t.offsetLeft - t.offsetWidth / 2, Math.min(0, W - S), 0).toFixed(1)}px)`; // keep the open tab in view
    if (a === shown) return; shown = a;
    tabs.forEach((e, i) => e.classList.toggle('on', i === a));
    // each tab is another month: the hidden entries change length (a fixed function of the tab, so every frame repeats)
    cells.forEach((c, j) => c.style.width = (base[j] * (a === end ? 1 : .72 + .28 * Math.abs(Math.sin(a * 12.9898 + j * 78.233)))).toFixed(2) + 'em');
  };
}

// ---------- 7 proof: the client's own booking sheet, month by month; cost per call ticks from $250 to $70 ----------
const MONTHS = [21, 31, 45, 40, 33, 57, 51, 12, 34, 17, 22, 34, 28, 21, 26, 13, 7, 38, 9, 16, 23, 8, 6, 29, 11, 11, 24]; // first calls per month, Aug 2024 to Oct 2026
function proof(el) {
  const bars = $$(el, '.bars i');
  bars.forEach((b, i) => b.style.setProperty('--h', (MONTHS[i] / 60 * 90).toFixed(2) + '%')); // 60 sits on the top gridline (90%)
  // faint full-height bars sit behind, so the chart never opens as an empty grid: scrolling fills each month in
  const gh = bars[0].parentNode.cloneNode(true); gh.classList.add('gh'); gh.setAttribute('aria-hidden', 'true'); bars[0].parentNode.before(gh);
  return p => {
    let last = -1;
    bars.forEach((b, i) => { const u = spr(seg(p, .02 + i * .026, .1 + i * .026)); b.style.transform = `scaleY(${u.toFixed(3)})`; if (u > .5) last = i; });
    bars.forEach((b, i) => b.classList.toggle('pen', i === last && p < .8));
  };
}

// ---------- 9 guarantee: held calls fill 25 slots on a 90-day tracker ----------
function scale(el) {
  const cells = $$(el, '.g25 i'), num = $(el, '.num'), day = $(el, '.dnum'), fill = $(el, '.fill'), hit = $(el, '.hit');
  return p => {
    const k = seg(p, .06, .8), n = Math.round(25 * k), d = Math.round(lerp(1, 76, k)); // example pace, even: 25 by about day 76
    cells.forEach((c, i) => { c.classList.toggle('on', i < n); const at = .06 + .74 * (i + .5) / 25, u = seg(p, at, at + .05); c.style.transform = u > 0 && u < 1 ? `scale(${(.5 + .5 * spr(u)).toFixed(3)})` : ''; });
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
      // all five applicants are there from the first frame; each is judged in turn and the misfits drop through the filter
      const ok = c.dataset.ok === '1', j = seg(p, .06 + i * .13, .14 + i * .13);
      const fj = ok ? 0 : j * j, land = ok ? 0 : seg(j, .85, 1), sq = Math.sin(Math.PI * land) * .08;
      c.style.transform = pt ? '' : `translateY(${(fj * 11.4).toFixed(2)}em) rotate(${(fj * (i % 2 ? 4 : -4)).toFixed(1)}deg) scale(${(1 + sq).toFixed(3)},${(1 - sq).toFixed(3)})`;
      c.style.filter = !pt && !ok && j > .2 && j < .9 ? `blur(${(j * 3).toFixed(1)}px)` : '';
      if (ok && j > 0 && j < 1) c.style.transform += ` scale(${(1 + .08 * Math.sin(Math.PI * j)).toFixed(3)})`;
      c.classList.toggle('is-ok', ok && j > .5); c.classList.toggle('is-no', !ok && j > .5); // not 'ok': a page-wide .ok rule sets opacity 0
      c.querySelector('.stamp').style.opacity = seg(j, .5, 1);
    });
  };
}

// ---------- 13 P.S.: your next client scrolls, taps your ad, passes the qualifier, the call is booked ----------
function race(el) {
  const feed = $(el, '.r-ph .feed'), you = $(el, '.post.you'), scr = $(el, '.r-ph .scr'), tap = $(el, '.tap'), ok = $(el, '.r-ok'), st = $$(el, '.r-st li');
  return p => {
    const end = you.offsetTop + you.offsetHeight / 2 - scr.clientHeight / 2;
    const sv = seg(p, .04, .45); feed.style.transform = `translateY(${(-end * io(sv)).toFixed(1)}px)`; feed.style.filter = sv > .15 && sv < .85 ? `blur(${(Math.sin(Math.PI * sv) * 2).toFixed(1)}px)` : '';
    const zz = Math.sin(Math.PI * seg(p, .4, .7)) * .08; scr.style.transform = `scale(${(1 + zz).toFixed(3)})`;
    const tp = seg(p, .5, .62); tap.style.transform = `scale(${(tp > 0 && tp < 1 ? .4 + 1.2 * tp : 0).toFixed(2)})`; tap.style.opacity = 1 - tp;
    ok.style.transform = `translateY(${(101 * (1 - ease(seg(p, .64, .76)))).toFixed(1)}%)`;
    const s = p < .12 ? 0 : p < .48 ? 1 : p < .64 ? 2 : 3; st.forEach((e, i) => { e.classList.toggle('on', i <= s); e.classList.toggle('is-cur', i === s); });
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
  // the 3 ads are on the card from the first frame as raw grey cuts; each one's edit bar fills, it takes its colour and its tag turns lime
  const ads = $$(el, '.row.ad3');
  return p => ads.forEach((r, i) => {
    const u = seg(p, .06 + i * .26, .3 + i * .26);
    r.querySelector('.pg b').style.transform = `scaleX(${ease(u).toFixed(3)})`;
    r.querySelector('img').style.filter = u >= 1 ? '' : `grayscale(${(1 - seg(u, .7, 1)).toFixed(2)})`;
    r.classList.toggle('done', u >= 1);
  });
}
// ---------- 12 the call: pick a time, upload 3 videos, 3 ads get made, the call shows them ----------
function flow(el) {
  const fp = $$(el, '.fp'), slots = $$(el, '.fg i'), ok = $(el, '.ok'), pbs = $$(el, '.pb i'), dns = $$(el, '.fl .dn'), ads = $$(el, '.fad'), sh = $$(el, '.share i'), keep = $(el, '.keep');
  [1, 4, 8, 12].forEach(i => slots[i].classList.add('x')); // taken slots
  const mouse = cursor(el), up = $(el, '.f-up') || fp[1];
  return p => {
    mouse(p, [[.1, slots[7]], [.55, ads[1]], [.8, sh[1] || fp[3]]], [.1]);
    const st = [0, .24, .48, .72].map(a => seg(p, a, a + .22));
    fp.forEach((e, i) => e.classList.toggle('on', st[i] > 0 && (i === 3 || st[i + 1] === 0)));
    slots[7].classList.toggle('on', st[0] > .5); show(ok, seg(st[0], .55, .9), .5);
    pbs.forEach((b, i) => { const u = ease(seg(st[1], i * .2, .5 + i * .2)); b.style.transform = `scaleX(${u.toFixed(3)})`; dns[i].style.transform = `scale(${u >= 1 ? 1 : 0})`; });
    ads.forEach((a, i) => { const u = seg(st[2], i * .25, .45 + i * .25); a.style.opacity = .22 + .78 * Math.min(1, u * 2); a.style.borderStyle = u > .5 ? 'solid' : 'dashed'; a.style.transform = u > 0 && u < 1 ? `translateY(${((1 - spr(u)) * .8).toFixed(2)}em)` : ''; });
    sh.forEach((e, i) => e.style.transform = `scale(${spr(seg(st[3], .1 + i * .15, .45 + i * .15)).toFixed(3)})`);
    show(keep, seg(st[3], .75, 1), .5);
  };
}

// ---------- 11 free ad: your links tick in, one ad is cut from them, it lands in your inbox ----------
// not pinned (data-nopin): it plays in place on the way to the form and is finished by the time the form is mid-screen
function mail(el) {
  const rows = $$(el, '.fl'), arw = $$(el, '.m-arw'), th = $(el, '.m-ad .th'), pb = $(el, '.m-ad .pb i'), st = $(el, '.m-st'),
    row = $(el, '.mrow'), slot = $(el, '.m-slot'), n = $(el, '.m-n'), nw = $(el, '.m-new'), att = $(el, '.m-att i');
  return p => {
    rows.forEach((r, i) => {
      const u = seg(p, .02 + i * .09, .11 + i * .09);
      r.querySelector('.pb i').style.transform = `scaleX(${ease(u).toFixed(3)})`;
      r.querySelector('.dn').style.transform = `scale(${spr(seg(u, .75, 1)).toFixed(3)})`;
    });
    const c = seg(p, .32, .5), g = c >= 1 ? '' : `grayscale(${(1 - seg(c, .5, 1)).toFixed(2)})`;
    arw[0].classList.toggle('on', p > .3); pb.style.transform = `scaleX(${ease(c).toFixed(3)})`; th.style.filter = g; att.style.filter = g;
    swap(st, p, .5, 'Cutting', 'Ready'); st.classList.toggle('on', c >= 1);
    const m = seg(p, .52, .64), k = spr(m), o = Math.min(1, m * 3);
    arw[1].classList.toggle('on', p > .52);
    row.style.opacity = o.toFixed(2); row.style.transform = `translateY(${((1 - k) * 1.2).toFixed(2)}em)`; slot.style.opacity = (1 - o).toFixed(2); slot.style.visibility = o >= 1 ? 'hidden' : '';
    txt(n, m > .3 ? '1' : '0'); n.classList.toggle('on', m > .3);
    nw.style.transform = `scale(${spr(seg(p, .62, .72)).toFixed(3)})`;
  };
}

// ---------- loop ----------
const HT = { hero, network, sweep, ledger, proof, scale, sieve, race, fan, week, sheet, flow, mail };
// still frame for reduced motion, per the storyboard: the payoff state of each scene
const STILL = { hero: .8 };
const list = [...document.querySelectorAll('[data-scene]')].map(el => ({ el, k: el.dataset.scene, f: HT[el.dataset.scene](el) }));

// hero clock: only advances while the hero is on screen and not paused
const pauseBtn = document.querySelector('.pause');
let heroPaused = RM, heroMs = 3360, heroLast = null; // first frame (t = .42) already shows the 5 new ads, never a near-empty card
if (RM) pauseBtn.hidden = true;
pauseBtn.addEventListener('click', () => {
  heroPaused = !heroPaused; pauseBtn.textContent = heroPaused ? 'Play' : 'Pause';
});

const Q = new URLSearchParams(location.search), FREEZE = Q.get('p'), HERO_T = Q.get('t'); // frame-check hooks: ?p=0.5 freezes scroll scenes, ?t=0.5 the hero
// pin: each scroll scene holds still mid-screen together with its heading, so the reader always knows what it shows.
// p runs 0..1 over the first 85% of the hold and stays 0 while the panel slides in (rejected in review, 16 Oct: motion played
// before the panel arrived). The hold is short (0.7 of a screen, 0.55 on phones) so the page never feels stuck.
const PIN = !RM && FREEZE === null;
if (PIN) for (const s of list) if (s.k !== 'hero' && !s.el.hasAttribute('data-nopin')) {
  const head = []; for (let e = s.el.previousElementSibling; e && head.length < 3 && e.matches('h2, .label, .lede, .guar'); e = e.previousElementSibling) head.unshift(e);
  const first = head[0] || s.el, w = document.createElement('div'), box = document.createElement('div');
  w.className = 'pin'; box.className = 'pinbox'; first.before(w); w.appendChild(box); box.append(...head, s.el); s.pin = w; s.box = box; s.head = head; s.mt = [...head, s.el].map(e => e.style.marginTop); // inline margins to restore
}
function pinSize() {
  // phones: the sticky book bar (52px, 12px off the bottom) owns the bottom strip, so a pinned scene centres in the space above it
  const vh = innerHeight, ph = innerWidth < 641, hold = vh * (ph ? .55 : .7), room = vh - (ph ? 76 : 0);
  for (const s of list) if (s.pin) {
    // the heading group rides along only while heading + scene fit; if it would sit cut off at the top it stays in the page and scrolls away
    [...s.head, s.el].forEach((e, i) => e.style.marginTop = s.mt[i]); s.box.prepend(...s.head);
    if (s.head.length && s.box.offsetHeight > room - 24) s.pin.before(...s.head);
    const first = s.box.firstElementChild; s.pin.style.marginTop = getComputedStyle(first).marginTop; first.style.marginTop = '0'; // the gap above moves to the wrapper
    const hb = s.box.offsetHeight, on = s.el.offsetHeight < room * .9;
    s.pinOn = on; s.hold = hold;
    s.pinTop = hb <= room - 24 ? (room - hb) / 2 : room - hb - 12; // scene alone too tall: it sits on the bottom edge, fully in view
    s.pin.style.height = on ? hb + hold + 'px' : '';
    s.box.style.position = on ? 'sticky' : ''; s.box.style.top = on ? s.pinTop + 'px' : '';
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
    else if (s.pinOn) p = clamp((s.pinTop - s.pin.getBoundingClientRect().top) / (s.hold * .85)); // 0 until the box is pinned; last 15% of the hold shows the end state
    else p = clamp((.85 * vh - r.top) / (.7 * vh));
    if (p !== s.last) { s.f(p); s.last = p; }
  }
}
requestAnimationFrame(frame);
