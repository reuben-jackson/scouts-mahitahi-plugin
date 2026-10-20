(() => {
    "use strict";

    /** Parses quoted CSV fields, including escaped quotes, commas and embedded newlines. */
    function parseCsv(text) {
        text = text.replace(/^\uFEFF/, "");
        const rows = [];
        let row = [], field = "", quoted = false, closed = false;
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            if (quoted) {
                if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
                else if (char === '"') { quoted = false; closed = true; }
                else { field += char; }
            } else if (char === '"') {
                if (field || closed) { throw new Error("Unexpected quote in CSV."); }
                quoted = true;
            } else if (char === ",") {
                row.push(field); field = ""; closed = false;
            } else if (char === "\r" || char === "\n") {
                if (char === "\r" && text[i + 1] === "\n") { i += 1; }
                row.push(field);
                if (row.some(value => value.trim())) { rows.push(row); }
                row = []; field = ""; closed = false;
            } else {
                if (closed) { throw new Error("Unexpected text after a quoted CSV field."); }
                field += char;
            }
        }
        if (quoted) { throw new Error("Unclosed quoted CSV field."); }
        row.push(field);
        if (row.some(value => value.trim())) { rows.push(row); }
        return rows;
    }

    /** Validates a source CSV has unique headers and consistently sized records. */
    function readSource(text) {
        const rows = parseCsv(text);
        if (rows.length < 2) { throw new Error("The Treasurer CSV needs a header and at least one record."); }
        const headers = rows.shift().map(value => value.trim());
        if (headers.some(value => !value) || new Set(headers.map(value => value.toLowerCase())).size !== headers.length) {
            throw new Error("The Treasurer CSV has blank or duplicate column headings.");
        }
        rows.forEach((row, index) => {
            if (row.length !== headers.length) { throw new Error(`CSV record ${index + 2} has the wrong number of fields.`); }
        });
        return { headers, rows };
    }

    /** Recognises required Xero columns while retaining the original template headings and order. */
    function readTemplate(text) {
        const headers = parseCsv(text)[0];
        if (!headers) { throw new Error("The Xero template is empty."); }
        const keys = headers.map(value => value.replace(/^\*/, "").trim());
        if (new Set(keys).size !== keys.length || keys.some(key => !key)) {
            throw new Error("The Xero template has blank or duplicate column headings.");
        }
        ["ContactName", "InvoiceNumber", "InvoiceDate", "DueDate", "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType"].forEach(key => {
            if (!keys.includes(key)) { throw new Error(`The Xero template is missing ${key}. Download the sales invoice template from Xero.`); }
        });
        return { headers, keys };
    }

    /** Formats a local calendar date without converting it through UTC. */
    function dateInput(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    /** Validates and formats an input date for Xero. */
    function xeroDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) { throw new Error("Choose valid invoice and due dates."); }
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (dateInput(date) !== value) { throw new Error("Choose valid invoice and due dates."); }
        return `${match[3]}/${match[2]}/${match[1]}`;
    }

    /** Rejects formula-like cells rather than silently changing contact names or accounting codes. */
    function safeCell(value) {
        const text = String(value ?? "");
        if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) {
            throw new Error("A field starts with a spreadsheet formula character. Edit it before exporting.");
        }
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    /** Maps only billing fields and collapses repeated members with identical billing details. */
    function mapMembers(source, mapping, billTo) {
        const cell = (row, key) => mapping[key] === "" ? "" : (row[Number(mapping[key])] ?? "").trim();
        const members = [], seen = new Map();
        let duplicates = 0;
        source.rows.forEach((row, index) => {
            const member = [cell(row, "first"), cell(row, "last")].filter(Boolean).join(" ");
            if (!member) { throw new Error(`Record ${index + 2} has no mapped member name.`); }
            const family = [cell(row, "familyFirst"), cell(row, "familyLast")].filter(Boolean).join(" ");
            const contact = billTo === "family" ? family : member;
            const email = cell(row, "email");
            const id = cell(row, "id");
            const key = id ? `id:${id.toLowerCase()}` : `name:${member.toLowerCase()}|${email.toLowerCase()}`;
            const signature = JSON.stringify([member, contact, email, cell(row, "status")]);
            if (seen.has(key)) {
                if (seen.get(key) !== signature) { throw new Error(`Conflicting repeated member at record ${index + 2}. Resolve the duplicate in the source CSV first.`); }
                duplicates += 1;
                return;
            }
            seen.set(key, signature);
            members.push({ member, contact, email, status: cell(row, "status"), selected: true });
        });
        return { members, duplicates };
    }

    /** Produces one invoice per selected member using one consistent price basis. */
    function createExport(template, members, settings) {
        if (!settings.description.trim() || !settings.account.trim() || !settings.tax.trim()) {
            throw new Error("Enter a description, account code and exact Xero tax rate name.");
        }
        if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(settings.amount) || Number(settings.amount) <= 0) {
            throw new Error("Fee must be a positive number with no more than two decimal places.");
        }
        const amountCents = Math.round(Number(settings.amount) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents > 99999999999) { throw new Error("Fee is too large."); }
        if (!["inclusive", "exclusive"].includes(settings.basis)) { throw new Error("Choose a tax basis."); }
        if (!/^\d+$/.test(settings.start) || !Number.isSafeInteger(Number(settings.start)) || Number(settings.start) < 1) {
            throw new Error("Starting invoice number must be a positive whole number.");
        }
        const chosen = members.filter(member => member.selected);
        if (!chosen.length) { throw new Error("Select at least one member."); }
        if (chosen.length > 500) { throw new Error("Select no more than 500 members per Xero export."); }
        if (!Number.isSafeInteger(Number(settings.start) + chosen.length - 1)) { throw new Error("Invoice sequence is too large."); }
        const invoiceDate = xeroDate(settings.invoiceDate), dueDate = xeroDate(settings.dueDate);
        if (settings.dueDate < settings.invoiceDate) { throw new Error("Due date must not precede invoice date."); }
        if (!settings.prefix.trim()) { throw new Error("Enter an invoice prefix, unique to this billing run."); }
        const rows = chosen.map((member, index) => {
            if (!member.contact.trim()) { throw new Error(`Enter the Xero contact name for ${member.member}.`); }
            const fields = {
                ContactName: member.contact, EmailAddress: member.email,
                InvoiceNumber: `${settings.prefix}${Number(settings.start) + index}`,
                Reference: member.member, InvoiceDate: invoiceDate, DueDate: dueDate,
                Description: `${settings.description.trim()} - ${member.member}`, Quantity: "1",
                UnitAmount: (amountCents / 100).toFixed(2), AccountCode: settings.account.trim(),
                TaxType: settings.tax.trim(), Currency: "NZD"
            };
            return template.keys.map(key => fields[key] ?? "");
        });
        const csv = [template.headers, ...rows].map(row => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
        return { csv, count: rows.length, total: (amountCents * rows.length / 100).toFixed(2) };
    }

    globalThis.mahiTahiInvoices = Object.freeze({ parseCsv, readSource, readTemplate, dateInput, xeroDate, mapMembers, createExport });
})();
