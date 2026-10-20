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

    /** Returns the number of calendar days between two validated local dates. */
    function daysBetween(startValue, endValue) {
        xeroDate(startValue);
        xeroDate(endValue);
        const start = new Date(`${startValue}T00:00:00Z`);
        const end = new Date(`${endValue}T00:00:00Z`);
        return Math.round((end - start) / 86400000);
    }

    /** Rejects formula-like cells rather than silently changing contact names or accounting codes. */
    function safeCell(value) {
        const text = String(value ?? "");
        if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) {
            throw new Error("A field starts with a spreadsheet formula character. Edit it before exporting.");
        }
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    /** Escapes untrusted values before placing them in a standalone HTML invoice. */
    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    /** Converts multiline plain text to escaped HTML with explicit line breaks. */
    function multilineHtml(value) {
        return escapeHtml(value).replace(/\r?\n/g, "<br>");
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
            const contactFirst = billTo === "family" ? cell(row, "familyFirst") : cell(row, "first");
            const contactLast = billTo === "family" ? cell(row, "familyLast") : cell(row, "last");
            members.push({ member, contact, contactFirst, contactLast, email, status: cell(row, "status"), selected: true });
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

    /** Produces AccountRight Professional Sales invoices separated by blank records. */
    function createMyobExport(members, settings) {
        if (!settings.description.trim() || !settings.account.trim() || !settings.tax.trim()) {
            throw new Error("Enter a description, AccountRight account number and GST code.");
        }
        if (!/^\d(?:[^\d\r\n])?\d{4}$/.test(settings.account.trim())) {
            throw new Error("MYOB account number must be five digits, optionally separated after the first digit (for example 4-1000).");
        }
        if (!/^[A-Za-z0-9]{1,3}$/.test(settings.tax.trim())) {
            throw new Error("MYOB GST code must be one to three letters or numbers.");
        }
        if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(settings.amount) || Number(settings.amount) <= 0) {
            throw new Error("Fee must be a positive number with no more than two decimal places.");
        }
        const amount = Number(settings.amount).toFixed(2);
        if (amount.length > 15) { throw new Error("Fee is too large for AccountRight."); }
        if (!["inclusive", "exclusive"].includes(settings.basis)) { throw new Error("Choose a tax basis."); }
        if (!/^\d+$/.test(settings.start) || !Number.isSafeInteger(Number(settings.start)) || Number(settings.start) < 1) {
            throw new Error("Starting invoice number must be a positive whole number.");
        }
        const chosen = members.filter(member => member.selected);
        if (!chosen.length) { throw new Error("Select at least one member."); }
        if (chosen.length > 500) { throw new Error("Select no more than 500 members per MYOB export."); }
        const dueDays = daysBetween(settings.invoiceDate, settings.dueDate);
        if (dueDays < 0) { throw new Error("Due date must not precede invoice date."); }
        if (dueDays > 999) { throw new Error("MYOB due date must be no more than 999 days after the invoice date."); }
        const date = xeroDate(settings.invoiceDate);
        const headers = ["Co./Last Name", "First Name", "Invoice #", "Date", "Inclusive", "Delivery Status", "Description",
            "Account No.", "Amount", "GST Code", "Sale Status", "Terms - Payment is Due", "Terms - Discount Days", "Terms - Balance Due Days"];
        const rows = chosen.map((member, index) => {
            const invoiceNumber = `${settings.prefix.trim()}${Number(settings.start) + index}`;
            const description = `${settings.description.trim()} - ${member.member}`;
            if (!member.contactLast.trim()) { throw new Error(`Enter the MYOB company or last name for ${member.member}.`); }
            if (member.contactLast.trim().length > (member.contactFirst.trim() ? 30 : 50)) { throw new Error(`MYOB company or last name is too long for ${member.member}.`); }
            if (member.contactFirst.trim().length > 20) { throw new Error(`MYOB first name is too long for ${member.member}.`); }
            if (invoiceNumber.length > 8) { throw new Error("MYOB invoice numbers can contain no more than eight characters. Shorten the prefix or starting number."); }
            if (description.length > 255) { throw new Error(`Invoice description is too long for ${member.member}.`); }
            return [member.contactLast.trim(), member.contactFirst.trim(), invoiceNumber, date,
                settings.basis === "inclusive" ? "X" : "", "P", description, settings.account.trim(), amount,
                settings.tax.trim(), "", "2", "0", String(dueDays)];
        });
        const lines = [headers.map(safeCell).join(",")];
        rows.forEach(row => { lines.push(row.map(safeCell).join(","), ""); });
        return { csv: lines.join("\r\n"), count: rows.length, total: (Number(amount) * rows.length).toFixed(2) };
    }

    /** Produces printable HTML invoices and plain-text email drafts without sending data. */
    function createInvoiceDocuments(members, settings, issuer) {
        if (!issuer.name.trim()) { throw new Error("Enter the organisation or supplier name in Invoice header details."); }
        if (!settings.description.trim()) { throw new Error("Enter an invoice line description."); }
        if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(settings.amount) || Number(settings.amount) <= 0) {
            throw new Error("Fee must be a positive number with no more than two decimal places.");
        }
        if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(issuer.gstRate) || Number(issuer.gstRate) > 100) {
            throw new Error("GST rate must be between 0 and 100 with no more than two decimal places.");
        }
        if (Number(issuer.gstRate) > 0 && !issuer.gstNumber.trim()) {
            throw new Error("Enter the supplier GST number, or set the GST rate to 0.");
        }
        if (!/^\d+$/.test(settings.start) || !Number.isSafeInteger(Number(settings.start)) || Number(settings.start) < 1) {
            throw new Error("Starting invoice number must be a positive whole number.");
        }
        if (!settings.prefix.trim()) { throw new Error("Enter an invoice prefix, unique to this billing run."); }
        xeroDate(settings.invoiceDate);
        xeroDate(settings.dueDate);
        if (settings.dueDate < settings.invoiceDate) { throw new Error("Due date must not precede invoice date."); }
        const chosen = members.filter(member => member.selected);
        if (!chosen.length) { throw new Error("Select at least one member."); }
        if (chosen.length > 500) { throw new Error("Select no more than 500 members per invoice document."); }
        const amountCents = Math.round(Number(settings.amount) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents > 99999999999) { throw new Error("Fee is too large."); }
        if (!["inclusive", "exclusive"].includes(settings.basis)) { throw new Error("Choose a tax basis."); }
        if (!Number.isSafeInteger(Number(settings.start) + chosen.length - 1)) { throw new Error("Invoice sequence is too large."); }
        const gstRate = Number(issuer.gstRate);
        const gstCents = settings.basis === "inclusive"
            ? Math.round(amountCents * gstRate / (100 + gstRate))
            : Math.round(amountCents * gstRate / 100);
        const totalCents = settings.basis === "inclusive" ? amountCents : amountCents + gstCents;
        const money = cents => (cents / 100).toFixed(2);
        const invoices = chosen.map((member, index) => ({
            contact: member.contact.trim(), email: member.email.trim(), member: member.member,
            number: `${settings.prefix.trim()}${Number(settings.start) + index}`
        }));
        invoices.forEach(invoice => {
            if (!invoice.contact) { throw new Error(`Enter a billing contact name for ${invoice.member}.`); }
        });
        const gstLine = gstRate > 0 ? `<div><span>GST (${escapeHtml(issuer.gstRate)}%)</span><strong>NZD ${money(gstCents)}</strong></div>` : "";
        const invoiceHtml = invoices.map(invoice => `
<section class="invoice">
  <header><div><h1>Invoice</h1><strong>${escapeHtml(issuer.name)}</strong><p>${multilineHtml(issuer.contact)}</p></div><dl><dt>Invoice number</dt><dd>${escapeHtml(invoice.number)}</dd><dt>Invoice date</dt><dd>${escapeHtml(settings.invoiceDate)}</dd><dt>Due date</dt><dd>${escapeHtml(settings.dueDate)}</dd></dl></header>
  <div class="bill-to"><strong>Bill to</strong><div>${escapeHtml(invoice.contact)}</div>${invoice.email ? `<div>${escapeHtml(invoice.email)}</div>` : ""}</div>
  <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>${escapeHtml(settings.description.trim())} - ${escapeHtml(invoice.member)}</td><td>NZD ${money(amountCents)}</td></tr></tbody></table>
  <div class="totals">${gstLine}<div class="total"><span>Total due</span><strong>NZD ${money(totalCents)}</strong></div></div>
  ${issuer.gstNumber.trim() ? `<p>GST number: ${escapeHtml(issuer.gstNumber.trim())}. ${settings.basis === "inclusive" ? "The amount shown includes GST." : "GST has been added to the amount shown."}</p>` : ""}
  ${issuer.payment.trim() ? `<div class="payment"><strong>Payment details</strong><p>${multilineHtml(issuer.payment)}</p><p>Reference: ${escapeHtml(invoice.number)}</p></div>` : ""}
  ${issuer.footer.trim() ? `<footer>${multilineHtml(issuer.footer)}</footer>` : ""}
</section>`).join("\n");
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoices</title><style>
body{background:#eee;color:#222;font:15px Arial,sans-serif;margin:0}.invoice{background:#fff;box-sizing:border-box;margin:20px auto;max-width:800px;min-height:1050px;padding:48px}.invoice header{display:flex;justify-content:space-between;gap:30px}.invoice h1{font-size:32px;margin:0 0 20px}.invoice p{line-height:1.5}.invoice dl{display:grid;grid-template-columns:auto auto;gap:8px 20px;margin:0}.invoice dt{font-weight:bold}.invoice dd{margin:0;text-align:right}.bill-to{margin:45px 0 25px}.invoice table{border-collapse:collapse;width:100%}.invoice th,.invoice td{border-bottom:1px solid #ccc;padding:12px;text-align:left}.invoice th:last-child,.invoice td:last-child{text-align:right}.totals{margin:20px 0 20px auto;max-width:300px}.totals div{display:flex;justify-content:space-between;padding:6px}.totals .total{border-top:2px solid #222;font-size:18px}.payment{border-top:1px solid #ccc;margin-top:35px;padding-top:18px}.invoice footer{border-top:1px solid #ccc;margin-top:35px;padding-top:18px}@media print{body{background:#fff}.invoice{margin:0;max-width:none;min-height:0;page-break-after:always}.invoice:last-child{page-break-after:auto}}
</style></head><body>${invoiceHtml}</body></html>`;
        const text = invoices.map(invoice => {
            const gstText = gstRate > 0 ? `\nGST (${issuer.gstRate}%): NZD ${money(gstCents)}\nGST number: ${issuer.gstNumber.trim()}` : "";
            return `TO: ${invoice.email}\nSUBJECT: Invoice ${invoice.number} from ${issuer.name.trim()}\n\nHello ${invoice.contact},\n\nPlease find the invoice details below.\n\nInvoice: ${invoice.number}\nInvoice date: ${settings.invoiceDate}\nDue date: ${settings.dueDate}\nFor: ${settings.description.trim()} - ${invoice.member}\nAmount: NZD ${money(amountCents)}${gstText}\nTotal due: NZD ${money(totalCents)}\n\n${issuer.payment.trim()}${issuer.payment.trim() ? `\nPayment reference: ${invoice.number}\n` : ""}${issuer.footer.trim() ? `\n${issuer.footer.trim()}\n` : ""}`;
        }).join(`\n\n${"-".repeat(72)}\n\n`);
        return { html, text, count: invoices.length, total: money(totalCents * invoices.length) };
    }

    globalThis.mahiTahiInvoices = Object.freeze({ parseCsv, readSource, readTemplate, dateInput, xeroDate, daysBetween, mapMembers, createExport, createMyobExport, createInvoiceDocuments });
})();
