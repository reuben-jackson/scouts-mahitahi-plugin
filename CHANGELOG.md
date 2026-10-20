# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR for breaking changes, MINOR for new features, PATCH for fixes (including fixes for Mahi Tahi page changes).

## 1.9.0 - 2026-10-20

- Added MYOB AccountRight Desktop Professional Sales invoice export to the existing Treasurer CSV converter.
- Validates MYOB customer-name, invoice-number, account, GST and due-term limits and separates invoice transactions with blank rows.
- Defaults the Treasurer report's Contact First Name and Contact Last Name mappings and Xero's 15% GST on Income tax rate.

## 1.8.0 - 2026-10-20

- Added a local Treasurer CSV to Xero invoice converter on Reports, with fee, description, account, tax, dates, numbering, editable contact review and duplicate-member checks.
- Preserves the headings and order of the user's Xero sales invoice template. No data is uploaded or stored.

## 1.7.0 - 2026-10-20

- Added case-insensitive name search to the Achievements individual selection list.
- Added All / Leader / Parent Helper filtering using explicit roles learned from visited group lists, held only in tab memory until refresh. Full role text is retained; unknown roles appear only under All.
- Added an attendee status dropdown below Search attendees on event Participants pages: All, Attending, Not Attending and Invited. Works alongside the existing name search.

## 1.6.1 - 2026-10-16

- Added extension icons, a privacy policy (PRIVACY.md) and store listing text for submitting to the Chrome, Edge and Firefox stores.

## 1.6.0 - 2026-10-16

- Added **Download CSV** to the Groups member list: exports exactly the members currently shown, in the current sort order.
- Added a "Showing X of Y" counter to the Groups filter box.
- Restructured the project: one shared source for Chrome, Edge and Firefox, with a build script.
- Added Edge and Firefox builds.

## 1.5.1

- Removed the non-working Add Event quick link.
- Removed the direct attendance-report panel whenever navigation leaves the Reports page.

## 1.5.0

- Removed the Hawke Sea Scouts account IDs from the extension.
- Added per-user report account discovery from Salesforce's Attendance Report response.
- Defaulted both single-account report forms and removed their None options.
- Added Add Event to the quick-links bar.

## 1.4.1

- Replaced the single status dropdown with checkboxes for Invited, Attending and Not Attending.
- Placed the status choices and event search side by side on desktop-sized screens.
- Moved the direct attendance-report links inside the page's main content region.

## 1.4.0

- Added All statuses, Invited, Attending and Not Attending filtering to the Events grid.
- Added live event text search that hides non-matching event tiles.
- Keeps active filter values when Salesforce rerenders the Events view.

## 1.3.0

- Added a Direct attendance reports panel that bypasses the Salesforce Flow form.
- Added current-year Term 1â€“4 All Types report links for every captured Hawke Sea Scouts section.
- Highlights the current three-month term.

## 1.2.1

- Added sensible defaults to the Attendance Report without replacing user selections.
- Year defaults to the current year, and Term defaults to the quarter containing the current month.
- Event Type defaults to All Types so the report form is closer to ready to run.

## 1.2.0

- Removed all extension-added styling and inserted links from Salesforce's main navigation.
- Added a separate black quick-links bar across the very top of the page.
- Included all 13 requested destinations and retained SPA rerender handling.

## 1.1.2

- Removed the redundant More button.
- Removed left padding from the navigation items and replaced it with consistent spacing between buttons.
- Centered each label and added a subtle border around each navigation button.

## 1.1.1

- Changed main navigation items to 10-pixel left padding.
- Kept Salesforce top-level links and both added links visible in the main navigation.
- Allowed long labels such as Programme & Events to wrap in compact menu boxes.

## 1.1.0

- Added the Events-page Create Event shortcut below Overview.
- Added compact top navigation with Workshops and Online Modules links.
- Added the requested 30 Ã— 30 status-icon styling.
- Retained member sorting, section filtering, name search and rerender handling.

