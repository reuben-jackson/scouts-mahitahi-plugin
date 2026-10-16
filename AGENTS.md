# AGENTS.md

Guidance for AI coding agents and human maintainers. Read [README.md](README.md) first for purpose, install and release steps.

## Purpose

Mahi Tahi Helper is a browser extension that improves the Scouts NZ Mahi Tahi portal (a Salesforce Lightning/LWC community at `https://mahitahi.scouts.nz`) for leaders. We cannot change Mahi Tahi; we only alter the DOM in the user's own browser. The repository is **public and standalone**: no backend, database, accounts, secrets or analytics.

## Hard rules

- **No real data in the repo.** No member names, account/record IDs, screenshots, HTML dumps or test fixtures from a real group. Use obviously fake data.
- **No network calls, no storage, no extra permissions.** The manifest requests no permissions and matches only `https://mahitahi.scouts.nz/*`. Adding either is a major decision: update README's privacy section and get the owner's approval.
- **Don't break Mahi Tahi.** Prefer delegating to Salesforce's own controls (e.g. clicking its Create Event button) over reimplementing behaviour. Never submit forms or change data on the user's behalf.
- **Medical and dietary warnings stay out of exports.** CSV export includes only what's listed in the README.
- Escape/neutralise anything written to CSV (see `buildCsv`); build DOM with `createElement`/`textContent`, never `innerHTML` with page-derived text.

## Layout

- `src/` is the only place feature code lives; it's shared by Chrome, Edge and Firefox. Don't fork code per browser.
- `manifests/{chrome,edge,firefox}.json` are templates; `__VERSION__` is replaced at build time. Keep them in sync except for Firefox's `browser_specific_settings`.
- `dist/` is generated and git-ignored. Never hand-edit it.
- `src/page-hook.js` runs in the page's MAIN world (to patch `history` and observe XHR); everything else runs in the isolated content-script world. They communicate only via `window.postMessage` with `source: "mahi-tahi-helper"`.

## Commands

```bash
npm run build                # dist/<browser>/
npm run package              # plus zips
npm run bump -- patch|minor|major
```

## Workflow for any change

1. Edit `src/` (Chrome is the primary target and the one to test manually).
2. Bump the version (`npm run bump -- ...`) and fill in `CHANGELOG.md`. Every user-visible change gets a version and a changelog line.
3. `npm run build`, load `dist/chrome` unpacked, test on Mahi Tahi.
4. If the change uses an API that may differ in Firefox, check it still works there (Firefox 128+ is required for `world: "MAIN"` content scripts).
5. Update README's feature table if features changed.

There is no automated test suite (the portal needs a login). `node --check src/content.js` catches syntax errors.

## Code style

Match the existing code: IIFE with `"use strict"`, 4-space indent, double quotes, small functions each with a one-line `/** ... */` doc comment, no frameworks or build-time transpiling. The extension must re-apply itself after Salesforce re-renders (see `observePageChanges`), and enhancements must be idempotent.

## DOM assumptions

These are the most likely things to break when Mahi Tahi updates. Check here first.

| Feature | Selector / source |
| --- | --- |
| Member list | `c-scgm_memberview` |
| Member row | `c-scgm_member` |
| Member name | direct text node of `.slds-float_left` inside the row (child spans are warning icons/text and are excluded) |
| Member section | `.slds-float_right` inside the row |
| Events hub nav | `c-events-hub button.hubNavigatorItem[data-view="Overview"]` |
| Create Event button | `c-events-hub button[name="newEventButton"], c-events-hub button.newEventButton` |
| Event display | `c-events-hub-events-display .eventsDisplay`, `.hubHeaderButton`, `.eventsGrid > c-events-hub-tile`, `.statusBar p` |
| Report flows | `flowruntime-flow` with `select[name="Year" / "Term" / "Event_Type" / "SelectedAccount"]` |
| Attendance accounts | Aura XHR responses (`/sfsites/aura`) containing flowLabel `Community - Reports Attendance`, field `SelectedAccount` |
| Attendance report URL | `/apex/CR_ProgrammeNightAttendance?groupId=&term=&eventType=` |
| Routes | `/s/`, `/s/my-groups`, `/s/events?ep=...`, `/s/reports`, etc. (quick-links list in `content.js`) |

Account IDs are discovered per user at runtime from their own session and must never be hard-coded.
