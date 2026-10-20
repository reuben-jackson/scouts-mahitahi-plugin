(() => {
    "use strict";
    const engine = globalThis.mahiTahiInvoices;
    const SETTINGS_KEY = "invoiceGeneratorSettings";

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

    /** Adds a labelled multiline field to an export form. */
    function textArea(container, label) {
        const input = document.createElement("textarea");
        input.className = "slds-textarea";
        const wrapper = element("label", "", "mahi-tahi-helper-field");
        wrapper.append(element("span", label, "mahi-tahi-helper-label"), input);
        container.append(wrapper);
        return input;
    }

    /** Adds a titled section to keep the invoice form manageable. */
    function section(form, title) {
        const fieldset = element("fieldset", "", "mahi-tahi-helper-invoice-section");
        fieldset.append(element("legend", title));
        form.append(fieldset);
        return fieldset;
    }

    /** Returns extension-owned local storage when the host supports it. */
    function localStorageArea() {
        return globalThis.browser?.storage?.local || globalThis.chrome?.storage?.local || null;
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
        panel.append(element("summary", "Create Xero or MYOB invoice import from Treasurer CSV"));
        const form = element("form");
        panel.append(form);
        form.append(element("p", "Run the Treasurer report and save its CSV, then choose it below. Processing stays in this tab; nothing is uploaded. Each selected member receives one fee line on a separate invoice, even when a family contact is shared."));
        const filesSection = section(form, "Source files");
        const files = element("div", "", "mahi-tahi-helper-invoice-fields");
        const sourceInput = field(files, "Treasurer CSV", "file");
        const templateInput = field(files, "Xero sales invoice template CSV (download from Xero > Invoices > Import)", "file");
        const templateField = templateInput.closest("label");
        sourceInput.accept = templateInput.accept = ".csv,.txt,text/csv,text/plain";
        filesSection.append(files);
        const mappingsSection = section(form, "Mapping data");
        const mappings = element("div", "", "mahi-tahi-helper-invoice-fields");
        const billTo = select(mappings, "Bill to", [["family", "Family contact"], ["member", "Member"]]);
        const mappingSelectors = element("div", "", "mahi-tahi-helper-invoice-fields");
        mappingsSection.append(mappings);
        mappingsSection.append(mappingSelectors);
        const headerSection = section(form, "Invoice header details");
        const headerFields = element("div", "", "mahi-tahi-helper-invoice-fields");
        const issuerName = field(headerFields, "Organisation or supplier name", "text");
        const gstNumber = field(headerFields, "GST number (leave blank when GST rate is 0)", "text");
        const gstRate = field(headerFields, "GST rate (%)", "number", "15");
        gstRate.min = "0"; gstRate.max = "100"; gstRate.step = "0.01";
        const issuerContact = textArea(headerFields, "Supplier contact details");
        const payment = textArea(headerFields, "Payment instructions");
        const footer = textArea(headerFields, "Invoice footer or email message");
        headerSection.append(headerFields);
        const accountSection = section(form, "Account and fee settings");
        const options = element("div", "", "mahi-tahi-helper-invoice-fields");
        const accounting = select(options, "Accounting output", [["xero", "Xero CSV + invoices"], ["myob", "MYOB AccountRight CSV + invoices"], ["documents", "HTML and email drafts only"]]);
        const description = field(options, "Invoice line description", "text", "Term fee");
        const amount = field(options, "Fee per member (NZD)", "number", "140");
        amount.min = "0.01"; amount.step = "0.01";
        const account = field(options, "Xero account code", "text");
        const accountLabel = account.previousElementSibling;
        const defaultXeroTax = "15% GST on Income";
        const tax = field(options, "Exact Xero tax rate name", "text", defaultXeroTax);
        const taxLabel = tax.previousElementSibling;
        const basis = select(options, "Fee amounts are", [["inclusive", "Tax inclusive"], ["exclusive", "Tax exclusive"]]);
        accountSection.append(options);
        const datesSection = section(form, "Invoice numbers and dates");
        const dates = element("div", "", "mahi-tahi-helper-invoice-fields");
        const today = new Date(), due = new Date(today);
        due.setDate(due.getDate() + 14);
        const invoiceDate = field(dates, "Invoice date", "date", engine.dateInput(today));
        const dueDate = field(dates, "Due date", "date", engine.dateInput(due));
        const defaultPrefix = `MT-${engine.dateInput(today).replaceAll("-", "")}-`;
        const prefix = field(dates, "Invoice prefix (unique billing run)", "text", defaultPrefix);
        const start = field(dates, "Starting invoice number", "number", "1");
        start.min = "1"; start.step = "1";
        datesSection.append(dates);
        const guidance = element("p", "Use the exact contact names, account code and tax rate configured in Xero. Choose the same tax-inclusive or tax-exclusive option when importing. Check invoice numbers have not already been used. No discounts or prorating are applied; check billing status and special billing arrangements before charging.");
        form.append(guidance);
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
        const confirmText = document.createTextNode(" I checked the selected members, exact Xero contact names, fee, tax basis, dates and unused invoice numbers.");
        confirmLabel.append(confirmed, confirmText);
        const download = element("button", "Download Xero invoice CSV", "slds-button slds-button_brand");
        download.type = "submit";
        download.disabled = true;
        const downloadHtml = element("button", "Download printable HTML invoices", "slds-button slds-button_brand");
        downloadHtml.type = "button"; downloadHtml.disabled = true;
        const downloadText = element("button", "Download email drafts as text", "slds-button slds-button_brand");
        downloadText.type = "button"; downloadText.disabled = true;
        form.append(confirmLabel, download, downloadHtml, downloadText);
        const providerSettings = {
            xero: { account: "", tax: defaultXeroTax },
            myob: { account: "", tax: "GST" },
            documents: { account: "", tax: "" }
        };
        let previousAccounting = "xero", settingsRestored = false, saveTimer = null;
        let source = null, template = null, members = null, mappingControls = {}, sourceGeneration = 0, templateGeneration = 0;

        /** Invalidates reviewed invoices when their source or mapping changes. */
        function clearPreview() {
            members = null;
            preview.replaceChildren();
            confirmed.checked = false;
            download.disabled = true;
            downloadHtml.disabled = true;
            downloadText.disabled = true;
        }

        /** Updates accounting-specific labels and safely invalidates any existing review. */
        function updateAccounting() {
            providerSettings[previousAccounting] = { account: account.value, tax: tax.value };
            const myob = accounting.value === "myob";
            const documentsOnly = accounting.value === "documents";
            templateField.hidden = !(!myob && !documentsOnly);
            account.closest("label").hidden = documentsOnly;
            tax.closest("label").hidden = documentsOnly;
            accountLabel.textContent = myob ? "MYOB account number" : "Xero account code";
            taxLabel.textContent = myob ? "MYOB GST code" : "Exact Xero tax rate name";
            guidance.textContent = documentsOnly
                ? "Review the invoices, then download a standalone printable HTML file or plain-text email drafts. Nothing is sent automatically."
                : myob
                ? "Use customer names, account number and GST code that already exist in AccountRight. Invoice numbers are limited to eight characters. Import as Sales > Professional, with commas and a header record, then review the imported invoices before sending them."
                : "Use the exact contact names, account code and tax rate configured in Xero. Choose the same tax-inclusive or tax-exclusive option when importing. Check invoice numbers have not already been used. No discounts or prorating are applied; check billing status and special billing arrangements before charging.";
            confirmText.textContent = documentsOnly
                ? " I checked the selected members, billing contacts, invoice details, GST and payment instructions."
                : myob
                ? " I checked the selected members, exact MYOB customer names, fee, GST basis, dates and unused invoice numbers."
                : " I checked the selected members, exact Xero contact names, fee, tax basis, dates and unused invoice numbers.";
            download.hidden = documentsOnly;
            download.textContent = myob ? "Download MYOB invoice CSV" : "Download Xero invoice CSV";
            if (myob && prefix.value === defaultPrefix) { prefix.value = "MT-"; }
            else if (!myob && prefix.value === "MT-") { prefix.value = defaultPrefix; }
            previousAccounting = accounting.value;
            account.value = providerSettings[previousAccounting].account;
            tax.value = providerSettings[previousAccounting].tax;
            clearPreview();
        }

        /** Loads source column mappings using header labels, never column positions guessed from records. */
        function buildMappings() {
            mappingSelectors.replaceChildren();
            mappingControls = {};
            const fixedHeaders = {
                first: "Contact First Name", last: "Contact Last Name",
                familyFirst: "Family Contact First Name", familyLast: "Family Contact Last Name",
                email: "Family Contact Email Address", id: "National Database Number"
            };
            Object.entries(fixedHeaders).forEach(([key, header]) => {
                const index = source.headers.findIndex(sourceHeader => sourceHeader.toLowerCase() === header.toLowerCase());
                if (index < 0) { throw new Error(`The Treasurer CSV is missing the expected ${header} column.`); }
                mappingControls[key] = { value: String(index) };
            });
            const status = select(mappingSelectors, "Billing status (review only)", [["", "Not mapped"], ...source.headers.map((header, index) => [String(index), header])]);
            const statusIndex = source.headers.findIndex(header => header.toLowerCase() === "billable status");
            status.value = statusIndex < 0 ? "" : String(statusIndex);
            status.addEventListener("change", clearPreview);
            mappingControls.status = status;
        }

        sourceInput.addEventListener("change", async () => {
            const generation = ++sourceGeneration;
            source = null;
            mappingSelectors.replaceChildren();
            clearPreview();
            try {
                const loaded = engine.readSource(await readFile(sourceInput));
                if (generation !== sourceGeneration) { return; }
                source = loaded;
                buildMappings();
                status.textContent = `Loaded ${source.rows.length} source records. Confirm the column mappings, then review invoices.`;
            } catch (error) { if (generation === sourceGeneration) { source = null; status.textContent = error.message; } }
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
        accounting.addEventListener("change", updateAccounting);
        billTo.addEventListener("change", clearPreview);

        /** Collects current form settings for validation and export. */
        function settings() {
            return { description: description.value, amount: amount.value, account: account.value, tax: tax.value,
                basis: basis.value, invoiceDate: invoiceDate.value, dueDate: dueDate.value, prefix: prefix.value, start: start.value };
        }

        /** Collects issuer details used only in printable and email-draft invoices. */
        function issuerSettings() {
            return { name: issuerName.value, gstNumber: gstNumber.value, gstRate: gstRate.value,
                contact: issuerContact.value, payment: payment.value, footer: footer.value };
        }

        /** Saves reusable configuration without retaining files or member information. */
        async function persistSettings() {
            const storage = localStorageArea();
            if (!storage || !settingsRestored) { return; }
            providerSettings[accounting.value] = { account: account.value, tax: tax.value };
            await storage.set({ [SETTINGS_KEY]: {
                accounting: accounting.value, providerSettings, billTo: billTo.value,
                issuerName: issuerName.value, gstNumber: gstNumber.value, gstRate: gstRate.value,
                issuerContact: issuerContact.value, payment: payment.value, footer: footer.value,
                description: description.value, amount: amount.value, basis: basis.value, prefix: prefix.value
            } });
        }

        /** Restores reusable configuration from extension-owned local storage. */
        async function restoreSettings() {
            const storage = localStorageArea();
            if (!storage) { settingsRestored = true; return; }
            try {
                const saved = (await storage.get(SETTINGS_KEY))[SETTINGS_KEY];
                if (saved) {
                    ["xero", "myob", "documents"].forEach(provider => {
                        if (saved.providerSettings?.[provider]) { Object.assign(providerSettings[provider], saved.providerSettings[provider]); }
                    });
                    accounting.value = ["xero", "myob", "documents"].includes(saved.accounting) ? saved.accounting : "xero";
                    previousAccounting = accounting.value;
                    billTo.value = saved.billTo === "member" ? "member" : "family";
                    issuerName.value = saved.issuerName || ""; gstNumber.value = saved.gstNumber || "";
                    gstRate.value = saved.gstRate ?? "15"; issuerContact.value = saved.issuerContact || "";
                    payment.value = saved.payment || ""; footer.value = saved.footer || "";
                    description.value = saved.description || "Term fee"; amount.value = saved.amount || "140";
                    basis.value = saved.basis === "exclusive" ? "exclusive" : "inclusive";
                    prefix.value = saved.prefix || defaultPrefix;
                    account.value = providerSettings[previousAccounting].account;
                    tax.value = providerSettings[previousAccounting].tax;
                }
                updateAccounting();
            } catch (error) {
                console.error("Could not restore invoice settings.", error);
                status.textContent = "Saved invoice settings could not be restored; this session will still work.";
            } finally { settingsRestored = true; }
        }

        /** Schedules a compact local-settings write after form edits settle. */
        function scheduleSettingsSave() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => persistSettings().catch(error => {
                console.error("Could not save invoice settings.", error);
                status.textContent = "Invoice settings could not be saved in this browser.";
            }), 300);
        }

        /** Validates selected invoice rows and updates the billing summary. */
        function updateSummary() {
            try {
                if (!members || (accounting.value === "xero" && !template)) { throw new Error("Choose the required file or files and review invoices first."); }
                const result = accounting.value === "documents" ? engine.createInvoiceDocuments(members, settings(), issuerSettings())
                    : accounting.value === "myob" ? engine.createMyobExport(members, settings()) : engine.createExport(template, members, settings());
                status.textContent = `${result.count} invoices; NZD ${result.total} (${basis.value === "inclusive" ? "tax inclusive" : "tax exclusive"}). Invoice numbers ${prefix.value}${Number(start.value)} to ${prefix.value}${Number(start.value) + result.count - 1}.`;
                download.disabled = !confirmed.checked;
                let documents = accounting.value === "documents" ? result : null;
                if (!documents) {
                    try { documents = engine.createInvoiceDocuments(members, settings(), issuerSettings()); }
                    catch (error) { status.textContent += ` HTML/email outputs need attention: ${error.message}`; }
                }
                downloadHtml.disabled = !confirmed.checked || !documents;
                downloadText.disabled = !confirmed.checked || !documents;
                return { accounting: result, documents };
            } catch (error) {
                download.disabled = true;
                downloadHtml.disabled = true;
                downloadText.disabled = true;
                status.textContent = error.message;
                return null;
            }
        }

        previewButton.addEventListener("click", () => {
            clearPreview();
            try {
                if (!source || (accounting.value === "xero" && !template)) { throw new Error("Choose the Treasurer CSV and, for Xero, its sales invoice template first."); }
                const mapping = Object.fromEntries(Object.entries(mappingControls).map(([key, control]) => [key, control.value]));
                if (mapping.first === "" || mapping.last === "") { throw new Error("Map both member name columns first."); }
                if (billTo.value === "family" && (mapping.familyFirst === "" || mapping.familyLast === "")) { throw new Error("Map both family contact name columns or choose Bill to Member."); }
                const result = engine.mapMembers(source, mapping, billTo.value);
                members = result.members;
                const reviewGuidance = accounting.value === "documents"
                    ? "You can edit billing contact names and email addresses used in the generated documents."
                    : accounting.value === "myob"
                    ? "You can edit company/last and first names to match existing MYOB customer cards."
                    : "You can edit contact names and email addresses to match Xero.";
                preview.append(element("p", `${result.duplicates} repeated records removed. Review every selected member, including any non-billable status. ${reviewGuidance} Without member IDs, matching names and emails are treated as the same member.`));
                const table = element("table");
                const header = element("tr");
                const reviewFields = accounting.value === "myob"
                    ? [["contactLast", "MYOB company / last name"], ["contactFirst", "MYOB first name"]]
                    : [["contact", "Xero contact name"], ["email", "Email"]];
                ["Charge", "Member", "Billing status", ...reviewFields.map(([, label]) => label)].forEach(text => header.append(element("th", text)));
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
                    reviewFields.forEach(([key, label]) => {
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
            else { download.disabled = true; downloadHtml.disabled = true; downloadText.disabled = true; }
            if (![sourceInput, templateInput, confirmed].includes(e.target)) { scheduleSettingsSave(); }
        }));

        /** Downloads generated content without transmitting it anywhere. */
        function downloadFile(contents, type, filename, includeBom = false) {
            const parts = includeBom ? ["\uFEFF", contents] : [contents];
            const url = URL.createObjectURL(new Blob(parts, { type }));
            const link = element("a");
            link.href = url; link.download = filename;
            panel.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!confirmed.checked) { return; }
            if (accounting.value === "documents") { return; }
            const result = updateSummary();
            if (!result) { return; }
            downloadFile(result.accounting.csv, "text/csv;charset=utf-8", `${accounting.value}-invoices-${invoiceDate.value}-${basis.value}.csv`, true);
            confirmed.checked = false; download.disabled = true; downloadHtml.disabled = true; downloadText.disabled = true;
            status.textContent = accounting.value === "myob"
                ? `Downloaded ${result.accounting.count} invoices. Import into AccountRight as comma-separated Sales > Professional data with a header record. Review the invoices before sending them.`
                : `Downloaded ${result.accounting.count} invoices. Import into Xero using ${basis.value === "inclusive" ? "tax-inclusive" : "tax-exclusive"} amounts. Review the draft invoices in Xero before approving.`;
        });
        downloadHtml.addEventListener("click", () => {
            const result = updateSummary();
            if (!confirmed.checked || !result?.documents) { return; }
            downloadFile(result.documents.html, "text/html;charset=utf-8", `invoices-${invoiceDate.value}.html`);
            confirmed.checked = false; download.disabled = true; downloadHtml.disabled = true; downloadText.disabled = true;
            status.textContent = `Downloaded ${result.documents.count} printable HTML invoices. Open the file in a browser to print or save as PDF.`;
        });
        downloadText.addEventListener("click", () => {
            const result = updateSummary();
            if (!confirmed.checked || !result?.documents) { return; }
            downloadFile(result.documents.text, "text/plain;charset=utf-8", `invoice-email-drafts-${invoiceDate.value}.txt`, true);
            confirmed.checked = false; download.disabled = true; downloadHtml.disabled = true; downloadText.disabled = true;
            status.textContent = `Downloaded ${result.documents.count} plain-text email drafts. Review each draft before sending it manually.`;
        });
        restoreSettings();
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
