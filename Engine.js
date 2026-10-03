// Stock ledger engine. Balances are ALWAYS calculated from transactions, never typed in.
const TYPES = {
  opening:    { label: 'Opening Stock', to: 'store' },
  received:   { label: 'Bags Received', to: 'store' },
  to_milling: { label: 'Sent to Milling', from: 'store', to: 'milling' },
  to_drying:  { label: 'Sent to Drying', from: 'store', to: 'drying' },
  from_drying:{ label: 'Returned from Drying', from: 'drying', to: 'store' },
  milled:     { label: 'Milling Done (to store)', from: 'milling', to: 'store' },
  dispatched: { label: 'Dispatched / Sold', from: 'store', to: 'dispatched' },
  adjustment: { label: 'Stock Adjustment (+/-)', adj: true },
  damaged:    { label: 'Damaged / Lost', from: 'store' }
};
const empty = () => ({ store: 0, milling: 0, drying: 0, dispatched: 0 });
function apply(b, e) {
  const o = b[e.ownerId] || (b[e.ownerId] = empty()), t = TYPES[e.type];
  if (t.adj) o.store += e.bags;
  else { if (t.from) o[t.from] -= e.bags; if (t.to) o[t.to] += e.bags; }
}
function active(l) {
  return l.filter(e => !e.voided).sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.n - b.n);
}
function balances(l, before) {
  const b = {};
  for (const e of active(l)) { if (before && e.ts >= before) break; apply(b, e); }
  return b;
}
function check(l) { // replays history; fails if any owner location would go negative
  const b = {};
  for (const e of active(l)) {
    apply(b, e);
    for (const k of ['store', 'milling', 'drying'])
      if (b[e.ownerId][k] < 0) return { ok: false, e, loc: k, short: -b[e.ownerId][k] };
  }
  return { ok: true };
}
function totals(b) {
  const t = empty();
  for (const id in b) for (const k in t) t[k] += b[id][k];
  return t;
}
function addDay(d, n = 1) {
  const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function report(l, from, to) {
  from = from || '0000-01-01';
  const open = totals(balances(l, from + 'T00:00'));
  const close = totals(balances(l, addDay(to) + 'T00:00'));
  const m = {}; let kg = 0;
  for (const e of active(l)) {
    const d = e.ts.slice(0, 10);
    if (d >= from && d <= to) { m[e.type] = (m[e.type] || 0) + e.bags; kg += e.bags * (e.kg || 0); }
  }
  return { open, close, m, kg };
}
if (typeof module !== 'undefined') module.exports = { TYPES, apply, active, balances, check, totals, report, addDay };
