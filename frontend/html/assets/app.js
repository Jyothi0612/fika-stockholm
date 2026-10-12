// Fika frontend: one page, plain JavaScript. Every call goes to nginx at /api/<service>/...
const $ = (s) => document.querySelector(s);
const view = $('#view');
const EMOJI = { bun: '🥐', coffee: '☕', cake: '🍰', sweet: '🍫' };
const sek = (n) => `${n} kr`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok) throw Object.assign(new Error((body && body.message) || `HTTP ${res.status}`), { status: res.status, body });
  return body;
}
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = bad ? 'bad' : ''; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}

// the basket key: guest-N before login, the user's name after
const me = () => store.get('fika.user');
async function basketId() {
  const u = me(); if (u) return u.name;
  let id = store.get('fika.guest');
  if (!id) { id = (await api('user/uniqueid')).uuid; store.set('fika.guest', id); }
  return id;
}
async function refreshCount() {
  try { const b = await api(`basket/basket/${await basketId()}`); $('#count').textContent = b.items.reduce((n, i) => n + i.qty, 0); } catch (_) {}
  $('#who').textContent = me() ? me().name : 'Sign in';
}

// ---------- pages ----------
async function home() {
  view.innerHTML = `<section class="hero"><div><span class="tag">Stockholm · since 6 am</span>
    <h1>Fika, from the café round the corner.</h1>
    <p>Order kanelbullar, cakes and coffee from Stockholm cafés. Pick it up yourself, or let a bike bring it across the city.</p></div>
    <div class="hero-art">☕</div></section><h2>Cafés</h2><div class="grid" id="cafes"><p class="muted">Loading…</p></div>`;
  try {
    const cafes = await api('menu/cafes');
    $('#cafes').innerHTML = cafes.map((c) => `<a class="card" href="/cafe/${c.id}" data-link><span class="pill">${esc(c.district)}</span><h3>${esc(c.name)}</h3><span class="muted">${esc(c.about)}</span></a>`).join('');
  } catch (e) { $('#cafes').innerHTML = `<p class="muted">Could not load cafés: ${esc(e.message)}</p>`; }
}

async function cafe(id) {
  view.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const [c, items] = await Promise.all([api(`menu/cafes/${id}`), api(`menu/cafes/${id}/items`)]);
    view.innerHTML = `<p><a href="/" data-link class="muted">← All cafés</a></p><span class="pill">${esc(c.district)}</span><h1>${esc(c.name)}</h1><p class="muted">${esc(c.about)}</p>
      <div class="grid items">${items.map((i) => `<div class="card item"><div class="emoji">${EMOJI[i.category] || '🍽️'}</div>
      <div><h3>${esc(i.name)}</h3><span class="muted small">${esc(i.description)}</span><br><span class="small muted">${i.stock > 0 ? `${i.stock} left today` : 'sold out'}</span></div>
      <div style="text-align:right"><div class="price">${sek(i.price)}</div><button data-add="${i.sku}" ${i.stock > 0 ? '' : 'disabled'}>Add</button></div></div>`).join('')}</div>`;
  } catch (e) { view.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

let checkout = { mode: 'pickup', district: null };
let basketCafe = null, authTab = 'login', cafeNames = null;
async function basket() {
  const id = await basketId();
  let b, districts = [];
  try { b = await api(`basket/basket/${id}`); } catch (e) { view.innerHTML = `<p class="muted">Basket unavailable: ${esc(e.message)}</p>`; return; }
  if (!b.items.length) { view.innerHTML = `<h1>Your basket</h1><div class="panel">Empty, for now. <a href="/" data-link>Find a café →</a></div>`; return; }
  try { districts = await api('delivery/districts'); } catch (_) {}
  if (!cafeNames) { try { cafeNames = Object.fromEntries((await api('menu/cafes')).map((c) => [c.id, c.name])); } catch (_) { cafeNames = {}; } }
  const cafeId = b.items[0].cafe;
  view.innerHTML = `<h1>Your basket</h1><div class="two"><div class="panel"><table>
    <tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th></tr>
    ${b.items.map((i) => `<tr><td>${esc(i.name)}<br><span class="small muted">${esc(cafeNames[i.cafe] || i.cafe)}</span></td>
      <td class="r"><div class="row" style="justify-content:flex-end"><button class="ghost" data-qty="${i.sku}" data-n="${i.qty - 1}">−</button>${i.qty}<button class="ghost" data-qty="${i.sku}" data-n="${i.qty + 1}">+</button></div></td>
      <td class="r">${sek(i.price * i.qty)}</td></tr>`).join('')}
    </table></div>
    <div class="panel"><h3 style="margin-top:0">Pickup or bike delivery?</h3>
      <div class="seg"><button data-mode="pickup" aria-pressed="${checkout.mode === 'pickup'}">Pickup</button><button data-mode="delivery" aria-pressed="${checkout.mode === 'delivery'}">Bike delivery</button></div>
      <label>Your district</label><select id="district"><option value="">Choose a district</option>${districts.map((d) => `<option value="${d.id}" ${+checkout.district === d.id ? 'selected' : ''}>${esc(d.name)} (${d.postcode})</option>`).join('')}</select>
      <div id="quote" class="quote small" ${b.delivery ? '' : 'hidden'}>${b.delivery ? quoteText(b.delivery) : ''}</div>
      <p class="row" style="justify-content:space-between;margin-top:16px"><span>Subtotal</span><span>${sek(b.subtotal)}</span></p>
      <p class="row" style="justify-content:space-between"><span>Delivery</span><span>${b.delivery ? sek(b.delivery.fee) : '–'}</span></p>
      <p class="row total" style="justify-content:space-between"><span>Total</span><span>${sek(b.total)}</span></p>
      <button id="pay" style="width:100%" ${b.delivery ? '' : 'disabled'}>${me() ? `Pay ${sek(b.total)} (demo)` : 'Sign in to pay'}</button>
      <p class="small muted">Demo mobile pay: no real money moves.</p></div></div>`;
  basketCafe = cafeId;
}
const quoteText = (q) => q.mode === 'pickup' ? `Pickup at ${esc(q.cafe)}: ready in about ${q.minutes} min. Free.` : `Bike from ${esc(q.cafe)} to ${esc(q.district)}: ${q.km} km, about ${q.minutes} min, ${sek(q.fee)}.`;

async function confirmDelivery() {
  const district = $('#district').value; checkout.district = district;
  if (!district) return;
  try { await api(`delivery/confirm/${await basketId()}/${basketCafe}/${district}?mode=${checkout.mode}`, { method: 'POST' }); basket(); }
  catch (e) { toast(e.message, true); }
}

async function pay() {
  if (!me()) { go('/account?next=/basket'); return; }
  try {
    const r = await api(`payment/pay/${await basketId()}`, { method: 'POST', body: JSON.stringify({ user: me().name }) });
    checkout = { mode: 'pickup', district: null };
    go(`/done/${r.orderid}`);
  } catch (e) { toast(e.message, true); }
}

async function account() {
  const u = me();
  if (u) {
    let hist = [];
    try { hist = await api(`user/history/${u.name}`); } catch (_) {}
    view.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Hej, ${esc(u.name)}</h1><button class="ghost" id="logout">Sign out</button></div>
      <h2>Your orders</h2>${hist.length ? `<div class="panel"><table><tr><th>Order</th><th>Items</th><th>How</th><th class="r">Total</th></tr>${hist.map((o) => `<tr><td class="small">#${esc(o.orderid.slice(0, 8))}<br><span class="muted">${new Date(o.at).toLocaleString('sv-SE')}</span></td><td>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td><td class="small">${o.delivery.mode === 'pickup' ? 'Pickup' : `Bike to ${esc(o.delivery.district)}`}</td><td class="r">${sek(o.total)}</td></tr>`).join('')}</table></div>` : '<div class="panel muted">No orders yet.</div>'}`;
    return;
  }
  view.innerHTML = `<div class="two"><div><h1>Välkommen.</h1><p class="muted">Sign in to pay. Your basket comes with you: what you added as a guest moves to your account.</p></div>
    <div class="panel"><div class="seg"><button data-tab="login" aria-pressed="true">Sign in</button><button data-tab="register" aria-pressed="false">Create account</button></div>
    <form id="auth"><label>Name</label><input name="name" required autocomplete="username"><div id="emailrow" hidden><label>Email</label><input name="email" type="email"></div>
    <label>Password</label><input name="password" type="password" required minlength="6" autocomplete="current-password"><p><button style="width:100%">Continue</button></p></form></div></div>`;
  authTab = 'login';
}

async function auth(form) {
  const data = Object.fromEntries(new FormData(form)), reg = authTab === 'register';
  try {
    if (reg) await api('user/register', { method: 'POST', body: JSON.stringify(data) });
    const u = await api('user/login', { method: 'POST', body: JSON.stringify({ name: data.name, password: data.password }) });
    const guest = store.get('fika.guest');
    if (guest) { await api(`basket/rename/${guest}/${u.name}`, { method: 'POST' }).catch(() => {}); store.set('fika.guest', null); }
    store.set('fika.user', u);
    toast(reg ? 'Account created. Välkommen!' : `Hej ${u.name}!`);
    go(new URLSearchParams(location.search).get('next') || '/account');
  } catch (e) { toast(e.message, true); }
}

function done(id) {
  view.innerHTML = `<div class="panel" style="max-width:560px;margin:30px auto;text-align:center"><div style="font-size:56px">🥐☕</div><h1>Tack för din beställning!</h1>
    <p class="muted">Your order is with the kitchen now.</p><p class="small">Order <b>${esc(id)}</b></p><p class="row" style="justify-content:center"><a class="btn" href="/" data-link>Order more fika</a><a href="/account" data-link>Your orders</a></p></div>`;
}

const SERVICES = [['frontend', 'nginx', '/health', 'text'], ['menu', 'Node.js', '/api/menu/health'], ['user', 'Node.js', '/api/user/health'], ['basket', 'Python', '/api/basket/health'], ['delivery', 'Java', '/api/delivery/health'], ['payment', 'Python', '/api/payment/health']];
async function status() {
  view.innerHTML = `<div class="row" style="justify-content:space-between"><div><h1>System status</h1><p class="muted">Live health checks for every service, refreshed every 10 seconds. Stop a service and watch it go red. The kitchen has no port, so check it with <code>journalctl -u kitchen</code>.</p></div><b id="sum"></b></div><div class="status" id="st"></div>`;
  const draw = async () => {
    if (location.pathname !== '/status') return;
    const res = await Promise.all(SERVICES.map(async ([n, lang, url, kind]) => {
      const t0 = performance.now();
      try { const r = await fetch(url); const body = kind === 'text' ? await r.text() : JSON.stringify(await r.json(), null, 1); return { n, lang, url, ok: r.ok, code: r.status, ms: Math.round(performance.now() - t0), body }; }
      catch (e) { return { n, lang, url, ok: false, code: 0, ms: 0, body: e.message }; }
    }));
    $('#sum').textContent = `${res.filter((r) => r.ok).length}/${res.length} healthy`;
    $('#st').innerHTML = res.map((r) => `<div class="panel"><div class="row" style="justify-content:space-between"><b><span class="dot ${r.ok ? 'ok' : 'bad'}"></span> ${r.n}</b><span class="small muted">${r.lang}</span></div><div class="small muted">GET ${r.url} · ${r.code} · ${r.ms} ms</div><pre>${esc(r.body)}</pre></div>`).join('');
    setTimeout(draw, 10000);
  };
  draw();
}

// ---------- router + events ----------
function go(path) { history.pushState(null, '', path); route(); }
function route() {
  const p = location.pathname;
  if (p.startsWith('/cafe/')) cafe(p.split('/')[2]);
  else if (p === '/basket') basket();
  else if (p === '/account') account();
  else if (p.startsWith('/done/')) done(p.split('/')[2]);
  else if (p === '/status') status();
  else home();
  refreshCount(); scrollTo(0, 0);
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('a[data-link], a[href="/status"]');
  if (a && a.origin === location.origin) { e.preventDefault(); go(a.pathname); return; }
  const add = e.target.closest('button[data-add]');
  if (add) { try { await api(`basket/add/${await basketId()}/${add.dataset.add}/1`, { method: 'POST' }); toast('Added to your basket'); refreshCount(); } catch (err) { toast(err.message, true); } return; }
  const q = e.target.closest('button[data-qty]');
  if (q) { await api(`basket/update/${await basketId()}/${q.dataset.qty}/${Math.max(0, +q.dataset.n)}`, { method: 'POST' }); basket(); refreshCount(); return; }
  const m = e.target.closest('button[data-mode]');
  if (m) { checkout.mode = m.dataset.mode; document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b === m)); confirmDelivery(); return; }
  const t = e.target.closest('button[data-tab]');
  if (t) { authTab = t.dataset.tab; document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b === t)); $('#emailrow').hidden = t.dataset.tab !== 'register'; return; }
  if (e.target.closest('#pay')) pay();
  if (e.target.closest('#logout')) { store.set('fika.user', null); go('/'); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'district') confirmDelivery(); });
document.addEventListener('submit', (e) => { if (e.target.id === 'auth') { e.preventDefault(); auth(e.target); } });
window.addEventListener('popstate', route);
route();
