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
| Event Participants | Attendee status dropdown below Search attendees: All, Attending, Not Attending or Invited |
| Achievements | Search individuals by name; filter All / Leader / Parent Helper using roles learned from visited group lists |
| Reports | Attendance report defaults to current year, term and All Types; direct Term 1-4 attendance links per section |
| Reports | Single-account reports default to the first account instead of "None" |
| Reports | Treasurer CSV to Xero or MYOB AccountRight import, printable HTML invoices and plain-text email drafts |

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### About the CSV download

- Columns: Name, First name(s), Last name, Section. The first/last split assumes the last word is the surname, so double-barrelled or multi-word surnames may need tidying.
- The file is created **entirely in your browser** and saved to your Downloads folder. Nothing is sent anywhere.
- It contains members' names (including youth). Treat it as personal information: store it securely, share it only as your group's privacy policy allows, and delete it when you're finished.
- Medical and dietary warnings shown on the page are deliberately **not** exported.

### Role filters

Visit your group member lists before using the Achievements type filter. The helper remembers displayed full names and all explicit role labels in the current tab's JavaScript memory. Any role containing "leader" counts as Leader; otherwise an explicit "Parent Helper" role counts as Parent Helper. Unknown roles remain visible under All. Names are matched ignoring case and extra spaces; people with identical full names cannot be distinguished. Roles accumulate during normal portal navigation and clear on refresh or tab closure. No roles are inferred from photographs, saved to browser storage, or sent anywhere.

### Xero and MYOB AccountRight invoice conversion

On Reports, open **Create Xero or MYOB invoice import from Treasurer CSV**:

1. Run the Treasurer report and choose **Save as CSV**. Choose that downloaded file in the converter.
2. Choose Xero or MYOB AccountRight Desktop. For Xero, go to Invoices > Import > Download template file and choose that sales invoice CSV template. Its exact headings and order are preserved; any example rows are ignored. MYOB does not need a template.
3. Check the column mappings. Contact First Name and Contact Last Name are selected as the member name by default. Choose whether the billing contact is the family contact or the member. Each selected member gets a separate invoice, including siblings sharing a contact.
4. Enter the exact account code and tax setting from Xero or AccountRight. The defaults are **Term fee**, **140 NZD**, **tax inclusive**, invoice date today and due date today plus 14 calendar days. Tax is not calculated by the converter; the accounting package calculates it using the selected tax setting and basis.
5. Set an unused invoice prefix and starting number. AccountRight invoice numbers are limited to eight characters. The converter cannot check existing invoice numbers or contact records in either package.
6. Choose **Review invoices**, correct the contact details to match existing customer records, and deselect members who should not be charged. Billing status is shown for review; everyone is initially selected. No discounts or prorating are inferred from source notes.
7. Confirm the review and download the CSV. For Xero, import with the same tax-inclusive or tax-exclusive choice. For AccountRight, import it as comma-separated **Sales > Professional** data with a header record; the file includes blank rows between invoices and converts the chosen due date to a number of days. Review every imported invoice before approving or sending it.
8. Optionally download a standalone HTML file containing one printable invoice per page, or a text file containing separate email drafts. The extension does not send email; review and send drafts manually.

One fee is charged per selected member. Repeated member IDs with identical billing details are collapsed; conflicting duplicates block export. Without an ID, matching full name and email are used for duplicate detection, so check names carefully. The preview reports removed duplicates. Up to 500 invoices are allowed per file, and local input files are limited to 5 MB.

Only names and mapped billing email addresses are exported from the source. Dates of birth, billing comments, medical information and other source columns are excluded. Treasurer files, member details, review edits and generated invoices remain in this tab's memory and are discarded on leaving Reports or refreshing. Reusable configuration such as supplier details, payment instructions, fee defaults and provider-specific account/tax settings is saved in extension-owned local storage. There are no network calls, accounting logins or analytics. The MYOB export targets AccountRight Desktop 2011 or later and requires matching customer cards, account numbers and GST codes to exist already.

See [Xero's import guidance](https://central.xero.com/0/article/Import-customer-invoices-GL) and [MYOB AccountRight's import guidance](https://www.myob.com/nz/support/myob-business/import-export/importing-data?productview=Desktop). Run `npm test` for synthetic-data conversion tests.

## Privacy and permissions

- Runs only on `https://mahitahi.scouts.nz/*`.
- Requests only the `storage` permission to retain reusable invoice configuration in the browser profile. It has no background process, analytics or remote servers.
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
