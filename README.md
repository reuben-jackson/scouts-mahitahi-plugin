# Mahi Tahi Helper

A free, open-source browser extension that makes [Mahi Tahi](https://mahitahi.scouts.nz) (the Scouts NZ Salesforce portal) quicker and easier to use for **leaders**.

Mahi Tahi is run by Scouts NZ and we have no control over it. This extension only changes how the pages *look and behave in your own browser*. It does not change Mahi Tahi itself, and it is not affiliated with or endorsed by Scouts NZ. Parents and youth members don't need it.

## What it does

| Where | Feature |
| --- | --- |
| Groups | Sort by last name, first name or section; filter by section; search by name |
| Groups | **Download CSV** of exactly the members currently shown (after your filters and sort) |
| Groups | "Showing X of Y" counter |
| Every page | Black quick-links bar (Home, Groups, Programme, Events, Calendar, Invites, Achievements, Services, Training, Workshops, Resources, Activities, Reports, Help) |
| Events | Create Event shortcut; status checkboxes (Invited / Attending / Not Attending) and live search |
| Reports | Attendance report defaults to current year, term and All Types; direct Term 1-4 attendance links per section |
| Reports | Single-account reports default to the first account instead of "None" |

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### About the CSV download

- Columns: Name, First name(s), Last name, Section. The first/last split assumes the last word is the surname, so double-barrelled or multi-word surnames may need tidying.
- The file is created **entirely in your browser** and saved to your Downloads folder. Nothing is sent anywhere.
- It contains members' names (including youth). Treat it as personal information: store it securely, share it only as your group's privacy policy allows, and delete it when you're finished.
- Medical and dietary warnings shown on the page are deliberately **not** exported.

## Privacy and permissions

- Runs only on `https://mahitahi.scouts.nz/*`.
- Requests **no** browser permissions, has no background process, no analytics, no remote servers and no stored data.
- Reads only what is already displayed to you on the page, using your existing login.
- The whole source is in `src/` and is small enough to read; please do.

## Install

Pre-built zips are attached to each [GitHub release](../../releases). Or build them yourself (see below).

### Chrome (primary)

1. Unzip `mahi-tahi-helper-chrome-<version>.zip` to a permanent folder (Chrome stops loading it if the folder is moved or deleted).
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Reload Mahi Tahi.

### Edge

Same as Chrome, using `mahi-tahi-helper-edge-<version>.zip` at `edge://extensions` (turn on **Developer mode**, then **Load unpacked**).

### Firefox (128 or newer)

Firefox only keeps unsigned extensions until it restarts:

1. Unzip `mahi-tahi-helper-firefox-<version>.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and pick the `manifest.json` inside the folder.

For a permanent install the extension must be signed by Mozilla (see "Publishing" below).

### Updating

Download the new version, replace the folder contents (or load the new folder), and click the reload icon on the extension's card. Check the version number on that card.

## Build from source

Requires [Node.js](https://nodejs.org) 18+. There are no dependencies to install.

```bash
npm run build      # creates dist/chrome, dist/edge, dist/firefox
npm run package    # same, plus a zip for each browser in dist/
```

## Project layout

```
src/            The extension code, shared by all browsers (edit this)
  content.js      Page enhancements (runs in the extension's isolated world)
  page-hook.js    Tiny script in the page's own world; watches route changes and report data
  styles.css      Styling
manifests/      One manifest template per browser (version is injected at build time)
scripts/        build.mjs (build + zip) and bump.mjs (version bump)
dist/           Build output (git-ignored)
CHANGELOG.md    Release history
AGENTS.md       Guidance for maintainers and AI coding agents
```

Chrome is the primary target. Edge is Chromium-based, so it uses the same code and a near-identical manifest. Firefox uses the same code with a Firefox-specific manifest (it needs an add-on ID and a minimum version). Develop and test in Chrome, run `npm run build`, and the other browsers follow automatically. Browser-specific code should be avoided; if it is ever unavoidable, keep it behind a feature check in `src/`.

## Versioning and releasing

The single source of truth for the version is `version` in `package.json`; the build copies it into every manifest. We use [Semantic Versioning](https://semver.org).

1. `npm run bump -- minor` (or `patch` / `major`). This updates `package.json` and adds a stub entry to `CHANGELOG.md`.
2. Fill in the changelog entry.
3. `npm run package` and test the Chrome build.
4. Commit and push, then tag and push the tag:
   ```bash
   git tag v1.6.1
   git push origin v1.6.1
   ```
5. The [Release workflow](.github/workflows/release.yml) then builds the zips and publishes a GitHub release automatically, using the matching `CHANGELOG.md` entry as the release notes. The tag must match the `package.json` version (with a `v` prefix) or the workflow fails.

The first time, check the repository's **Settings > Actions > General > Workflow permissions** allows read and write (the workflow requests `contents: write` itself, which is normally enough).

Share the link to the repository's **Releases** page with the community; users download the zip for their browser and follow the install steps above.

## Maintaining

Mahi Tahi can change without warning, which is the usual reason this breaks. The extension depends on the page's element names, listed in [AGENTS.md](AGENTS.md#dom-assumptions). If a feature stops working:

1. Open Mahi Tahi, right-click the broken area, **Inspect**, and compare to the selectors in `AGENTS.md` and `src/content.js`.
2. Update the selector, build, reload the extension, test.
3. Release a patch version.

## Publishing (optional)

Chrome Web Store, Edge Add-ons and Firefox Add-ons (addons.mozilla.org) all accept the zips from `npm run package`, and would give automatic updates and signed Firefox installs. Store review and developer accounts are the owner's call; the extension isn't published to any store yet.

## Contributing

Issues and pull requests are welcome. Please **never** include real member data (names, screenshots of real groups) in issues or code. Read [AGENTS.md](AGENTS.md) first.

## Licence

[MIT](LICENSE). Not affiliated with Scouts NZ. "Scouts" and "Mahi Tahi" belong to their respective owners.
