# Passing the Controller

CSE 478 console-sales project. This is the first working implementation, version 0.1.0, rather than the final submission release.

## Run locally

No npm install or build step is needed. D3 7.9.0 is included locally.

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Run the command from the folder containing `index.html`. Opening the HTML directly with `file://` will prevent CSV loading in most browsers.

## Story and interactions

The opening story year is chosen from an actual leadership change where the bestselling console belongs to a different company than the company leading the tracked totals. In this snapshot that is 2018: PlayStation 4 is the leading individual console, but Nintendo leads the included company records.

The six visualization views are an annual line chart, horizontal console ranking, 100% stacked bars, console/year heatmap, a custom generation comparison using sales ribbons, and an interactive bubble chart for exploring console sales over time. Scrolling introduces them in sequence. Chapter buttons offer direct navigation.

Year bounds and hardware type apply throughout. The story-year slider links the comparisons. Company buttons only highlight; they do not remove records or change percentage denominators. Selecting a console follows it into the heatmap, an appropriate generation pair, and the Timeline Explorer. Marks support pointer hover and keyboard focus. Press Enter or Space on an interactive mark to select it.

The ribbon view uses one thickness scale for two console families and shades their shared recorded years. Missing figures are hatched. It compares sales rather than customer migration. Whether this custom technique satisfies the instructor's innovative-view definition still needs checking against the complete rubric.

The Timeline Explorer uses bubble area to represent annual estimated console sales and color to identify the company. Bubbles sharing a company and year are vertically separated to reduce overlap. Selecting a bubble updates the selected console and story year across the linked views. Hollow circles represent recorded zero sales, while missing records have no bubble.

## Real data and limitations

- Source: [VGChartz Yearly Hardware Comparisons — Global](https://www.vgchartz.com/tools/hw_date.php?ending=Yearly&reg=Global).
- Measurement: estimated annual hardware sell-through units, not manufacturer shipments or game sales.
- Display period: 2006–2025. The incomplete 2026 year is excluded.
- Snapshot: 14 console families, 123 observed console-year records.
- The source tool omits some older platforms, notably PS2 and Game Boy Advance. Labels therefore describe **tracked sales**, not the entire console market. They should not be interpreted as complete historical company totals.
- An absent console-year or blank units field is missing, never an inferred zero. Company totals sum available figures; shares describe those same available figures. A company with no records has a null total. A single first-observed year is not a verified launch date.
- No additional annual values are invented or interpolated into the CSV. Connections between recorded points are chart geometry, not new source observations.
- Hardware and company fields are manually added classifications. Switch families are treated as Hybrid, PSP/DS/3DS/Vita as Handheld, and the remaining systems as Home.

`data/provenance.json` records the source URL, retrieval timestamp, preprocessing, and source HTML fingerprint. `data/raw/vgchartz_yearly_snapshot.json` retains the extracted source series. `data/consoles.json` contains platform metadata. The rows are keyed by console ID and year.

Rebuild from the saved snapshot:

```sh
python3 scripts/prepare_data.py
```

Fetch a new source snapshot only when deliberately updating the figures:

```sh
python3 scripts/prepare_data.py --refresh
```

VGChartz can revise estimates. Review narrative calculations and tests after refreshing. Keep the saved snapshot with the release so the submitted figures remain reproducible.

## Checks

```sh
npm test
```

The tests cover source-to-CSV fidelity, duplicate keys, missing-versus-zero handling, share denominators, hardware filtering, and the story's main numerical comparison.

Before submission, manually check all six chapter buttons; normal scrolling; pointer and keyboard details; hardware/year filters, including empty and single-year selections; company highlighting; console selection; generation pair choices; reset; and phone-width layout. Inspect the browser console for errors.

## GitHub and the December 4 submission

1. Create the course repository and place these files at its root. Share the actual repository URL with the instructor using the course's specified channel. Give the instructor access if it is private.
2. Commit working changes as the team develops them. A suggested initial commit is `Add console sales story with real VGChartz data`.
3. Confirm the full Canvas rubric, team attribution, and innovative-view expectations. This initial version is not a guarantee that every course requirement has been met.
4. When the reviewed final code is ready, commit and push it. Create an annotated tag such as `v1.0.0` on that final commit and push the tag:

```sh
git tag -a v1.0.0 -m "CSE 478 final implementation"
git push origin v1.0.0
```

5. On GitHub, use **Releases → Draft a new release**, select `v1.0.0`, add a concise description and run instructions, then publish. Submit the exact tagged-release URL requested by the course. Make the final tag after review, not on this starter version.

Official reference: [GitHub release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## Credits

Sales estimates belong to VGChartz; consult its terms and methodology. The source figures are not relicensed as original team data. D3 is by Mike Bostock and contributors, distributed under the ISC license in `vendor/D3-LICENSE.txt`. Keep that license with the bundled library.
