// BUSINESS LOGIC LAYER (no HTTP, no SQL)
const SUBJECTS = ['English', 'Kannada', 'C#', 'C++', 'Java'];
const isWeekday = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  (g => g >= 1 && g <= 5)(new Date(d + 'T00:00:00Z').getUTCDay());
const pct = (p, t) => (t ? Math.round((p * 1000) / t) / 10 : 0);

// rows: [{id,name,ukey,subject,total,present}] -> per-student report
function buildReport(rows, threshold = 75) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.id)) m.set(r.id, { id: r.id, name: r.name, key: r.ukey, subjects: {}, total: 0, present: 0 });
    const s = m.get(r.id);
    if (r.subject) {
      s.subjects[r.subject] = { total: r.total, present: r.present, pct: pct(r.present, r.total) };
      s.total += r.total; s.present += r.present;
    }
  }
  return [...m.values()].map(s => ({ ...s, pct: pct(s.present, s.total), defaulter: s.total > 0 && pct(s.present, s.total) < threshold }));
}
const defaulters = (report) => report.filter(s => s.defaulter).sort((a, b) => a.pct - b.pct);
const strongPassword = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
module.exports = { SUBJECTS, isWeekday, pct, buildReport, defaulters, strongPassword };
