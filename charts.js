import { COMPANIES, COLORS, rankConsoles, leaderChanges, recordedOverlap } from './data.js';

const d3 = window.d3;
const exact = value => value === null ? 'No record' : d3.format(',')(value);
const short = value => d3.format('.3~s')(value);

function showTooltip(event, lines) {
    const tooltip = document.querySelector('#tooltip');
    tooltip.textContent = lines.join('\n');
    tooltip.hidden = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const left = event.clientX || bounds.left + bounds.width / 2;
    const top = event.clientY || bounds.top + bounds.height / 2;
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 12, left + 16))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 12, top + 15))}px`;
}

export function hideTooltip() {
    document.querySelector('#tooltip').hidden = true;
}

function interactions(selection, describe, activate = null) {
    selection.classed('mark', true).classed('selectable', Boolean(activate))
        .attr('tabindex', 0).attr('role', activate ? 'button' : 'img')
        .attr('aria-label', d => describe(d).join('. '))
        .on('pointerenter pointermove focus', (event, d) => showTooltip(event, describe(d)))
        .on('pointerleave blur', hideTooltip)
        .on('keydown', (event, d) => {
            if (event.key === 'Escape') hideTooltip();
            if (activate && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                activate(d);
            }
        });
    if (activate) selection.on('click', (_, d) => activate(d));
    selection.append('title').text(d => describe(d).join('\n'));
}

function opacity(company, state) {
    return state.highlight && state.highlight !== company ? .18 : 1;
}

function frame(container, title, left = 66) {
    const width = Math.max(380, Math.min(900, Math.round(container.clientWidth)));
    const compact = width < 550;
    const height = compact ? 350 : 510;
    const margin = { top: 48, right: compact ? 24 : 78, bottom: 60, left: compact ? Math.min(left, 82) : left };
    const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'group').attr('aria-labelledby', 'svg-title svg-description');
    svg.append('title').attr('id', 'svg-title').text(title);
    svg.append('desc').attr('id', 'svg-description').text('VGChartz global hardware estimates. Focus on chart marks for details, or inspect the source table below the story.');
    const pattern = svg.append('defs').append('pattern').attr('id', 'missing-record')
        .attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse');
    pattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#eceee8');
    pattern.append('path').attr('d', 'M-1,1L1,-1 M0,6L6,0 M5,7L7,5').attr('stroke', '#c9cec3').attr('stroke-width', 1);
    return { svg, width, height, margin, compact, right: width - margin.right, bottom: height - margin.bottom };
}

function emptyChart(plot, message = 'No source records match these years and hardware.') {
    plot.svg.append('text').attr('x', plot.width / 2).attr('y', plot.height / 2 - 10)
        .attr('text-anchor', 'middle').attr('class', 'chart-note').text(message);
    plot.svg.append('text').attr('x', plot.width / 2).attr('y', plot.height / 2 + 15)
        .attr('text-anchor', 'middle').attr('class', 'chart-note').text('Try a wider year range or another hardware type.');
}

function yearScale(plot, years) {
    const first = years[0], last = years.at(-1);
    return d3.scaleLinear().domain(first === last ? [first - .5, last + .5] : [first, last])
        .range([plot.margin.left, plot.right]);
}

function yearTicks(years, compact) {
    const step = Math.max(1, Math.ceil((years.length - 1) / (compact ? 4 : 6)));
    const ticks = years.filter((_, i) => i % step === 0);
    const last = years.at(-1);
    if (ticks.at(-1) !== last) {
        if (ticks.length > 1 && last - ticks.at(-1) < step * .7) ticks.pop();
        ticks.push(last);
    }
    return ticks;
}

function xAxis(plot, x, years) {
    const ticks = yearTicks(years, plot.compact);
    plot.svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${plot.bottom})`)
        .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d')).tickSizeOuter(0));
    plot.svg.append('text').attr('class', 'chart-label').attr('x', plot.right).attr('y', plot.height - 12)
        .attr('text-anchor', 'end').text('Year');
}

function unitsAxis(plot, y) {
    plot.svg.append('g').attr('class', 'axis').attr('transform', `translate(${plot.margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2~s')).tickSize(-(plot.right - plot.margin.left)))
        .call(g => g.select('.domain').remove());
    plot.svg.append('text').attr('class', 'chart-label').attr('x', plot.margin.left).attr('y', 17).text('Estimated annual units');
}

function focusGuide(plot, x, state) {
    plot.svg.append('line').attr('class', 'year-guide').attr('x1', x(state.focus)).attr('x2', x(state.focus))
        .attr('y1', plot.margin.top).attr('y2', plot.bottom);
    plot.svg.append('text').attr('class', 'chart-label').attr('x', x(state.focus)).attr('y', plot.bottom + 37)
        .attr('text-anchor', 'middle').style('font-weight', 700).text(state.focus);
}

function drawTrends(container, data, state, callbacks) {
    const plot = frame(container, 'Annual units in the tracked company records');
    const { svg, margin, right, bottom } = plot;
    if (!data.records.some(r => r.units !== null)) return emptyChart(plot);
    const x = yearScale(plot, data.years);
    const max = d3.max(data.annual.flatMap(row => Object.values(row.totals)).filter(v => v !== null)) || 1;
    const y = d3.scaleLinear().domain([0, max]).nice().range([bottom, margin.top]);
    xAxis(plot, x, data.years);
    unitsAxis(plot, y);
    focusGuide(plot, x, state);

    const changes = leaderChanges(data.annual).slice(0, plot.compact ? 2 : 4);
    changes.forEach((row, i) => {
        svg.append('text').attr('x', Math.min(right - 8, Math.max(margin.left + 32, x(row.year))))
            .attr('y', 30 + (i % 2) * 13).attr('text-anchor', 'middle').attr('fill', COLORS[row.leader])
            .attr('font-size', plot.compact ? 10 : 11).text(`${row.year}: ${row.leader}`);
    });

    COMPANIES.forEach((company, i) => {
        const values = data.annual.map(row => ({ year: row.year, units: row.totals[company], company }));
        const group = svg.append('g').attr('opacity', opacity(company, state));
        const line = d3.line().defined(d => d.units !== null).x(d => x(d.year)).y(d => y(d.units));
        group.append('path').datum(values).attr('d', line).attr('fill', 'none').attr('stroke', COLORS[company])
            .attr('stroke-width', 2.5).attr('stroke-dasharray', ['', '7 3', '2 3'][i]);
        const circles = group.selectAll('circle').data(values.filter(d => d.units !== null)).join('circle')
            .attr('cx', d => x(d.year)).attr('cy', d => y(d.units))
            .attr('r', d => d.year === state.focus ? 5.5 : 3.5)
            .attr('fill', COLORS[company]).attr('stroke', '#f7f6f0').attr('stroke-width', 1.2);
        interactions(circles, d => [`${d.company} · ${d.year}`, `${exact(d.units)} estimated tracked units`, 'Select to follow this year.'], d => callbacks.year(d.year));
        if (!plot.compact) {
            const last = values.filter(d => d.units !== null).at(-1);
            if (last) group.append('text').attr('x', x(last.year) + 7).attr('y', y(last.units) + 4)
                .attr('fill', COLORS[company]).attr('font-size', 11).text(company);
        }
    });
}

function drawRanking(container, data, state, callbacks) {
    const plot = frame(container, `Console ranking in ${state.focus}`, 170);
    const { svg, margin, right, bottom, compact } = plot;
    const rows = rankConsoles(data.records, state.focus);
    if (!rows.length) return emptyChart(plot, `No console records for ${state.focus} with this hardware filter.`);
    const x = d3.scaleLinear().domain([0, d3.max(rows, r => r.units) || 1]).nice().range([margin.left, right]);
    const y = d3.scaleBand().domain(rows.map(r => r.console_id)).range([margin.top, bottom]).padding(.24);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${bottom})`)
        .call(d3.axisBottom(x).ticks(compact ? 3 : 5).tickFormat(d3.format('.2~s')).tickSizeOuter(0));
    svg.append('text').attr('class', 'chart-label').attr('x', margin.left).attr('y', 22).text(`${state.focus} estimated units`);
    const groups = svg.selectAll('g.console-row').data(rows).join('g').attr('class', 'console-row')
        .attr('opacity', d => opacity(d.company, state));
    groups.append('text').attr('x', margin.left - 10).attr('y', d => y(d.console_id) + y.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end').attr('font-size', compact ? 11 : 12)
        .attr('fill', d => COLORS[d.company]).text(d => compact ? d.console_id : d.console);
    const bars = groups.append('rect').attr('x', x(0)).attr('y', d => y(d.console_id))
        .attr('width', d => Math.max(0, x(d.units) - x(0))).attr('height', y.bandwidth())
        .attr('fill', d => COLORS[d.company]).attr('stroke', d => d.console_id === state.console ? '#202622' : 'none')
        .attr('stroke-width', 2.5).attr('aria-pressed', d => String(d.console_id === state.console));
    interactions(bars, d => [`${d.console} · ${d.company} · ${state.focus}`, `${exact(d.units)} estimated units`, 'Select to follow this console.'], d => callbacks.console(d.console_id));
    groups.append('text').attr('x', d => x(d.units) > right - 55 ? x(d.units) - 6 : x(d.units) + 7)
        .attr('text-anchor', d => x(d.units) > right - 55 ? 'end' : 'start')
        .attr('y', d => y(d.console_id) + y.bandwidth() / 2 + 4)
        .attr('font-size', compact ? 10 : 12).attr('fill', d => x(d.units) > right - 55 ? '#ffffff' : '#333d35').text(d => short(d.units));
}

function drawShares(container, data, state, callbacks) {
    const plot = frame(container, 'Company shares of the tracked annual sales');
    if (!data.annual.some(r => r.total > 0)) return emptyChart(plot);
    const { svg, margin, right, bottom } = plot;
    const x = d3.scaleBand().domain(data.years).range([margin.left, right]).padding(.18);
    const y = d3.scaleLinear().domain([0, 1]).range([bottom, margin.top]);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0%')).tickSize(-(right - margin.left)))
        .call(g => g.select('.domain').remove());
    const ticks = yearTicks(data.years, plot.compact);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${bottom})`)
        .call(d3.axisBottom(x).tickValues(ticks).tickSizeOuter(0));
    svg.append('text').attr('class', 'chart-label').attr('x', margin.left).attr('y', 20).text('Share of tracked units');
    // Zero is used only for absent segment geometry; missing source values remain null.
    const series = d3.stack().keys(COMPANIES).value((row, company) => row.totals[company] ?? 0).offset(d3.stackOffsetExpand)(data.annual);
    series.forEach(series => {
        const rects = svg.append('g').attr('fill', COLORS[series.key]).attr('opacity', opacity(series.key, state))
            .selectAll('rect').data(series.filter(d => d.data.totals[series.key] !== null && d.data.total > 0)).join('rect')
            .attr('x', d => x(d.data.year)).attr('width', x.bandwidth())
            .attr('y', d => y(d[1])).attr('height', d => y(d[0]) - y(d[1]));
        interactions(rects, d => [`${series.key} · ${d.data.year}`, `${d3.format('.1%')(d.data.totals[series.key] / d.data.total)} of tracked sales`, `${exact(d.data.totals[series.key])} / ${exact(d.data.total)} estimated units`, 'Select to follow this year.'], d => callbacks.year(d.data.year));
    });
    svg.selectAll('rect.unavailable-year').data(data.annual.filter(d => !(d.total > 0))).join('rect')
        .attr('x', d => x(d.year)).attr('y', margin.top).attr('width', x.bandwidth())
        .attr('height', bottom - margin.top).attr('fill', 'url(#missing-record)');
    svg.append('rect').attr('x', x(state.focus) - 2).attr('y', margin.top - 3)
        .attr('width', x.bandwidth() + 4).attr('height', bottom - margin.top + 6)
        .attr('fill', 'none').attr('stroke', '#202622').attr('stroke-width', 2).attr('pointer-events', 'none');
    svg.append('text').attr('class', 'chart-label').attr('x', x(state.focus) + x.bandwidth()/2)
        .attr('y', bottom + 38).attr('text-anchor', 'middle').style('font-weight', 700).text(state.focus);
}

function drawHeatmap(container, data, state, callbacks) {
    const plot = frame(container, 'Console sales by year, with unavailable records marked', 165);
    const { svg, margin, right, bottom, compact } = plot;
    const consoles = data.consoles.filter(c => state.hardware === 'All' || c.hardware === state.hardware)
        .sort((a, b) => COMPANIES.indexOf(a.company) - COMPANIES.indexOf(b.company) || a.firstObservedYear - b.firstObservedYear);
    const x = d3.scaleBand().domain(data.years).range([margin.left, right]).padding(.07);
    const y = d3.scaleBand().domain(consoles.map(c => c.id)).range([margin.top, bottom]).padding(.11);
    const lookup = new Map(data.records.map(row => [`${row.console_id}-${row.year}`, row]));
    const max = d3.max(data.records, row => row.units) || 1;
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, max]);
    const cells = consoles.flatMap(c => data.years.map(year => ({ ...c, year, units: lookup.get(`${c.id}-${year}`)?.units ?? null })));
    const rects = svg.selectAll('rect.heat-cell').data(cells).join('rect').attr('class', 'heat-cell')
        .attr('x', d => x(d.year)).attr('y', d => y(d.id)).attr('width', x.bandwidth()).attr('height', y.bandwidth())
        .attr('fill', d => d.units === null ? 'url(#missing-record)' : color(d.units))
        .attr('opacity', d => opacity(d.company, state));
    interactions(rects, d => [`${d.name} · ${d.year}`, d.units === null ? 'No source record. Not treated as zero.' : `${exact(d.units)} estimated units`, 'Select to follow this console and year.'], d => callbacks.console(d.id, d.year));
    svg.selectAll('text.console-name').data(consoles).join('text').attr('class', 'console-name')
        .attr('x', margin.left - 10).attr('y', d => y(d.id) + y.bandwidth()/2 + 4)
        .attr('text-anchor', 'end').attr('font-size', compact ? 11 : 12).attr('fill', d => COLORS[d.company])
        .attr('font-weight', d => d.id === state.console ? 700 : 400).text(d => compact ? d.id : d.name);
    if (y(state.console) !== undefined) svg.append('rect').attr('x', margin.left - 2).attr('y', y(state.console) - 2)
        .attr('width', right - margin.left + 4).attr('height', y.bandwidth() + 4).attr('fill', 'none')
        .attr('stroke', '#202622').attr('stroke-width', 1.5).attr('pointer-events', 'none');
    svg.append('rect').attr('x', x(state.focus) - 1).attr('y', margin.top - 2).attr('width', x.bandwidth() + 2)
        .attr('height', bottom - margin.top + 4).attr('fill', 'none').attr('stroke', '#202622').attr('stroke-width', 1.5).attr('pointer-events', 'none');
    const ticks = yearTicks(data.years, compact);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${bottom})`)
        .call(d3.axisBottom(x).tickValues(ticks).tickSizeOuter(0));
    const legendX = margin.left, legendY = 16;
    d3.range(30).forEach(i => svg.append('rect').attr('x', legendX + i * 3).attr('y', legendY - 9)
        .attr('width', 3).attr('height', 9).attr('fill', color(max * i / 29)));
    svg.append('text').attr('class', 'chart-note').attr('x', legendX + 98).attr('y', legendY).text(`0–${short(max)}${compact ? '' : ' units'}`);
    svg.append('rect').attr('x', legendX + (compact ? 178 : 226)).attr('y', legendY - 10).attr('width', 13).attr('height', 11).attr('fill', 'url(#missing-record)');
    svg.append('text').attr('class', 'chart-note').attr('x', legendX + (compact ? 196 : 245)).attr('y', legendY).text('No record');
}

function drawHandoff(container, data, state, callbacks) {
    const plot = frame(container, 'Console generation comparison using a shared ribbon thickness scale', 160);
    const { svg, margin, right, bottom, compact } = plot;
    const pair = data.pair;
    if (!pair) return emptyChart(plot, 'No console pairs match this hardware type.');
    const pairRows = data.records.filter(r => [pair.old, pair.newer].includes(r.console_id));
    if (!pairRows.some(row => row.units !== null)) return emptyChart(plot, 'No records for this pair in the selected years.');
    const x = yearScale(plot, data.years);
    const band = Math.min((right - margin.left) / Math.max(1, data.years.length - 1), 48);
    const amp = compact ? 44 : 72;
    const max = d3.max(pairRows, row => row.units) || 1;
    const thickness = d3.scaleLinear().domain([0, max]).range([0, amp]);
    const overlap = recordedOverlap(data.records, pair, data.years);
    svg.selectAll('rect.overlap').data(overlap).join('rect').attr('x', year => Math.max(margin.left, x(year) - band / 2))
        .attr('y', margin.top).attr('width', year => Math.min(right, x(year) + band / 2) - Math.max(margin.left, x(year) - band / 2))
        .attr('height', bottom - margin.top).attr('fill', '#e4e9da');
    const centers = [margin.top + (bottom - margin.top) * .3, margin.top + (bottom - margin.top) * .72];
    [pair.old, pair.newer].forEach((id, i) => {
        const consoleInfo = data.consoles.find(c => c.id === id);
        const rows = data.years.map(year => ({ year, units: pairRows.find(r => r.console_id === id && r.year === year)?.units ?? null }));
        const center = centers[i];
        const group = svg.append('g').attr('opacity', opacity(consoleInfo.company, state));
        group.selectAll('rect.missing-span').data(rows.filter(r => r.units === null)).join('rect')
            .attr('x', d => Math.max(margin.left, x(d.year) - band/2)).attr('y', center - amp/2)
            .attr('width', d => Math.min(right, x(d.year) + band/2) - Math.max(margin.left, x(d.year) - band/2))
            .attr('height', amp).attr('fill', 'url(#missing-record)');
        const area = d3.area().defined(d => d.units !== null).x(d => x(d.year))
            .y0(d => center - thickness(d.units)/2).y1(d => center + thickness(d.units)/2);
        group.append('path').datum(rows).attr('d', area).attr('fill', COLORS[consoleInfo.company]).attr('fill-opacity', i === 0 ? .48 : .96);
        const observed = rows.filter(d => d.units !== null);
        // A one-year series still needs a visible mark; it is not an invented neighboring year.
        if (observed.length === 1) group.append('rect').attr('x', x(observed[0].year) - 3)
            .attr('y', center - thickness(observed[0].units)/2).attr('width', 6)
            .attr('height', Math.max(1, thickness(observed[0].units))).attr('fill', COLORS[consoleInfo.company]);
        group.append('text').attr('x', margin.left - 11).attr('y', center - 5).attr('text-anchor', 'end')
            .attr('font-size', compact ? 11 : 12).attr('font-weight', 700).attr('fill', COLORS[consoleInfo.company])
            .text(compact ? id : consoleInfo.name);
        const focused = rows.find(r => r.year === state.focus);
        group.append('text').attr('x', margin.left - 11).attr('y', center + 14).attr('text-anchor', 'end')
            .attr('font-size', compact ? 10 : 12).attr('fill', '#5a655d').text(focused.units === null ? 'No record' : short(focused.units));
        const points = group.selectAll('circle.ribbon-point').data(observed).join('circle')
            .attr('cx', d => x(d.year)).attr('cy', center).attr('r', d => d.year === state.focus ? 5 : 8)
            .attr('fill', d => d.year === state.focus ? '#202622' : 'transparent');
        interactions(points, d => [consoleInfo.name, `${d.year}: ${exact(d.units)} estimated units`, 'Ribbon thickness uses the same scale for both families.'], d => callbacks.year(d.year));
    });
    xAxis(plot, x, data.years);
    focusGuide(plot, x, state);
    svg.append('text').attr('class', 'chart-note').attr('x', margin.left).attr('y', 18)
        .text(`Thickness: 0–${short(max)} units`);
    svg.append('text').attr('class', 'chart-note').attr('x', margin.left).attr('y', 35)
        .text(overlap.length ? `Both families reported in ${overlap.length} selected year${overlap.length === 1 ? '' : 's'}` : 'No shared recorded years in this range');
}

const DRAW = [drawTrends, drawRanking, drawShares, drawHeatmap, drawHandoff];

export function renderChart(container, data, state, callbacks) {
    hideTooltip();
    container.replaceChildren();
    DRAW[state.chapter](container, data, state, callbacks);
    container.setAttribute('aria-busy', 'false');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        d3.select(container).select('svg').style('opacity', .3).transition().duration(280).style('opacity', 1);
    }
}
