const KEY = 'ricemill_v1';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n).toLocaleString();
const pad = n => 'TX-' + String(n).padStart(6, '0');
function nowParts() { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString(); return [d.slice(0, 10), d.slice(11, 16)]; }

function seed() {
  const [t] = nowParts(), y = addDay(t, -1);
  const owners = [['C001', 'John Kamau', '0712000001'], ['C002', 'Mary Wanjiku', '0712000002'], ['C003', 'Peter Otieno', '0712000003']]
    .map(([id, name, phone]) => ({ id, name, phone, loc: '', notes: '' }));
  const ledger = [['opening', 'C001', 100, y, '06:00'], ['opening', 'C002', 80, y, '06:00'], ['opening', 'C003', 60, y, '06:00'],
    ['received', 'C001', 50, t, '08:30'], ['to_milling', 'C001', 30, t, '09:15'], ['to_drying', 'C001', 20, t, '11:20'],
    ['from_drying', 'C001', 18, t, '14:10'], ['dispatched', 'C001', 10, t, '16:30'],
    ['received', 'C002', 40, t, '08:45'], ['to_milling', 'C002', 20, t, '09:30'], ['dispatched', 'C002', 15, t, '15:00'],
    ['received', 'C003', 30, t, '10:00'], ['to_drying', 'C003', 12, t, '11:00']]
    .map(([type, ownerId, bags, d, h], i) => ({ n: i + 1, id: pad(i + 1), type, ownerId, bags, kg: 50, ts: d + 'T' + h, party: '', vehicle: '', ref: '', staff: 'Sample', notes: '' }));
  return { factory: 'Sample Rice Mill', staff: '', owners, ledger, audit: [], n: ledger.length };
}
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.ledger) return d; } catch (e) {} return seed(); }
let db = load(), view = 'dash', sel = null, hq = '', ht = '', sf = '', st = '';
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const log = a => db.audit.push({ t: new Date().toLocaleString(), u: db.staff || 'Staff', a });
const oname = id => (db.owners.find(o => o.id === id) || {}).name || id;
const lbl = t => TYPES[t].label;

const TABS = [['dash', 'Home'], ['add', 'Record'], ['owners', 'Owners'], ['hist', 'History'], ['rep', 'Reports'], ['count', 'Count'], ['more', 'More']];
function go(v, s) { view = v; sel = s || null; render(); scrollTo(0, 0); }
function render() {
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button class="${k === view ? 'on' : ''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#app').innerHTML = { dash, add: addV, owners, hist, rep, count, more }[view]();
}
const card = (l, v, c = '') => `<div class="card ${c}"><small>${l}</small><b>${fmt(v)}</b><span>bags</span></div>`;

function dash() {
  const [today] = nowParts(), t = totals(balances(db.ledger)), m = report(db.ledger, today, today).m;
  const rows = active(db.ledger).slice(-8).reverse().map(e => `<tr><td>${e.ts.slice(5, 10)} ${e.ts.slice(11)}</td><td>${lbl(e.type)}</td><td>${esc(oname(e.ownerId))}</td><td>${fmt(e.bags)}</td></tr>`).join('');
  return `<h2>${esc(db.factory)}</h2>${card('CURRENT STORE STOCK', t.store, 'big')}
  <div class="grid">${card('Milling / processing', t.milling)}${card('Drying', t.drying)}${card('Received today', m.received || 0)}${card('Dispatched today', m.dispatched || 0)}</div>
  <p class="note">Factory totals are calculated from all owner accounts. They cannot be typed in.</p>
  <h3>Recent transactions</h3><div class="scroll"><table><tr><th>When</th><th>Type</th><th>Owner</th><th>Bags</th></tr>${rows}</table></div>`;
}

function addV() {
  const [d, h] = nowParts();
  return `<h2>Record transaction</h2><form onsubmit="event.preventDefault();submit(this)">
  <label>Date<input name="date" type="date" value="${d}" required></label>
  <label>Time<input name="time" type="time" value="${h}" required></label>
  <label>Transaction type<select name="type">${Object.keys(TYPES).map(k => `<option value="${k}">${lbl(k)}</option>`).join('')}</select></label>
  <label>Owner / customer<select name="owner"><option value="">Select owner</option>${db.owners.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
  <label>Number of bags (adjustment: use - for loss)<input name="bags" type="number" step="1" required></label>
  <label>Bag size (kg)<input name="kg" type="number" list="sizes" value="50"><datalist id="sizes"><option>25</option><option>50</option><option>90</option></datalist></label>
  <label>Supplier / customer / person<input name="party"></label>
  <label>Vehicle number (optional)<input name="vehicle"></label>
  <label>Reference number<input name="ref"></label>
  <label>Staff / operator<input name="staff" value="${esc(db.staff)}"></label>
  <label>Notes (reason is required for adjustments)<input name="notes"></label>
  <button class="pri">Save transaction</button></form>`;
}
function submit(f) {
  const g = k => f[k].value.trim();
  const e = { type: g('type'), ownerId: g('owner'), bags: parseInt(g('bags'), 10), kg: +g('kg') || 0, ts: g('date') + 'T' + g('time'), party: g('party'), vehicle: g('vehicle'), ref: g('ref'), staff: g('staff'), notes: g('notes') };
  if (!e.ownerId) return alert('Select an owner. Every movement must belong to an owner.');
  if (!e.bags || (e.type !== 'adjustment' && e.bags < 0)) return alert('Enter a valid number of bags.');
  if (e.type === 'adjustment' && !e.notes) return alert('Enter a reason in Notes for an adjustment.');
  e.n = db.n + 1; e.id = pad(e.n);
  const r = check(db.ledger.concat(e));
  if (!r.ok) { const av = (balances(db.ledger)[r.e.ownerId] || {})[r.loc] || 0; return alert(`Insufficient ${r.loc} stock for ${oname(r.e.ownerId)}. Available: ${fmt(av)} bags.`); }
  db.n = e.n; db.ledger.push(e); db.staff = e.staff || db.staff; log('Created ' + e.id + ' ' + lbl(e.type) + ' ' + e.bags);
  save(); alert('Saved ' + e.id); go('dash');
}

function owners() {
  if (sel) return stmt(sel);
  const b = balances(db.ledger), t = totals(b);
  const rows = db.owners.map(o => { const x = b[o.id] || { store: 0, milling: 0, drying: 0 }; return `<tr><td><a href="#" onclick="go('owners','${o.id}');return false">${esc(o.name)}</a></td><td>${fmt(x.store)}</td><td>${fmt(x.milling)}</td><td>${fmt(x.drying)}</td><td>${fmt(x.store + x.milling + x.drying)}</td></tr>`; }).join('');
  return `<h2>Owners / customers</h2><div class="scroll"><table><tr><th>Owner</th><th>Store</th><th>Milling</th><th>Drying</th><th>Total</th></tr>${rows}
  <tr class="tot"><td>TOTAL</td><td>${fmt(t.store)}</td><td>${fmt(t.milling)}</td><td>${fmt(t.drying)}</td><td>${fmt(t.store + t.milling + t.drying)}</td></tr></table></div>
  <h3>Add owner</h3><form onsubmit="event.preventDefault();addOwner(this)"><label>Name<input name="name" required></label><label>Phone<input name="phone"></label><label>Location<input name="loc"></label><label>Notes<input name="notes"></label><button class="pri">Add owner</button></form>`;
}
function addOwner(f) {
  const o = { id: 'C' + String(db.owners.length + 1).padStart(3, '0'), name: f.name.value.trim(), phone: f.phone.value, loc: f.loc.value, notes: f.notes.value };
  db.owners.push(o); log('Added owner ' + o.name); save(); render();
}
function stmt(id) {
  const o = db.owners.find(x => x.id === id), l = db.ledger.filter(e => e.ownerId === id);
  const r = report(l, sf, st || '9999-12-31'), rows = active(l).filter(e => (!sf || e.ts.slice(0, 10) >= sf) && (!st || e.ts.slice(0, 10) <= st))
    .map(e => `<tr><td>${e.ts.replace('T', ' ')}</td><td>${lbl(e.type)}</td><td>${fmt(e.bags)}</td></tr>`).join('');
  const mv = Object.keys(r.m).map(k => `<tr><td>${lbl(k)}</td><td>${fmt(r.m[k])}</td></tr>`).join('');
  return `<button onclick="go('owners')" class="np">&larr; All owners</button><h2>${esc(o.name)}</h2><p>${esc(o.phone)} ${esc(o.loc)}</p>
  <div class="np"><label>From<input type="date" value="${sf}" onchange="sf=this.value;render()"></label><label>To<input type="date" value="${st}" onchange="st=this.value;render()"></label><button onclick="print()">Print</button></div>
  <table><tr><td>Opening store balance</td><td>${fmt(r.open.store)}</td></tr>${mv}<tr class="tot"><td>Closing store balance</td><td>${fmt(r.close.store)}</td></tr>
  <tr><td>In milling / drying</td><td>${fmt(r.close.milling)} / ${fmt(r.close.drying)}</td></tr></table><h3>Transactions</h3><div class="scroll"><table>${rows}</table></div>`;
}

function histRows() {
  const q = hq.toLowerCase();
  return active(db.ledger).reverse().filter(e => (!ht || e.type === ht) && (!q || [e.id, e.ts, oname(e.ownerId), e.party, e.vehicle, e.ref, e.staff, e.notes, lbl(e.type)].join(' ').toLowerCase().includes(q)))
    .map(e => `<tr><td>${e.id}<br><small>${e.ts.replace('T', ' ')}</small></td><td>${lbl(e.type)}<br><small>${esc(oname(e.ownerId))} ${esc(e.notes)}</small></td><td>${fmt(e.bags)}<br><small>${fmt(e.bags * e.kg)} kg</small></td><td><button onclick="voidTx('${e.id}')">Delete</button></td></tr>`).join('');
}
function hist() {
  return `<h2>History</h2><input placeholder="Search id, owner, vehicle, staff, date..." value="${esc(hq)}" oninput="hq=this.value;$('#hrows').innerHTML=histRows()">
  <select onchange="ht=this.value;$('#hrows').innerHTML=histRows()"><option value="">All types</option>${Object.keys(TYPES).map(k => `<option value="${k}" ${k === ht ? 'selected' : ''}>${lbl(k)}</option>`).join('')}</select>
  <div class="scroll"><table id="hrows">${histRows()}</table></div>`;
}
function voidTx(id) {
  const e = db.ledger.find(x => x.id === id);
  if (!confirm('Delete ' + id + '? It stays in the audit log.')) return;
  e.voided = true;
  if (!check(db.ledger).ok) { e.voided = false; return alert('Cannot delete: later transactions would make stock negative.'); }
  log('Deleted ' + id); save(); render();
}

function rep() {
  const [t] = nowParts(), f = sel && sel.f || t, to = sel && sel.t || t, r = report(db.ledger, f, to);
  const mv = Object.keys(r.m).map(k => `<tr><td>${lbl(k)}</td><td>${fmt(r.m[k])}</td></tr>`).join('');
  return `<h2>Report</h2><div class="np"><label>From<input id="rf" type="date" value="${f}"></label><label>To<input id="rt" type="date" value="${to}"></label>
  <button onclick="sel={f:$('#rf').value,t:$('#rt').value};render()">Show</button><button onclick="print()">Print</button><button onclick="csv()">Export CSV</button></div>
  <table><tr><td>Opening store stock</td><td>${fmt(r.open.store)}</td></tr>${mv}<tr class="tot"><td>Closing store stock</td><td>${fmt(r.close.store)}</td></tr>
  <tr><td>Closing milling / drying</td><td>${fmt(r.close.milling)} / ${fmt(r.close.drying)}</td></tr><tr><td>Weight moved</td><td>${fmt(r.kg)} kg</td></tr></table>
  <p class="note">Closing stock becomes the next day's opening stock automatically.</p>`;
}
function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }
function csv() {
  const rows = [['ID', 'Time', 'Type', 'Owner', 'Bags', 'Kg/bag', 'Person', 'Vehicle', 'Ref', 'Staff', 'Notes']].concat(active(db.ledger).map(e => [e.id, e.ts, lbl(e.type), oname(e.ownerId), e.bags, e.kg, e.party, e.vehicle, e.ref, e.staff, e.notes]));
  dl('transactions.csv', rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
}

function count() {
  const b = balances(db.ledger), t = totals(b);
  return `<h2>Physical count</h2><p>System store stock: <b>${fmt(t.store)}</b> bags. Enter what staff counted for each owner.</p>
  <table>${db.owners.map(o => `<tr><td>${esc(o.name)}<br><small>System: ${fmt((b[o.id] || {}).store || 0)}</small></td><td><input id="c_${o.id}" type="number" placeholder="Counted"></td></tr>`).join('')}</table>
  <label>Reason for any difference<input id="creason"></label><button class="pri" onclick="applyCount()">Record count</button>`;
}
function applyCount() {
  const b = balances(db.ledger), [d, h] = nowParts(), adds = [];
  for (const o of db.owners) {
    const v = $('#c_' + o.id).value; if (v === '') continue;
    const diff = parseInt(v, 10) - ((b[o.id] || {}).store || 0);
    if (diff) adds.push({ type: 'adjustment', ownerId: o.id, bags: diff, kg: 50, ts: d + 'T' + h, party: '', vehicle: '', ref: 'COUNT', staff: db.staff, notes: 'Count: ' + $('#creason').value.trim() });
  }
  if (!adds.length) return alert('No differences found.');
  if (!$('#creason').value.trim()) return alert('Enter a reason for the difference.');
  let n = db.n; adds.forEach(e => { e.n = ++n; e.id = pad(n); });
  if (!check(db.ledger.concat(adds)).ok) return alert('Adjustment would make stock negative.');
  db.n = n; db.ledger.push(...adds); log('Count adjustments: ' + adds.map(e => e.id + ' ' + e.bags).join(', ')); save();
  alert(adds.length + ' adjustment(s) recorded.'); go('dash');
}

function more() {
  return `<h2>Settings and backup</h2><label>Factory name<input value="${esc(db.factory)}" onchange="db.factory=this.value;save()"></label>
  <label>Your name (staff)<input value="${esc(db.staff)}" onchange="db.staff=this.value;save()"></label>
  <button class="pri" onclick="dl('ricemill-backup.json',JSON.stringify(db),'application/json')">Backup data</button>
  <label>Restore backup<input type="file" accept=".json" onchange="restore(this.files[0])"></label>
  <button onclick="if(confirm('Erase ALL data?')){localStorage.removeItem(KEY);db={factory:'My Rice Mill',staff:'',owners:[],ledger:[],audit:[],n:0};save();go('dash')}">Erase all data</button>
  <h3>Audit log</h3><table>${db.audit.slice().reverse().map(a => `<tr><td><small>${esc(a.t)}<br>${esc(a.u)}</small></td><td>${esc(a.a)}</td></tr>`).join('')}</table>`;
}
function restore(f) {
  if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!d.ledger || !d.owners) return alert('Not a valid backup.'); if (!confirm('Replace current data with this backup?')) return; db = d; log('Restored backup'); save(); go('dash'); }).catch(() => alert('Could not read backup.'));
}
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
