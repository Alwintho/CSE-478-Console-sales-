"""Rebuild the course CSV from a saved VGChartz series snapshot.

Use --refresh to fetch a new source snapshot. Normal runs use the checked-in
snapshot so the figures shown in a tagged release remain reproducible.
"""

import argparse
import csv
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.vgchartz.com/tools/hw_date.php?ending=Yearly&reg=Global'
METADATA = {
    'PS3': ('PlayStation 3', 'Sony', 'Home'),
    'PSP': ('PlayStation Portable', 'Sony', 'Handheld'),
    'PSV': ('PlayStation Vita', 'Sony', 'Handheld'),
    'PS4': ('PlayStation 4', 'Sony', 'Home'),
    'PS5': ('PlayStation 5', 'Sony', 'Home'),
    'X360': ('Xbox 360', 'Microsoft', 'Home'),
    'XOne': ('Xbox One', 'Microsoft', 'Home'),
    'XS': ('Xbox Series X/S', 'Microsoft', 'Home'),
    'Wii': ('Wii', 'Nintendo', 'Home'),
    'WiiU': ('Wii U', 'Nintendo', 'Home'),
    'DS': ('Nintendo DS', 'Nintendo', 'Handheld'),
    '3DS': ('Nintendo 3DS', 'Nintendo', 'Handheld'),
    'NS': ('Nintendo Switch', 'Nintendo', 'Hybrid'),
    'NS2': ('Nintendo Switch 2', 'Nintendo', 'Hybrid'),
}


def extract(html):
    series = []
    for code, body in re.findall(r"name:'([^']+)'\s*,\s*data:\s*\[(.*?)\]\s*\}", html, re.S):
        if code not in METADATA:
            raise ValueError(f'Unrecognized platform: {code}. Add reviewed metadata first.')
        points = []
        for timestamp, units in re.findall(r'x:\s*(\d+)\s*,\s*y:\s*(null|\d+)', body):
            year = datetime.fromtimestamp(int(timestamp) / 1000, timezone.utc).year
            points.append({'year': year, 'units': None if units == 'null' else int(units)})
        if not points:
            raise ValueError(f'No records extracted for {code}')
        series.append({'console_id': code, 'points': points})
    if len(series) != len(METADATA):
        raise ValueError(f'Expected {len(METADATA)} series, received {len(series)}. Inspect the source.')
    return series


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--from-html', type=Path, help='Use a source HTML already downloaded for review.')
    args = parser.parse_args()
    raw_path = ROOT / 'data/raw/vgchartz_yearly_snapshot.json'
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    if args.refresh or args.from_html:
        html = args.from_html.read_text() if args.from_html else urllib.request.urlopen(SOURCE, timeout=30).read().decode('utf-8')
        snapshot = {
            'source_url': SOURCE,
            'retrieved_at': datetime.now(timezone.utc).isoformat(),
            'source_html_sha256': hashlib.sha256(html.encode()).hexdigest(),
            'measure': 'VGChartz estimated worldwide annual hardware sell-through units',
            'series': extract(html),
        }
        raw_path.write_text(json.dumps(snapshot, indent=2) + '\n')
    else:
        snapshot = json.loads(raw_path.read_text())

    rows, consoles, keys = [], [], set()
    for series in snapshot['series']:
        code = series['console_id']
        name, company, hardware = METADATA[code]
        points = series['points']
        consoles.append({
            'id': code, 'name': name, 'company': company, 'hardware': hardware,
            'firstObservedYear': min(p['year'] for p in points),
            'lastObservedYear': max(p['year'] for p in points if p['year'] <= 2025),
        })
        for point in points:
            if not 2006 <= point['year'] <= 2025:
                continue
            key = (code, point['year'])
            if key in keys:
                raise ValueError(f'Duplicate console-year: {key}')
            keys.add(key)
            if point['units'] is not None and point['units'] < 0:
                raise ValueError(f'Negative units: {key}')
            rows.append({
                'year': point['year'], 'console_id': code, 'console': name,
                'company': company, 'hardware_type': hardware,
                'units': '' if point['units'] is None else point['units'],
                'source_url': SOURCE,
            })

    rows.sort(key=lambda r: (r['year'], r['company'], r['console_id']))
    with (ROOT / 'data/console_sales.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=['year', 'console_id', 'console', 'company', 'hardware_type', 'units', 'source_url'])
        writer.writeheader()
        writer.writerows(rows)
    (ROOT / 'data/consoles.json').write_text(json.dumps(consoles, indent=2) + '\n')
    (ROOT / 'data/provenance.json').write_text(json.dumps({
        'source': 'VGChartz Yearly Hardware Comparisons — Global',
        'source_url': SOURCE, 'methodology_url': 'https://www.vgchartz.com/methodology.php',
        'retrieved_at': snapshot['retrieved_at'], 'source_html_sha256': snapshot['source_html_sha256'],
        'row_count': len(rows), 'console_count': len(consoles), 'start_year': 2006, 'end_year': 2025,
        'excluded': ['2026: incomplete calendar year', 'Platforms absent from this source tool, including PS2 and Game Boy Advance'],
        'preprocessing': ['Decode source timestamps in UTC to obtain calendar years.', 'Keep source annual figures unchanged.', 'Limit the displayed period to 2006–2025.', 'Expand platform abbreviations and add manually reviewed company and hardware classifications.', 'Retain missing observations as missing; never manufacture zero sales.'],
    }, indent=2) + '\n')
    print(f'Prepared {len(rows)} source records for {len(consoles)} console families.')


if __name__ == '__main__':
    main()
