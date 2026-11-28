import { COMPANIES, PAIRS, parseRecords, yearRange, filterRecords, companyYears, rankConsoles, leaderChanges, availablePairs, chooseStoryYear, recordedOverlap } from './js/data.js';
import { renderChart, hideTooltip } from './js/charts.js';

const state = { start: 2006, end: 2025, focus: 2018, hardware: 'All', chapter: 0, highlight: null, console: 'NS', pair: '3ds-switch' };
let records = [], consoles = [];
let defaultFocus = 2018;
const $ = selector => document.querySelector(selector);
const titles = [
    'Who leads the tracked sales?', 'Which consoles sold in the story year?',
    'How does the company balance change?', 'Which generations sold alongside each other?',
    'A closer look at overlapping generations', 'Timeline Explorer: How do console sales evolve?',
];
const captions = [
    'Company sums use available console records. Dashed and dotted lines distinguish companies. Select a point to change the story year.',
    'Annual console estimates for the story year, starting at zero. These are not lifetime totals. Select a bar to follow a console.',
    'Percentages use all tracked companies after the year and hardware filters. Highlighting never changes the denominator. Hatching means no records.',
    'Rows show console families. Color represents annual estimated units; hatching means no source record. A missing record does not mean zero.',
    'Both ribbons use one thickness scale. Shading marks years reported for both families. No record is hatched. Ribbons do not show transfers of buyers.',
    'Bubble area represents annual estimated console sales, and color identifies the company. Select a bubble to follow a console and year. Hollow circles represent recorded zero sales, while missing records have no bubble.',
];
const millions = value => `${(value / 1e6).toFixed(2)} million`;
const percent = value => `${(100 * value).toFixed(1)}%`;

function currentData() {
    const filtered = filterRecords(records, state);
    const years = yearRange(state.start, state.end);

    // Find the maximum annual console sales across the complete dataset.
    const maxConsoleSales = Math.max(1, ...records
        .filter(row => row.units !== null)
        .map(row => row.units));

    return { records: filtered, years, annual: companyYears(filtered, years), consoles, pair: PAIRS.find(pair => pair.id === state.pair), maxConsoleSales };
}

function updateNarrative(data) {
    const focus = data.annual.find(row => row.year === state.focus);
    const ranks = rankConsoles(data.records, state.focus);
    const top = ranks[0];
    const changes = leaderChanges(data.annual);
    if (focus?.leader && top) {
        $('#insight-0').textContent = `In ${state.focus}, ${focus.leader} leads the included company totals with ${millions(focus.totals[focus.leader])} estimated units. Across the selected years, the lead changes ${changes.length} time${changes.length === 1 ? '' : 's'}.`;
        $('#insight-1').textContent = top.company !== focus.leader
            ? `${top.console} is the bestselling tracked console in ${state.focus}, at ${millions(top.units)} units. But its maker, ${top.company}, does not lead the company total. ${focus.leader} does.`
            : `${top.console} is the bestselling tracked console in ${state.focus}, with ${millions(top.units)} units. Its maker, ${top.company}, also leads the company total in this selection.`;
        $('#insight-2').textContent = `${focus.leader} accounts for ${percent(focus.totals[focus.leader] / focus.total)} of the ${millions(focus.total)} estimated units in the included ${state.focus} records. A lead does not necessarily mean a majority.`;
        const portfolio = ranks.filter(row => row.company === focus.leader);
        $('#insight-3').textContent = `${focus.leader} has ${portfolio.length} console famil${portfolio.length === 1 ? 'y' : 'ies'} with records in ${state.focus}: ${portfolio.map(row => `${row.console} (${millions(row.units)})`).join(', ')}. Follow their rows to see how their recorded years overlap.`;
    } else {
        [0, 1, 2, 3].forEach(i => { $(`#insight-${i}`).textContent = `There are no reported console figures for ${state.focus} with this hardware filter. Move the story year or choose another hardware type to continue the comparison.`; });
    }
    if (data.pair) {
        const old = consoles.find(c => c.id === data.pair.old), newer = consoles.find(c => c.id === data.pair.newer);
        const overlap = recordedOverlap(data.records, data.pair, data.years);
        const observed = id => data.records.find(row => row.console_id === id && row.year === state.focus)?.units ?? null;
        const oldValue = observed(old.id), newValue = observed(newer.id);
        const formatted = units => units === null ? 'no source record' : `${millions(units)} estimated units`;
        $('#insight-4').textContent = `For ${state.focus}: ${old.name} has ${formatted(oldValue)}; ${newer.name} has ${formatted(newValue)}. Both families have figures in ${overlap.length} of the selected years. The view compares recorded sales rather than assuming a clean break between generations.`;
    } else {
        $('#insight-4').textContent = 'Choose a hardware type with two comparable console families to examine an overlap.';
    }

    // Find the selected console's reported sales within the current filters.
    const timelineRecords = data.records.filter(row =>
        row.console_id === state.console && row.units !== null
    );

    if (timelineRecords.length > 0) {
        const consoleName = timelineRecords[0].console;

        // Find the selected console's sales in the current story year.
        const timelineFocus = timelineRecords.find(row => row.year === state.focus);

        // Identify the highest annual sales within the selected period.
        const peak = timelineRecords.reduce((best, row) =>
            row.units > best.units ? row : best
        );

        // Distinguish missing sales records from reported zero sales.
        const focusDescription = timelineFocus
            ? `In ${state.focus}, ${consoleName} recorded ${millions(timelineFocus.units)} estimated units.`
            : `No sales record is available for ${consoleName} in ${state.focus}.`;

        // Update the narrative to reflect the selected console and year.
        $('#insight-5').textContent =
            `${focusDescription} Its highest recorded annual sales within the selected period occurred in ${peak.year}, reaching ${millions(peak.units)} units.`;
    } else {
        $('#insight-5').textContent =
            'Select a console bubble or adjust the filters to explore its recorded sales history.';
    }
}

function updateTable(data) {
    $('#record-count').textContent = `${data.records.length} console-year records in the current selection.`;
    const body = $('#data-rows');
    body.replaceChildren();
    data.records.forEach(row => {
        const tr = document.createElement('tr');
        [row.year, row.console, row.company, row.hardware_type, row.units === null ? 'No record' : row.units.toLocaleString('en-US')].forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.append(td);
        });
        body.append(tr);
    });
}

function syncControls() {
    $('#start-year').value = state.start;
    $('#end-year').value = state.end;
    $('#hardware').value = state.hardware;
    $('#focus-year').min = state.start;
    $('#focus-year').max = state.end;
    $('#focus-year').value = state.focus;
    $('#focus-year-label').value = state.focus;
    $('#focus-year-label').textContent = state.focus;
    $('#selection-label').textContent = `${state.start}–${state.end} · ${state.hardware === 'All' ? 'All hardware' : state.hardware}`;
    $('#chapter-number').textContent = `Chapter ${String(state.chapter + 1).padStart(2, '0')} / ${String(titles.length).padStart(2, '0')}`;
    $('#chart-title').textContent = titles[state.chapter];
    $('#chart-caption').textContent = captions[state.chapter];
    $('#pair-control').hidden = state.chapter !== 4;
    document.querySelectorAll('[data-company]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.company === state.highlight)));
    document.querySelectorAll('[data-chapter]').forEach(button => {
        if (Number(button.dataset.chapter) === state.chapter) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.story-step').forEach(step => step.classList.toggle('is-active', Number(step.dataset.step) === state.chapter));
    document.documentElement.style.setProperty('--controls-height', `${$('.explore-controls').offsetHeight}px`);
}

function syncPairs() {
    const choices = availablePairs(consoles, state.hardware);
    if (!choices.some(pair => pair.id === state.pair)) state.pair = choices[0]?.id ?? null;
    const select = $('#console-pair');
    select.replaceChildren();
    choices.forEach(pair => select.add(new Option(pair.label, pair.id)));
    select.value = state.pair ?? '';
    select.disabled = choices.length === 0;
}

function selectConsole(id, year) {
    state.console = id;
    if (year !== undefined) state.focus = year;
    const choices = availablePairs(consoles, state.hardware);
    const match = choices.find(pair => pair.newer === id) ?? choices.find(pair => pair.old === id);
    if (match) state.pair = match.id;
    syncPairs();
    render();
    $('#announcement').textContent = `Following ${consoles.find(c => c.id === id)?.name ?? id}.`;
}

function selectYear(year) {
    state.focus = Math.max(state.start, Math.min(state.end, Number(year)));
    render();
}

function render() {
    const data = currentData();
    syncControls();
    updateNarrative(data);
    updateTable(data);
    renderChart($('#chart'), data, state, { year: selectYear, console: selectConsole });
}

function showChapter(chapter, scroll = false) {
    const changed = state.chapter !== chapter;
    state.chapter = chapter;
    if (changed) {
        render();
        $('#announcement').textContent = `Chapter ${chapter + 1}: ${titles[chapter]}`;
    }
    if (scroll) {
        const controlsHeight = $('.explore-controls').offsetHeight;
        const offset = window.innerWidth <= 760 ? controlsHeight + $('.viz-panel').offsetHeight + 25 : controlsHeight + 40;
        const top = $(`#chapter-${chapter}`).getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
}

function events() {
    $('#start-year').addEventListener('change', event => {
        state.start = Number(event.target.value);
        state.end = Math.max(state.start, state.end);
        state.focus = Math.max(state.start, Math.min(state.end, state.focus));
        render();
    });
    $('#end-year').addEventListener('change', event => {
        state.end = Number(event.target.value);
        state.start = Math.min(state.start, state.end);
        state.focus = Math.max(state.start, Math.min(state.end, state.focus));
        render();
    });
    $('#hardware').addEventListener('change', event => {
        state.hardware = event.target.value;
        if (!consoles.some(c => c.id === state.console && (state.hardware === 'All' || c.hardware === state.hardware))) {
            state.console = rankConsoles(filterRecords(records, state), state.focus)[0]?.console_id ?? null;
        }
        syncPairs();
        render();
    });
    $('#focus-year').addEventListener('input', event => selectYear(event.target.value));
    $('#console-pair').addEventListener('change', event => {
        state.pair = event.target.value;
        state.console = PAIRS.find(pair => pair.id === state.pair).newer;
        render();
    });
    $('#reset').addEventListener('click', () => {
        Object.assign(state, { start: 2006, end: 2025, focus: defaultFocus, hardware: 'All', highlight: null, console: 'NS', pair: '3ds-switch' });
        syncPairs();
        render();
        $('#announcement').textContent = 'Restored the full year range, all hardware, and the opening story year.';
    });
    document.querySelectorAll('[data-company]').forEach(button => button.addEventListener('click', () => {
        state.highlight = state.highlight === button.dataset.company ? null : button.dataset.company;
        render();
    }));
    document.querySelectorAll('[data-chapter]').forEach(button => button.addEventListener('click', () => showChapter(Number(button.dataset.chapter), true)));
    // Use the visible reading area, below the pinned chart on smaller screens.
    let scrollPending = false;
    window.addEventListener('scroll', () => {
        hideTooltip();
        if (scrollPending) return;
        scrollPending = true;
        requestAnimationFrame(() => {
            const line = window.innerWidth <= 760
                ? Math.min(window.innerHeight - 35, $('.viz-panel').getBoundingClientRect().bottom + 60)
                : $('.explore-controls').offsetHeight + Math.min(220, window.innerHeight * .25);
            const active = [...document.querySelectorAll('.story-step')].find(step => {
                const bounds = step.getBoundingClientRect();
                return bounds.top <= line && bounds.bottom > line;
            });
            if (active) showChapter(Number(active.dataset.step));
            scrollPending = false;
        });
    }, { passive: true });
    let previousWidth = 0;
    new ResizeObserver(entries => {
        const width = Math.round(entries[0].contentRect.width);
        if (Math.abs(width - previousWidth) > 2) { previousWidth = width; render(); }
    }).observe($('#chart'));
}

async function initialize() {
    try {
        const [raw, metadata, provenance] = await Promise.all([
            window.d3.csv('data/console_sales.csv'), window.d3.json('data/consoles.json'), window.d3.json('data/provenance.json'),
        ]);
        records = parseRecords(raw);
        consoles = metadata;
        if (!records.length) throw new Error('The dataset is empty.');
        defaultFocus = chooseStoryYear(records);
        state.focus = defaultFocus;
        yearRange(2006, 2025).forEach(year => {
            $('#start-year').add(new Option(year, year));
            $('#end-year').add(new Option(year, year));
        });
        $('#console-count').textContent = consoles.length;
        $('#snapshot-date').textContent = `Snapshot retrieved ${new Date(provenance.retrieved_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}.`;
        syncPairs();
        render();
        events();
        $('#load-status').hidden = true;
    } catch (error) {
        console.error(error);
        $('#load-status').classList.add('error');
        $('#load-status').textContent = 'The data could not be loaded. Serve this folder with python3 -m http.server 8000, then open http://localhost:8000. Check that the data and vendor folders are present.';
        $('#chart').setAttribute('aria-busy', 'false');
    }
}

initialize();
