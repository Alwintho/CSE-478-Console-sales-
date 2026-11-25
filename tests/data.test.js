import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRecords, companyYears, filterRecords, rankConsoles, yearRange, chooseStoryYear, availablePairs } from '../js/data.js';

// These source fields contain no quoted commas. Parsing here keeps tests independent of D3.
const lines = fs.readFileSync(new URL('../data/console_sales.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const headers = lines.shift().split(',');
const records = parseRecords(lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [headers[i], v]))));
const consoles = JSON.parse(fs.readFileSync(new URL('../data/consoles.json', import.meta.url)));
const base = { start: 2006, end: 2025, hardware: 'All' };

test('Every CSV value matches the saved source; 2026 is excluded', () => {
    const source = JSON.parse(fs.readFileSync(new URL('../data/raw/vgchartz_yearly_snapshot.json', import.meta.url)));
    const expected = source.series.flatMap(s => s.points.filter(p => p.year >= 2006 && p.year <= 2025).map(p => ({ id: s.console_id, ...p })));
    assert.equal(records.length, expected.length);
    assert.equal(records.length, 123);
    for (const point of expected) assert.equal(records.find(r => r.console_id === point.id && r.year === point.year)?.units, point.units);
    assert.ok(records.every(r => r.year <= 2025));
});

test('A blank unit value stays missing while a reported zero stays zero', () => {
    const baseRow = { year: '2020', console_id: 'TEST', company: 'Sony', hardware_type: 'Home' };
    assert.equal(parseRecords([{ ...baseRow, units: '' }])[0].units, null);
    assert.equal(parseRecords([{ ...baseRow, units: '0' }])[0].units, 0);
    assert.throws(() => parseRecords([{ ...baseRow, units: '-1' }]));
});

test('Duplicate console-year keys are rejected', () => {
    assert.throws(() => parseRecords([records[0], records[0]]), /Duplicate/);
});

test('Missing company totals are null, including an entirely empty year', () => {
    const handheld = filterRecords(records, { ...base, hardware: 'Handheld' });
    const annual = companyYears(handheld, [2018, 2025]);
    assert.equal(annual[0].totals.Microsoft, null);
    assert.equal(annual[1].total, null);
    assert.equal(annual[1].leader, null);
});

test('Company highlights do not change the selected records or share denominator', () => {
    const selected = filterRecords(records, base);
    const highlighted = filterRecords(records, { ...base, highlight: 'Sony' });
    assert.deepEqual(selected, highlighted);
    const row = companyYears(selected, [2018])[0];
    const shares = Object.values(row.totals).filter(v => v !== null).map(v => v / row.total);
    assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('The opening narrative is supported by the saved 2018 records', () => {
    assert.equal(chooseStoryYear(records), 2018);
    assert.equal(companyYears(records, [2018])[0].leader, 'Nintendo');
    assert.equal(rankConsoles(records, 2018)[0].console_id, 'PS4');
    assert.equal(companyYears(records, [2018])[0].totals.Nintendo, 19959347);
});

test('Pair choices respect the same hardware filter as other views', () => {
    const hybrid = availablePairs(consoles, 'Hybrid');
    assert.deepEqual(hybrid.map(p => p.id), ['switch-switch2']);
    assert.ok(availablePairs(consoles, 'Home').every(p => ['Home'].includes(consoles.find(c => c.id === p.old).hardware) && consoles.find(c => c.id === p.newer).hardware === 'Home'));
});

test('A single-year range contains exactly that year', () => {
    assert.deepEqual(yearRange(2020, 2020), [2020]);
    assert.ok(filterRecords(records, { ...base, start: 2020, end: 2020 }).every(r => r.year === 2020));
});
