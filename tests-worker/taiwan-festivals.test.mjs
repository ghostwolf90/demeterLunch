import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function taiwanFestivalNote(');
const end = source.indexOf('// Fixed observances verified', start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const note = date => context.taiwanFestivalNote(date);

test('2026 Taiwan festivals match official calendar dates', () => {
  for (const [date, label] of [
    ['2026-01-01', '元旦'], ['2026-02-16', '除夕'],
    ['2026-02-17', '初一'], ['2026-03-03', '元宵'],
    ['2026-04-05', '清明'], ['2026-06-19', '端午'],
    ['2026-09-25', '中秋'], ['2026-12-22', '冬至'],
  ]) assert.ok(note(date).includes(label), date);
});

test('movable dates do not leak into other years or substitute holidays', () => {
  for (const date of ['2027-02-17', '2027-06-19', '2027-09-25', '2026-04-06', '2026-10-26']) {
    assert.equal(note(date), '', date);
  }
  assert.ok(note('2027-01-01').includes('元旦'));
});

test('lunar festival dates agree with independent ICU Chinese calendar conversion', () => {
  const formatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
  });
  for (const [date, month, day] of [
    ['2026-02-17', '1', '1'], ['2026-03-03', '1', '15'],
    ['2026-06-19', '5', '5'], ['2026-08-19', '7', '7'],
    ['2026-08-27', '7', '15'], ['2026-09-25', '8', '15'],
    ['2026-10-18', '9', '9'],
  ]) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(`${date}T12:00:00+08:00`)).map(p => [p.type, p.value]));
    assert.equal(parts.month, month, date);
    assert.equal(parts.day, day, date);
  }
});
