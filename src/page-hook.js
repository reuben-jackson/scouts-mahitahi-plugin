(() => {
    "use strict";

    const originalOpen = XMLHttpRequest.prototype.open;
    let cachedAttendanceAccounts = [];

    /** Notifies the isolated extension script after Salesforce changes its SPA route. */
    function notifyRouteChanged() {
        window.postMessage({ source: "mahi-tahi-helper", type: "route-changed" }, location.origin);
    }

    ["pushState", "replaceState"].forEach(methodName => {
        const originalMethod = history[methodName];
        history[methodName] = function(...argumentsList) {
            const result = originalMethod.apply(this, argumentsList);
            notifyRouteChanged();
            return result;
        };
    });
    window.addEventListener("popstate", notifyRouteChanged);

    /** Records each XHR URL so completed Salesforce Flow responses can be identified. */
    XMLHttpRequest.prototype.open = function(method, url, ...remainingArguments) {
        this.mahiTahiRequestUrl = String(url);
        this.addEventListener("load", inspectFlowResponse);
        return originalOpen.call(this, method, url, ...remainingArguments);
    };

    /** Extracts account labels and record IDs from Attendance Report Flow responses. */
    function inspectFlowResponse() {
        if (!this.mahiTahiRequestUrl.includes("/sfsites/aura")
            || (this.responseType && this.responseType !== "text")) {
            return;
        }

        let response;
        try {
            response = JSON.parse(this.responseText);
        } catch {
            return;
        }

        const accounts = findAttendanceAccounts(response);
        if (accounts.length > 0) {
            cachedAttendanceAccounts = accounts;
            window.postMessage({ source: "mahi-tahi-helper", type: "attendance-accounts", accounts }, location.origin);
        }
    }

    /** Recursively locates the Attendance Flow's SelectedAccount choices. */
    function findAttendanceAccounts(value) {
        if (!value || typeof value !== "object") {
            return [];
        }

        if (value.flowLabel === "Community - Reports Attendance" && Array.isArray(value.fields)) {
            const accountField = value.fields.find(field => field?.name === "SelectedAccount");
            return (accountField?.choices ?? [])
                .filter(choice => typeof choice?.label === "string" && /^001[A-Za-z0-9]{12,15}$/.test(choice?.choiceValue))
                .map(choice => ({ label: choice.label, id: choice.choiceValue }));
        }

        for (const nestedValue of Object.values(value)) {
            const accounts = findAttendanceAccounts(nestedValue);
            if (accounts.length > 0) {
                return accounts;
            }
        }
        return [];
    }

    /** Replays captured choices when the isolated content script starts after Salesforce's response. */
    window.addEventListener("message", event => {
        if (event.source === window && event.data?.source === "mahi-tahi-helper"
            && event.data?.type === "request-attendance-accounts" && cachedAttendanceAccounts.length > 0) {
            window.postMessage({
                source: "mahi-tahi-helper",
                type: "attendance-accounts",
                accounts: cachedAttendanceAccounts
            }, location.origin);
        }
    });
})();
