# Store listing (copy/paste)

Text for the Chrome Web Store, Edge Add-ons and Firefox Add-ons. Upload `dist/mahi-tahi-helper-<browser>-<version>.zip` from `npm run package`.

## Name
Mahi Tahi Helper

## Summary (max 132 characters)
Faster Mahi Tahi for Scout leaders: sort, filter and export groups to CSV, quick links, event filters and report shortcuts.

## Category
Productivity

## Description
Mahi Tahi Helper makes the Scouts NZ Mahi Tahi website quicker and easier to use for leaders. It only changes how pages look and behave in your own browser.

Groups
- Sort members by last name, first name or section
- Filter by section and search by name
- Download CSV of exactly the members currently shown

Everywhere
- Quick-links bar for Home, Groups, Programme, Events, Calendar, Invites, Achievements, Services, Training, Workshops, Resources, Activities, Reports and Help

Events
- Create Event shortcut
- Filter events by status (Invited, Attending, Not Attending) and search them

Reports
- Attendance report defaults to the current year, term and All Types
- Direct Term 1-4 attendance links for each section
- Single-account reports default to the first account

Privacy: works only on mahitahi.scouts.nz, needs no permissions, and collects or sends no data. Open source: see the project page.

This is an independent community project, not affiliated with or endorsed by Scouts NZ.

## Single purpose (Chrome "Privacy practices" tab)
Improve the usability of the Mahi Tahi website (mahitahi.scouts.nz) for Scout leaders by adding sorting, filtering, navigation shortcuts and CSV export.

## Permission justification
- Host access to `https://mahitahi.scouts.nz/*` (content scripts): required to add the sorting, filtering, quick-link and export features to Mahi Tahi pages. The extension requests no other permissions.
- Remote code: **No**. All code is bundled in the package.

## Data usage disclosures (Chrome)
Tick **none** of the data-collection boxes (the extension does not collect any user data). Tick all three certifications (no selling, no unrelated use, no creditworthiness use).

## URLs
- Homepage / support: the GitHub repository URL
- Privacy policy: `https://github.com/<owner>/<repo>/blob/main/PRIVACY.md`

## Graphics needed
- Icon 128x128: `src/icons/icon-128.png` (placeholder; swap for a logo if you have one, but don't use Scouts NZ logos without permission)
- At least 1 screenshot, 1280x800 (or 640x400), PNG/JPG. **Use a demo or blurred view: no real member names.**
- Small promo tile 440x280 (required by Chrome)
