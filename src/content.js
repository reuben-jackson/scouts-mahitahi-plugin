(() => {
    "use strict";

    const MEMBER_VIEW_SELECTOR = "c-scgm_memberview";
    const MEMBER_SELECTOR = "c-scgm_member";
    const CONTROLS_CLASS = "mahi-tahi-helper-controls";
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const quickLinks = [
        ["Home", "/s/"],
        ["Groups", "/s/my-groups"],
        ["Programme", "/s/events?ep=Programme"],
        ["Events", "/s/events?ep=Events"],
        ["Calendar", "/s/events?ep=Calendar"],
        ["Invites", "/s/events?ep=Section"],
        ["Achievements", "/s/achievements"],
        ["Services", "/s/services"],
        ["Training", "/s/training"],
        ["Workshops", "/s/workshops"],
        ["Resources", "/s/resources"],
        ["Activites", "/s/activities"],
        ["Reports", "/s/reports"],
        ["Help", "/s/help"]
    ];
    let attendanceSections = [];
    const knownIndividualRoles = new Map();
    const eventFilters = {
        statuses: new Set(["Invited", "Attending", "Not Attending"]),
        search: ""
    };

    /** Enhances every supported feature currently present on the page. */
    function enhancePage() {
        rememberVisibleRoles();
        enhanceMemberLists();
        enhanceQuickLinks();
        enhanceEventsNavigation();
        enhanceEventFilters();
        enhanceAttendeeFilters();
        enhanceAchievementSearch();
        enhanceAttendanceReportDefaults();
        enhanceSingleAccountReportDefaults();
        enhanceAttendanceReportShortcuts();
    }

    /** Enhances every member list currently present on the page. */
    function enhanceMemberLists() {
        document.querySelectorAll(MEMBER_VIEW_SELECTOR).forEach(enhanceMemberList);
    }

    /** Adds controls to one member list without duplicating an existing enhancement. */
    function enhanceMemberList(memberView) {
        if (memberView.querySelector(`:scope > .${CONTROLS_CLASS}`)) {
            return;
        }

        const members = getMembers(memberView);
        if (members.length === 0) {
            return;
        }

        const controls = createControls(memberView);
        const memberContainer = members[0].parentElement;
        memberView.insertBefore(controls, memberContainer);
        applyView(memberView);
    }

    /** Creates the sorting, section filtering, and name search controls. */
    function createControls(memberView) {
        const controls = document.createElement("div");
        controls.className = CONTROLS_CLASS;

        const sortSelect = createSelect("Sort", [
            ["lastName", "Last name"],
            ["firstName", "First name"],
            ["section", "Section"]
        ]);
        sortSelect.classList.add("mahi-tahi-helper-sort");

        const sectionSelect = createSelect("Section", [["", "All sections"]]);
        sectionSelect.classList.add("mahi-tahi-helper-section");
        populateSections(sectionSelect, getMembers(memberView));

        const searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.placeholder = "Search name…";
        searchInput.className = "mahi-tahi-helper-search slds-input";
        searchInput.setAttribute("aria-label", "Search member name");

        sortSelect.addEventListener("change", () => applyView(memberView));
        sectionSelect.addEventListener("change", () => applyView(memberView));
        searchInput.addEventListener("input", () => applyView(memberView));

        const count = document.createElement("span");
        count.className = "mahi-tahi-helper-count";
        count.setAttribute("aria-live", "polite");

        controls.append(
            createControlGroup("Sort", sortSelect),
            createControlGroup("Section", sectionSelect),
            createControlGroup("Find", searchInput),
            count
        );
        return controls;
    }

    /** Creates a labelled control group that fits the existing Salesforce styling. */
    function createControlGroup(labelText, control) {
        const group = document.createElement("label");
        group.className = "mahi-tahi-helper-field";

        const label = document.createElement("span");
        label.className = "mahi-tahi-helper-label";
        label.textContent = labelText;

        group.append(label, control);
        return group;
    }

    /** Creates a select element from value and label pairs. */
    function createSelect(ariaLabel, options) {
        const select = document.createElement("select");
        select.className = "slds-select";
        select.setAttribute("aria-label", ariaLabel);

        options.forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
        return select;
    }

    /** Populates the section selector from the sections found in the current member list. */
    function populateSections(select, members) {
        const sections = [...new Set(members.map(getSection).filter(Boolean))]
            .sort((a, b) => collator.compare(a, b));

        sections.forEach(section => {
            const option = document.createElement("option");
            option.value = section;
            option.textContent = section;
            select.appendChild(option);
        });
    }

    /** Applies the selected sort order and filters to a member list. */
    function applyView(memberView) {
        const controls = memberView.querySelector(`:scope > .${CONTROLS_CLASS}`);
        if (!controls) {
            return;
        }

        const members = getMembers(memberView);
        if (members.length === 0) {
            return;
        }

        let visibleCount = 0;
        const sortBy = controls.querySelector(".mahi-tahi-helper-sort").value;
        const sectionFilter = controls.querySelector(".mahi-tahi-helper-section").value;
        const searchText = controls.querySelector(".mahi-tahi-helper-search").value.trim().toLocaleLowerCase();

        members.sort((a, b) => compareMembers(a, b, sortBy));

        const memberContainer = members[0].parentElement;
        members.forEach(member => {
            const name = getMemberName(member);
            const section = getSection(member);
            const matchesSection = !sectionFilter || section === sectionFilter;
            const matchesSearch = !searchText || name.toLocaleLowerCase().includes(searchText);

            member.hidden = !(matchesSection && matchesSearch);
            visibleCount += member.hidden ? 0 : 1;
            memberContainer.appendChild(member);
        });

        controls.querySelector(".mahi-tahi-helper-count").textContent = `Showing ${visibleCount} of ${members.length}`;
    }

    /** Compares two members using the requested sort mode. */
    function compareMembers(a, b, sortBy) {
        const aName = getMemberName(a);
        const bName = getMemberName(b);

        if (sortBy === "section") {
            const sectionComparison = collator.compare(getSection(a), getSection(b));
            return sectionComparison || collator.compare(getLastName(aName), getLastName(bName)) || collator.compare(aName, bName);
        }
        if (sortBy === "firstName") {
            return collator.compare(aName, bName);
        }
        return collator.compare(getLastName(aName), getLastName(bName)) || collator.compare(aName, bName);
    }

    /** Returns all member components belonging to a member view. */
    function getMembers(memberView) {
        return Array.from(memberView.querySelectorAll(MEMBER_SELECTOR));
    }

    /** Extracts the visible member name while excluding warning and accessibility text. */
    function getMemberName(member) {
        const nameElement = member.querySelector(".slds-float_left");
        if (!nameElement) {
            return "";
        }

        // The first text node contains the displayed name; child spans are warning icons/text.
        const textNode = Array.from(nameElement.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        return textNode?.textContent.trim() ?? "";
    }

    /** Extracts the member's section label from the right-hand side of the row. */
    function getSection(member) {
        return member.querySelector(".slds-float_right")?.textContent.trim() ?? "";
    }

    /** Returns the final whitespace-separated word of a displayed name for surname sorting. */
    function getLastName(name) {
        const parts = name.trim().split(/\s+/);
        return parts.at(-1) ?? "";
    }

    /** Adds an independent quick-links bar before the Salesforce page content. */
    function enhanceQuickLinks() {
        if (!document.body || document.querySelector(".mahi-tahi-helper-quick-links")) {
            return;
        }

        const bar = document.createElement("nav");
        bar.className = "mahi-tahi-helper-quick-links";
        bar.setAttribute("aria-label", "Mahi Tahi quick links");
        quickLinks.forEach(([label, path]) => {
            const link = document.createElement("a");
            link.href = path;
            link.textContent = label;
            bar.appendChild(link);
        });
        document.body.prepend(bar);
    }

    /** Returns whether the current route is the Events view of the events hub. */
    function isEventsView() {
        return location.pathname.replace(/\/$/, "") === "/s/events"
            && new URLSearchParams(location.search).get("ep") === "Events";
    }

    /** Adds a shortcut below Overview that delegates to Salesforce's original Create Event button. */
    function enhanceEventsNavigation() {
        const existingShortcut = document.querySelector(".mahi-tahi-helper-create-event");
        if (!isEventsView()) {
            existingShortcut?.remove();
            return;
        }

        const overviewButton = document.querySelector('c-events-hub button.hubNavigatorItem[data-view="Overview"]');
        if (!overviewButton || existingShortcut) {
            return;
        }

        const shortcut = document.createElement("button");
        shortcut.type = "button";
        shortcut.className = "hubNavigatorItem unselectedNavigatorItem mahi-tahi-helper-create-event";
        shortcut.textContent = "Create Event";
        shortcut.setAttribute("aria-label", "Create Event");
        shortcut.addEventListener("click", triggerOriginalCreateEvent);
        overviewButton.insertAdjacentElement("afterend", shortcut);
    }

    /** Clicks the current original Salesforce Create Event button when the shortcut is used. */
    function triggerOriginalCreateEvent() {
        document.querySelector('c-events-hub button[name="newEventButton"], c-events-hub button.newEventButton')?.click();
    }

    /** Adds status and text filters beside each rendered Events view heading. */
    function enhanceEventFilters() {
        document.querySelectorAll("c-events-hub-events-display .eventsDisplay").forEach(eventsDisplay => {
            let controls = eventsDisplay.querySelector(":scope > .mahi-tahi-helper-event-filters");
            if (!controls) {
                controls = createEventFilterControls(eventsDisplay);
                const heading = eventsDisplay.querySelector(":scope > .hubHeaderButton");
                heading?.insertAdjacentElement("afterend", controls);
            }

            applyEventFilters(eventsDisplay);
        });
    }

    /** Creates the event status selector and live search input. */
    function createEventFilterControls(eventsDisplay) {
        const controls = document.createElement("div");
        controls.className = "mahi-tahi-helper-event-filters";

        const statusGroup = createEventStatusCheckboxes(eventsDisplay);

        const searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.className = "mahi-tahi-helper-event-search slds-input";
        searchInput.placeholder = "Search events…";
        searchInput.value = eventFilters.search;
        searchInput.setAttribute("aria-label", "Search events");

        searchInput.addEventListener("input", () => {
            eventFilters.search = searchInput.value;
            applyEventFilters(eventsDisplay);
        });

        controls.append(
            statusGroup,
            createControlGroup("Find event", searchInput)
        );
        return controls;
    }

    /** Creates checkboxes that allow any combination of event registration statuses. */
    function createEventStatusCheckboxes(eventsDisplay) {
        const fieldset = document.createElement("fieldset");
        fieldset.className = "mahi-tahi-helper-event-statuses";

        const legend = document.createElement("legend");
        legend.className = "mahi-tahi-helper-label";
        legend.textContent = "Status";
        fieldset.appendChild(legend);

        ["Invited", "Attending", "Not Attending"].forEach(status => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = status;
            checkbox.checked = eventFilters.statuses.has(status);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    eventFilters.statuses.add(status);
                } else {
                    eventFilters.statuses.delete(status);
                }
                applyEventFilters(eventsDisplay);
            });
            label.append(checkbox, document.createTextNode(status));
            fieldset.appendChild(label);
        });
        return fieldset;
    }

    /** Shows only event tiles matching the selected registration status and search text. */
    function applyEventFilters(eventsDisplay) {
        const grid = eventsDisplay.querySelector(":scope > .eventsGrid");
        if (!grid) {
            return;
        }

        const searchText = eventFilters.search.trim().toLocaleLowerCase();
        grid.querySelectorAll(":scope > c-events-hub-tile").forEach(tile => {
            const status = tile.querySelector(".statusBar p")?.textContent.trim() ?? "";
            const searchableText = tile.textContent.replace(/\s+/g, " ").trim().toLocaleLowerCase();
            const matchesStatus = eventFilters.statuses.has(status);
            const matchesSearch = !searchText || searchableText.includes(searchText);
            tile.hidden = !(matchesStatus && matchesSearch);
        });
    }

    /** Normalises displayed names for matching between group and achievement lists. */
    function normaliseIndividualName(name) {
        return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    }

    /** Remembers explicit roles from visited group lists in this tab's memory only. */
    function rememberVisibleRoles() {
        document.querySelectorAll(MEMBER_SELECTOR).forEach(member => {
            const name = normaliseIndividualName(getMemberName(member));
            const role = getSection(member);
            if (!name || !role) {
                return;
            }
            if (!knownIndividualRoles.has(name)) {
                knownIndividualRoles.set(name, new Set());
            }
            knownIndividualRoles.get(name).add(role);
        });
    }

    /** Classifies only roles explicitly learned from a visited group list. */
    function getKnownIndividualType(name) {
        const roles = [...(knownIndividualRoles.get(normaliseIndividualName(name)) ?? [])];
        if (roles.some(role => /leader/i.test(role))) {
            return "Leader";
        }
        return roles.some(role => /\bparent\s+helper\b/i.test(role)) ? "Parent Helper" : "";
    }

    /** Adds name and learned role filters to the achievement individual selection list. */
    function enhanceAchievementSearch() {
        document.querySelectorAll("c-achievement-manager").forEach(manager => {
            const firstIndividual = manager.querySelector(".individualOptionContainer");
            let controls = manager.querySelector(".mahi-tahi-helper-achievement-search");
            if (!firstIndividual) {
                controls?.remove();
                return;
            }
            if (!controls) {
                const input = document.createElement("input");
                input.type = "search";
                input.className = "slds-input";
                input.placeholder = "Search by name…";
                input.setAttribute("aria-label", "Search individuals by name");
                controls = createControlGroup("Find person", input);
                controls.classList.add("mahi-tahi-helper-achievement-search");
                const type = createSelect("Individual type", [["", "All"], ["Leader", "Leader"], ["Parent Helper", "Parent Helper"]]);
                type.classList.add("mahi-tahi-helper-individual-type");
                type.addEventListener("change", () => applyAchievementSearch(manager, input.value));
                const help = document.createElement("span");
                help.className = "mahi-tahi-helper-label";
                help.textContent = "Visit group lists first to learn roles. Unknown roles appear only under All. Refreshing clears learned roles.";
                const wrapper = document.createElement("div");
                wrapper.className = controls.className;
                controls.classList.remove("mahi-tahi-helper-achievement-search");
                wrapper.append(controls, createControlGroup("Type", type), help);
                controls = wrapper;
                input.addEventListener("input", () => applyAchievementSearch(manager, input.value));
                firstIndividual.parentElement.prepend(controls);
            }
            applyAchievementSearch(manager, controls.querySelector("input").value);
        });
    }

    /** Matches full names using the separate first and last name attributes, ignoring case. */
    function applyAchievementSearch(manager, value) {
        const words = value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const type = manager.querySelector(".mahi-tahi-helper-individual-type")?.value ?? "";
        manager.querySelectorAll(".individualOptionContainer").forEach(individual => {
            const name = `${individual.dataset.firstname ?? ""} ${individual.dataset.lastname ?? ""}`.toLocaleLowerCase();
            const matchesType = !type || getKnownIndividualType(name) === type;
            individual.classList.toggle("mahi-tahi-helper-individual-hidden", !matchesType || !words.every(word => name.includes(word)));
        });
    }

    /** Adds a status dropdown below each participant list's existing attendee search. */
    function enhanceAttendeeFilters() {
        document.querySelectorAll(".participantsDisplayRight").forEach(panel => {
            const search = panel.querySelector('input[placeholder="Search attendees..."]');
            const searchControl = search?.closest("lightning-input");
            if (!searchControl) {
                return;
            }

            let select = panel.querySelector(".mahi-tahi-helper-attendee-status");
            if (!select) {
                select = createSelect("Attendee status", [
                    ["", "All"],
                    ["Attending", "Attending"],
                    ["Not Attending", "Not Attending"],
                    ["Invited", "Invited"]
                ]);
                select.classList.add("mahi-tahi-helper-attendee-status");
                const group = createControlGroup("Attendee status", select);
                group.classList.add("mahi-tahi-helper-attendee-filter");
                select.addEventListener("change", () => applyAttendeeFilter(panel, select.value));
                searchControl.insertAdjacentElement("afterend", group);
            }
            applyAttendeeFilter(panel, select.value);
        });
    }

    /** Filters rendered attendees without changing Salesforce's name search or registration data. */
    function applyAttendeeFilter(panel, selectedStatus) {
        const iconStatuses = {
            "Tick_White.svg": "Attending",
            "Cross_White.svg": "Not Attending",
            "Sent_White.svg": "Invited"
        };
        panel.querySelectorAll(".attendeeGroupsList c-participant").forEach(participant => {
            const icon = participant.querySelector('img[alt="Participant Status Icon"]');
            const filename = icon?.getAttribute("src")?.split(/[?#]/)[0].split("/").at(-1);
            const hidden = Boolean(selectedStatus) && iconStatuses[filename] !== selectedStatus;
            participant.classList.toggle("mahi-tahi-helper-attendee-hidden", hidden);
        });
    }

    /** Defaults unselected Attendance Report fields to the current year, term, and all event types. */
    function enhanceAttendanceReportDefaults() {
        document.querySelectorAll('flowruntime-flow select[name="Year"]').forEach(yearSelect => {
            const flow = yearSelect.closest("flowruntime-flow");
            if (!flow || !flow.querySelector('select[name="Term"]') || !flow.querySelector('select[name="Event_Type"]')) {
                return;
            }

            selectDefaultOption(yearSelect, String(new Date().getFullYear()));
            const currentTerm = `Term ${Math.floor(new Date().getMonth() / 3) + 1}`;
            selectDefaultOption(flow.querySelector('select[name="Term"]'), currentTerm);
            selectDefaultOption(flow.querySelector('select[name="Event_Type"]'), "All Types");
        });
    }

    /** Defaults single-account reports to their first available account and removes None. */
    function enhanceSingleAccountReportDefaults() {
        document.querySelectorAll('flowruntime-flow select[name="SelectedAccount"]').forEach(accountSelect => {
            const flow = accountSelect.closest("flowruntime-flow");
            if (!flow || flow.querySelector('select[name="Term"]')
                || accountSelect.dataset.mahiTahiAccountDefaultApplied === "true") {
                return;
            }

            const selectedWasNone = /^--?None--?$/i.test(accountSelect.selectedOptions[0]?.textContent.trim() ?? "");
            Array.from(accountSelect.options).forEach(option => {
                if (/^--?None--?$/i.test(option.textContent.trim())) {
                    option.remove();
                }
            });

            accountSelect.dataset.mahiTahiAccountDefaultApplied = "true";
            if (selectedWasNone && accountSelect.options.length > 0) {
                accountSelect.selectedIndex = 0;
                accountSelect.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
                accountSelect.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            }
        });
    }

    /** Selects a matching option and notifies Salesforce only when the field is still unselected. */
    function selectDefaultOption(select, optionLabel) {
        if (!select || select.dataset.mahiTahiDefaultApplied === "true") {
            return;
        }

        const selectedLabel = select.selectedOptions[0]?.textContent.trim() ?? "";
        if (select.value && !/^--?None--?$/i.test(selectedLabel)) {
            select.dataset.mahiTahiDefaultApplied = "true";
            return;
        }

        const option = Array.from(select.options)
            .find(candidate => candidate.textContent.trim() === optionLabel || candidate.value === optionLabel);
        if (!option) {
            return;
        }

        select.value = option.value;
        select.dataset.mahiTahiDefaultApplied = "true";
        select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    /** Adds direct current-year attendance report links for every captured section and term. */
    function enhanceAttendanceReportShortcuts() {
        const existingPanel = document.querySelector(".mahi-tahi-helper-report-shortcuts");
        if (location.pathname.replace(/\/$/, "") !== "/s/reports") {
            existingPanel?.remove();
            return;
        }

        if (attendanceSections.length === 0 || existingPanel) {
            return;
        }

        const panel = document.createElement("section");
        panel.className = "mahi-tahi-helper-report-shortcuts";
        panel.setAttribute("aria-label", "Direct attendance reports");

        const heading = document.createElement("h2");
        heading.textContent = "Direct attendance reports";
        const description = document.createElement("p");
        description.textContent = "Open an All Types attendance report directly, without using the dropdown form.";
        panel.append(heading, description);

        const currentYear = new Date().getFullYear();
        const currentTerm = Math.floor(new Date().getMonth() / 3) + 1;
        attendanceSections.forEach(([sectionName, groupId]) => {
            const row = document.createElement("div");
            row.className = "mahi-tahi-helper-report-row";

            const label = document.createElement("strong");
            label.textContent = sectionName;
            row.appendChild(label);

            for (let term = 1; term <= 4; term += 1) {
                const link = document.createElement("a");
                const reportTerm = `Term ${term} ${currentYear}`;
                const parameters = new URLSearchParams({ groupId, term: reportTerm, eventType: "all" });
                link.href = `/apex/CR_ProgrammeNightAttendance?${parameters}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = `Term ${term}`;
                link.title = `${sectionName} attendance — ${reportTerm}`;
                if (term === currentTerm) {
                    link.className = "mahi-tahi-helper-current-term";
                }
                row.appendChild(link);
            }

            panel.appendChild(row);
        });

        document.querySelector('div[role="main"]')?.prepend(panel);
    }

    /** Handles route changes and real account IDs captured from Salesforce's page context. */
    function receivePageMessage(event) {
        if (event.source !== window || event.data?.source !== "mahi-tahi-helper") {
            return;
        }

        if (event.data.type === "route-changed") {
            enhancePage();
            return;
        }

        if (event.data.type !== "attendance-accounts" || !Array.isArray(event.data.accounts)) {
            return;
        }

        const accounts = event.data.accounts
            .filter(account => typeof account?.label === "string" && /^001[A-Za-z0-9]{12,15}$/.test(account?.id))
            .map(account => [account.label.trim(), account.id]);
        if (accounts.length === 0) {
            return;
        }

        attendanceSections = accounts;
        document.querySelector(".mahi-tahi-helper-report-shortcuts")?.remove();
        enhanceAttendanceReportShortcuts();
    }

    /** Watches Salesforce's dynamic page updates and enhances newly rendered member lists. */
    function observePageChanges() {
        let scheduled = false;
        const observer = new MutationObserver(() => {
            if (scheduled) {
                return;
            }
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                enhancePage();
            });
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("message", receivePageMessage);
    window.postMessage({ source: "mahi-tahi-helper", type: "request-attendance-accounts" }, location.origin);
    enhancePage();
    observePageChanges();
})();
