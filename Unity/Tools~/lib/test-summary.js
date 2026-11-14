// Resume la salida de "unity test run" (un JSON por prueba, o un array en versiones anteriores de la CLI).
'use strict';
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  let tests = [];
  const t = s.trim();
  try { const j = JSON.parse(t); const r = j.data ? (j.data.result !== undefined ? j.data.result : j.data) : j; tests = Array.isArray(r) ? r : [r]; }
  catch (_) { for (const line of t.split('\n')) { try { const o = JSON.parse(line); if (o && o.fullName) tests.push(o); } catch (e) { if (line.trim()) console.log('  ' + line.slice(0, 500)); } } }
  tests = tests.filter((x) => x && x.fullName);
  const bad = tests.filter((x) => x.status !== 'Passed');
  console.log(`PRUEBAS: ${tests.length} en total, ${tests.length - bad.length} pasan, ${bad.length} no`);
  for (const x of bad.slice(0, 30)) console.log(` X ${x.fullName} | ${x.status} | ${String(x.message || '').slice(0, 600)}`);
});
