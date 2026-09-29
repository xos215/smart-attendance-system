// PRESENTATION LAYER
const $ = (id) => document.getElementById(id);
let S = JSON.parse(sessionStorage.getItem('s') || 'null'), marks = {}, students = [], subjects = [];
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = (t, ok) => { $('msg').textContent = t; $('msg').className = ok ? 'ok' : ''; };
async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(S ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body && JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S) logout();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function logout() { sessionStorage.removeItem('s'); S = null; location.reload(); }
const cls = (p) => p < 75 ? 'low' : 'good';
function toast(t, bad) { const e = $('toast'); e.textContent = t; e.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => e.className = '', 2800); }
const fillBars = () => setTimeout(() => document.querySelectorAll('[data-w]').forEach(e => e.style.width = e.dataset.w + '%'), 30);

document.querySelectorAll('#auth .tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#auth .tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('loginForm').hidden = b.dataset.m !== 'login'; $('regForm').hidden = b.dataset.m !== 'reg'; say('');
});
$('rr').onchange = () => { const t = $('rr').value === 'teacher'; $('invW').hidden = !t; $('ri').required = t; if (!t) $('ri').value = ''; };
$('regForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/register', 'POST', { name: $('rn').value, role: $('rr').value, password: $('rp').value, invite: $('ri').value });
    say('Registered! Your unique key: ' + d.key + ' — save it, you need it to log in.', true);
    $('lk').value = d.key;
  } catch (err) { say(err.message); }
};
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try { S = await api('/api/login', 'POST', { key: $('lk').value, password: $('lp').value }); sessionStorage.setItem('s', JSON.stringify(S)); start(); }
  catch (err) { say(err.message); }
};

async function start() {
  if (!S) return;
  $('auth').hidden = true;
  $('who').innerHTML = `${esc(S.name)} (${esc(S.role)}, ${esc(S.key)}) <button id="out">Logout</button>`;
  $('out').onclick = logout;
  if (S.role === 'student') { $('student').hidden = false; return studentView(); }
  $('teacher').hidden = false; subjects = await api('/api/subjects'); students = await api('/api/students');
  $('sub').innerHTML = subjects.map(s => `<option>${esc(s)}</option>`).join('');
  const t = new Date(); if (t.getDay() === 6) t.setDate(t.getDate() + 2); if (t.getDay() === 0) t.setDate(t.getDate() + 1);
  $('dt').value = t.toISOString().slice(0, 10); loadSheet();
}
async function loadSheet() {
  const day = new Date($('dt').value + 'T00:00:00Z').getUTCDay();
  $('day').textContent = day >= 1 && day <= 5 ? ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][day] : '⚠ Weekend — attendance can only be marked Mon–Fri';
  const ex = await api(`/api/attendance?subject=${encodeURIComponent($('sub').value)}&date=${$('dt').value}`);
  marks = {}; students.forEach(s => marks[s.id] = 'P'); ex.forEach(r => marks[r.student_id] = r.status);
  drawSheet();
}
function drawSheet() {
  const pc = students.filter(s => marks[s.id] === 'P').length; $('sum').textContent = `${pc} present · ${students.length - pc} absent`;
  $('sheet').innerHTML = students.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.ukey)}</td><td><button class="tog ${marks[s.id]}" data-id="${s.id}">${marks[s.id] === 'P' ? 'Present' : 'Absent'}</button></td></tr>`).join('');
  document.querySelectorAll('.tog').forEach(b => b.onclick = () => { marks[b.dataset.id] = marks[b.dataset.id] === 'P' ? 'A' : 'P'; drawSheet(); });
}
$('sub').onchange = $('dt').onchange = loadSheet;
$('allP').onclick = () => { students.forEach(s => marks[s.id] = 'P'); drawSheet(); };
$('save').onclick = async () => {
  try {
    const d = await api('/api/attendance', 'POST', { subject: $('sub').value, date: $('dt').value, records: students.map(s => ({ student_id: s.id, status: marks[s.id] })) });
    toast(`Saved ${d.saved} records for ${$('sub').value}`);
  } catch (e) { toast(e.message, true); }
};
document.querySelectorAll('#teacher .tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#teacher .tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['mark', 'rep', 'def'].forEach(k => $('t-' + k).hidden = k !== b.dataset.t);
  if (b.dataset.t === 'rep') loadRep(); if (b.dataset.t === 'def') loadDef();
});
const head = () => `<tr><th>Student</th>${subjects.map(s => `<th>${esc(s)}</th>`).join('')}<th>Overall</th></tr>`;
const bar = (v) => `<td class="${cls(v)}">${v}%<div class="bar"><i data-w="${v}"></i></div></td>`;
const cells = (r) => subjects.map(s => r.subjects[s] ? bar(r.subjects[s].pct) : '<td>-</td>').join('') + bar(r.pct);
let repData = [], defData = [];
async function loadRep() {
  repData = await api('/api/report');
  const avg = repData.length ? Math.round(repData.reduce((t, r) => t + r.pct, 0) / repData.length * 10) / 10 : 0, d = repData.filter(r => r.defaulter).length;
  $('stats').innerHTML = `<div class="stat"><b>${repData.length}</b><span>Students</span></div><div class="stat"><b class="${cls(avg)}">${avg}%</b><span>Class average</span></div><div class="stat"><b class="${d ? 'low' : 'good'}">${d}</b><span>Defaulters</span></div>`;
  $('repTbl').innerHTML = head() + repData.map(r => `<tr><td>${esc(r.name)}</td>${cells(r)}</tr>`).join(''); fillBars();
}
async function loadDef() {
  defData = await api('/api/defaulters?threshold=' + $('th').value);
  $('defTbl').innerHTML = '<tr><th>Student</th><th>Key</th><th>Present/Total</th><th>%</th></tr>' +
    (defData.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.key)}</td><td>${r.present}/${r.total}</td><td class="low">${r.pct}%</td></tr>`).join('') || '<tr><td colspan=4>No defaulters</td></tr>');
}
$('loadDef').onclick = loadDef;
function pdf(title, cols, rows, name) {
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16); doc.text(title, 14, 16); doc.setFontSize(9); doc.text('Generated: ' + new Date().toLocaleString(), 14, 22);
  doc.autoTable({ head: [cols], body: rows, startY: 26, headStyles: { fillColor: [14, 116, 144] } }); doc.save(name);
}
$('pdfDef').onclick = async () => {
  await loadDef(); pdf(`Defaulter List (below ${$('th').value}%)`, ['Student', 'Key', 'Present', 'Total', '%'],
    defData.map(r => [r.name, r.key, r.present, r.total, r.pct + '%']), 'defaulters.pdf');
};
$('pdfRep').onclick = async () => {
  await loadRep(); pdf('Attendance Report', ['Student', ...subjects, 'Overall'],
    repData.map(r => [r.name, ...subjects.map(s => r.subjects[s] ? r.subjects[s].pct + '%' : '-'), r.pct + '%']), 'attendance-report.pdf');
};
async function studentView() {
  subjects = await api('/api/subjects'); const r = await api('/api/me/report');
  $('stat').innerHTML = `<div class="ring ${cls(r.pct)}" id="ring"><b>${r.pct}%</b></div><div><h3 class="${cls(r.pct)}">${r.present} of ${r.total} classes attended</h3>` + (r.defaulter ? '<p class="low">Below 75%. You are on the defaulter list.</p>' : '<p class="good">You are above the 75% requirement.</p>') + '</div>';
  $('ring').style.setProperty('--p', r.pct);
  $('myTbl').innerHTML = '<tr><th>Subject</th><th>Present</th><th>Total</th><th>%</th></tr>' + subjects.map(s => {
    const x = r.subjects[s] || { present: 0, total: 0, pct: 0 }; return `<tr><td>${esc(s)}</td><td>${x.present}</td><td>${x.total}</td><td class="${cls(x.pct)}">${x.pct}%</td></tr>`; }).join('');
}
start();
