(() => {
    "use strict";
    const engine = globalThis.mahiTahiInvoices;

    /** Creates a DOM element with text, without interpreting source data as HTML. */
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text) { node.textContent = text; }
        if (className) { node.className = className; }
        return node;
    }

    /** Adds a labelled field to an export form. */
    function field(container, label, type, value = "") {
        const input = document.createElement("input");
        input.type = type;
        input.value = value;
        input.className = "slds-input";
        const wrapper = element("label", "", "mahi-tahi-helper-field");
        wrapper.append(element("span", label, "mahi-tahi-helper-label"), input);
        container.append(wrapper);
        return input;
    }

    /** Creates a labelled dropdown with explicit values. */
    function select(container, label, options) {
        const wrapper = element("label", "", "mahi-tahi-helper-field");
        const control = element("select", "", "slds-select");
        options.forEach(([value, text]) => {
            const option = element("option", text);
            option.value = value;
            control.append(option);
        });
        wrapper.append(element("span", label, "mahi-tahi-helper-label"), control);
        container.append(wrapper);
        return control;
    }

    /** Reads only an explicitly selected local CSV, capped to keep the page responsive. */
    async function readFile(input) {
        const file = input.files[0];
        if (!file) { throw new Error("Choose a CSV file."); }
        if (file.size > 5 * 1024 * 1024) { throw new Error("Choose a CSV smaller than 5 MB."); }
        return file.text();
    }

    /** Builds the local-only billing form and review table. */
    function createPanel() {
        const panel = element("details", "", "mahi-tahi-helper-invoices");
        panel.append(element("summary", "Create Xero invoice import from Treasurer CSV"));
        const form = element("form");
        panel.append(form);
        form.append(element("p", "Run the Treasurer report and save its CSV, then choose it below. Processing stays in this tab; nothing is uploaded. Each selected member receives one fee line on a separate invoice, even when a family contact is shared."));
        const files = element("div", "", "mahi-tahi-helper-invoice-fields");
        const sourceInput = field(files, "Treasurer CSV", "file");
        const templateInput = field(files, "Xero sales invoice template CSV (download from Xero > Invoices > Import)", "file");
        sourceInput.accept = templateInput.accept = ".csv,.txt,text/csv,text/plain";
        form.append(files);
        const mappings = element("div", "", "mahi-tahi-helper-invoice-fields");
        form.append(mappings);
        const options = element("div", "", "mahi-tahi-helper-invoice-fields");
        const billTo = select(options, "Bill to", [["family", "Family contact"], ["member", "Member"]]);
        const description = field(options, "Invoice line description", "text", "Term fee");
        const amount = field(options, "Fee per member (NZD)", "number", "140");
        amount.min = "0.01"; amount.step = "0.01";
        const account = field(options, "Xero account code", "text");
        const tax = field(options, "Exact Xero tax rate name", "text");
        const basis = select(options, "Fee amounts are", [["inclusive", "Tax inclusive"], ["exclusive", "Tax exclusive"]]);
        const today = new Date(), due = new Date(today);
        due.setDate(due.getDate() + 14);
        const invoiceDate = field(options, "Invoice date", "date", engine.dateInput(today));
        const dueDate = field(options, "Due date", "date", engine.dateInput(due));
        const prefix = field(options, "Invoice prefix (unique billing run)", "text", `MT-${engine.dateInput(today).replaceAll("-", "")}-`);
        const start = field(options, "Starting invoice number", "number", "1");
        start.min = "1"; start.step = "1";
        form.append(options);
        form.append(element("p", "Use the exact contact names, account code and tax rate configured in Xero. Choose the same tax-inclusive or tax-exclusive option when importing. Check invoice numbers have not already been used. No discounts or prorating are applied; check billing status and special billing arrangements before charging."));
        const previewButton = element("button", "Review invoices", "slds-button slds-button_neutral");
        previewButton.type = "button";
        form.append(previewButton);
        const status = element("p");
        status.setAttribute("role", "status");
        const preview = element("div", "", "mahi-tahi-helper-invoice-preview");
        form.append(status, preview);
        const confirmLabel = element("label", "", "mahi-tahi-helper-invoice-confirm");
        const confirmed = element("input");
        confirmed.type = "checkbox";
        confirmLabel.append(confirmed, document.createTextNode(" I checked the selected members, exact Xero contact names, fee, tax basis, dates and unused invoice numbers."));
        const download = element("button", "Download Xero invoice CSV", "slds-button slds-button_brand");
        download.type = "submit";
        download.disabled = true;
        form.append(confirmLabel, download);
        let source = null, template = null, members = null, mappingControls = {}, sourceGeneration = 0, templateGeneration = 0;

        /** Invalidates reviewed invoices when their source or mapping changes. */
        function clearPreview() {
            members = null;
            preview.replaceChildren();
            confirmed.checked = false;
            download.disabled = true;
        }

        /** Loads source column mappings using header labels, never column positions guessed from records. */
        function buildMappings() {
            mappings.replaceChildren();
            mappingControls = {};
            const definitions = [
                ["first", "Member first name", "First Name"], ["last", "Member last name", "Last Name"],
                ["familyFirst", "Family contact first name", "Family Contact First Name"],
                ["familyLast", "Family contact last name", "Family Contact Last Name"],
                ["email", "Contact email", "Family Contact Email Address"],
                ["id", "Member ID (duplicate detection)", "National Database Number"],
                ["status", "Billing status (review only)", "Billable Status"]
            ];
            definitions.forEach(([key, label, defaultHeader]) => {
                const control = select(mappings, label, [["", "Not mapped"], ...source.headers.map((header, index) => [String(index), header])]);
                const index = source.headers.findIndex(header => header.toLowerCase() === defaultHeader.toLowerCase());
                control.value = index < 0 ? "" : String(index);
                control.addEventListener("change", clearPreview);
                mappingControls[key] = control;
            });
        }

        sourceInput.addEventListener("change", async () => {
            const generation = ++sourceGeneration;
            source = null;
            mappings.replaceChildren();
            clearPreview();
            try {
                const loaded = engine.readSource(await readFile(sourceInput));
                if (generation !== sourceGeneration) { return; }
                source = loaded;
                buildMappings();
                status.textContent = `Loaded ${source.rows.length} source records. Confirm the column mappings, then review invoices.`;
            } catch (error) { if (generation === sourceGeneration) { status.textContent = error.message; } }
        });
        templateInput.addEventListener("change", async () => {
            const generation = ++templateGeneration;
            template = null;
            clearPreview();
            try {
                const loaded = engine.readTemplate(await readFile(templateInput));
                if (generation !== templateGeneration) { return; }
                template = loaded;
                status.textContent = `Xero template loaded: ${template.headers.length} columns. Original headings and order will be preserved.`;
            } catch (error) { if (generation === templateGeneration) { status.textContent = error.message; } }
        });
        billTo.addEventListener("change", clearPreview);

        /** Collects current form settings for validation and export. */
        function settings() {
            return { description: description.value, amount: amount.value, account: account.value, tax: tax.value,
                basis: basis.value, invoiceDate: invoiceDate.value, dueDate: dueDate.value, prefix: prefix.value, start: start.value };
        }

        /** Validates selected invoice rows and updates the billing summary. */
        function updateSummary() {
            try {
                if (!template || !members) { throw new Error("Choose both CSV files and review invoices first."); }
                const result = engine.createExport(template, members, settings());
                status.textContent = `${result.count} invoices; NZD ${result.total} (${basis.value === "inclusive" ? "tax inclusive" : "tax exclusive"}). Invoice numbers ${prefix.value}${Number(start.value)} to ${prefix.value}${Number(start.value) + result.count - 1}.`;
                download.disabled = !confirmed.checked;
                return result;
            } catch (error) {
                download.disabled = true;
                status.textContent = error.message;
                return null;
            }
        }

        previewButton.addEventListener("click", () => {
            clearPreview();
            try {
                if (!source || !template) { throw new Error("Choose the Treasurer CSV and the Xero sales invoice template first."); }
                const mapping = Object.fromEntries(Object.entries(mappingControls).map(([key, control]) => [key, control.value]));
                if (mapping.first === "" || mapping.last === "") { throw new Error("Map both member name columns first."); }
                if (billTo.value === "family" && (mapping.familyFirst === "" || mapping.familyLast === "")) { throw new Error("Map both family contact name columns or choose Bill to Member."); }
                const result = engine.mapMembers(source, mapping, billTo.value);
                members = result.members;
                preview.append(element("p", `${result.duplicates} repeated records removed. Review every selected member, including any non-billable status. You can edit contact names and email addresses to match Xero. Without member IDs, matching names and emails are treated as the same member.`));
                const table = element("table");
                const header = element("tr");
                ["Charge", "Member", "Billing status", "Xero contact name", "Email"].forEach(text => header.append(element("th", text)));
                const head = element("thead"); head.append(header); table.append(head);
                const body = element("tbody");
                members.forEach(member => {
                    const row = element("tr");
                    const cell = element("td"), check = element("input");
                    check.type = "checkbox"; check.checked = true;
                    check.setAttribute("aria-label", `Charge ${member.member}`);
                    check.addEventListener("change", () => { member.selected = check.checked; });
                    cell.append(check);
                    row.append(cell, element("td", member.member), element("td", member.status || "Unknown"));
                    [["contact", "Xero contact name"], ["email", "Email"]].forEach(([key, label]) => {
                        const cell = element("td"), input = element("input");
                        input.type = "text"; input.className = "slds-input"; input.value = member[key];
                        input.setAttribute("aria-label", `${label} for ${member.member}`);
                        input.addEventListener("input", () => { member[key] = input.value; });
                        cell.append(input); row.append(cell);
                    });
                    body.append(row);
                });
                table.append(body); preview.append(table);
                updateSummary();
            } catch (error) { status.textContent = error.message; }
        });
        ["input", "change"].forEach(event => form.addEventListener(event, e => {
            if (e.target !== confirmed) { confirmed.checked = false; }
            if (members) { updateSummary(); }
            else { download.disabled = true; }
        }));
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!confirmed.checked) { return; }
            const result = updateSummary();
            if (!result) { return; }
            const url = URL.createObjectURL(new Blob(["\uFEFF", result.csv], { type: "text/csv;charset=utf-8" }));
            const link = element("a");
            link.href = url; link.download = `xero-invoices-${invoiceDate.value}-${basis.value}.csv`;
            panel.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            confirmed.checked = false; download.disabled = true;
            status.textContent = `Downloaded ${result.count} invoices. Import into Xero using ${basis.value === "inclusive" ? "tax-inclusive" : "tax-exclusive"} amounts. Review the draft invoices in Xero before approving.`;
        });
        return panel;
    }

    /** Shows the converter only on Reports and discards its personal data when leaving. */
    function enhance() {
        const existing = document.querySelector(".mahi-tahi-helper-invoices");
        if (location.pathname.replace(/\/$/, "") !== "/s/reports") { existing?.remove(); return; }
        if (existing) { return; }
        const main = document.querySelector('div[role="main"]') || document.querySelector("flowruntime-flow")?.parentElement;
        if (main) { main.prepend(createPanel()); }
    }
    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) { return; }
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; enhance(); });
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("message", event => {
        if (event.source === window && event.data?.source === "mahi-tahi-helper" && event.data.type === "route-changed") { enhance(); }
    });
    enhance();
})();
