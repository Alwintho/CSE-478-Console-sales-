// Data calculations shared by the charts and the story text.
export const COMPANIES = ['Sony', 'Microsoft', 'Nintendo'];
export const COLORS = { Sony: '#346AA6', Microsoft: '#3A8067', Nintendo: '#BF6B34' };
export const PAIRS = [
    { id: '3ds-switch', old: '3DS', newer: 'NS', label: 'Nintendo 3DS / Switch' },
    { id: 'wiiu-switch', old: 'WiiU', newer: 'NS', label: 'Wii U / Switch' },
    { id: 'switch-switch2', old: 'NS', newer: 'NS2', label: 'Switch / Switch 2' },
    { id: 'ps3-ps4', old: 'PS3', newer: 'PS4', label: 'PlayStation 3 / PlayStation 4' },
    { id: 'ps4-ps5', old: 'PS4', newer: 'PS5', label: 'PlayStation 4 / PlayStation 5' },
    { id: '360-one', old: 'X360', newer: 'XOne', label: 'Xbox 360 / Xbox One' },
    { id: 'one-series', old: 'XOne', newer: 'XS', label: 'Xbox One / Xbox Series X/S' },
    { id: 'ds-3ds', old: 'DS', newer: '3DS', label: 'Nintendo DS / Nintendo 3DS' },
    { id: 'psp-vita', old: 'PSP', newer: 'PSV', label: 'PSP / PlayStation Vita' },
    { id: 'wii-wiiu', old: 'Wii', newer: 'WiiU', label: 'Wii / Wii U' },
];

export function parseRecords(raw) {
    const seen = new Set();
    return raw.map(row => {
        const year = Number(row.year);
        const units = row.units == null || String(row.units).trim() === '' ? null : Number(row.units);
        const key = `${row.console_id}-${year}`;
        if (!Number.isInteger(year) || year < 2006 || year > 2025) throw new Error(`Invalid year: ${row.year}`);
        if (!COMPANIES.includes(row.company)) throw new Error(`Unknown company: ${row.company}`);
        if (!['Home', 'Handheld', 'Hybrid'].includes(row.hardware_type)) throw new Error('Unknown hardware classification.');
        if (units !== null && (!Number.isSafeInteger(units) || units < 0)) throw new Error(`Invalid units: ${row.units}`);
        if (!row.console_id || seen.has(key)) throw new Error(`Duplicate or missing console identifier: ${key}`);
        seen.add(key);
        return { ...row, year, units };
    });
}

export function yearRange(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function filterRecords(records, state) {
    return records.filter(row => row.year >= state.start && row.year <= state.end &&
        (state.hardware === 'All' || row.hardware_type === state.hardware));
}

export function companyYears(records, years) {
    return years.map(year => {
        const rows = records.filter(row => row.year === year && row.units !== null);
        const totals = Object.fromEntries(COMPANIES.map(company => {
            const included = rows.filter(row => row.company === company);
            return [company, included.length ? included.reduce((sum, row) => sum + row.units, 0) : null];
        }));
        const total = rows.length ? rows.reduce((sum, row) => sum + row.units, 0) : null;
        const available = COMPANIES.filter(company => totals[company] !== null);
        const leader = available.length ? available.reduce((best, company) => totals[company] > totals[best] ? company : best) : null;
        return { year, totals, total, leader, count: rows.length };
    });
}

export function leaderChanges(annual) {
    return annual.filter((row, i) => i > 0 && row.leader && annual[i - 1].leader && row.leader !== annual[i - 1].leader);
}

export function rankConsoles(records, year = null) {
    const map = new Map();
    records.filter(row => row.units !== null && (year === null || row.year === year)).forEach(row => {
        if (!map.has(row.console_id)) map.set(row.console_id, { ...row, units: 0, observedYears: 0 });
        const item = map.get(row.console_id);
        item.units += row.units;
        item.observedYears++;
    });
    return [...map.values()].sort((a, b) => b.units - a.units || a.console.localeCompare(b.console));
}

export function availablePairs(consoles, hardware) {
    const included = new Set(consoles.filter(c => hardware === 'All' || c.hardware === hardware).map(c => c.id));
    return PAIRS.filter(pair => included.has(pair.old) && included.has(pair.newer));
}

export function chooseStoryYear(records) {
    const annual = companyYears(records, yearRange(2006, 2025));
    const mismatch = leaderChanges(annual).find(row => rankConsoles(records, row.year)[0]?.company !== row.leader);
    return mismatch?.year ?? 2025;
}

export function recordedOverlap(records, pair, years) {
    return years.filter(year => [pair.old, pair.newer].every(id =>
        records.some(row => row.console_id === id && row.year === year && row.units !== null)));
}
