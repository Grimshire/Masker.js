/**
 * MaskerValidator: handles required checks, single‐date validation, date‐range validation,
 * email, time, and combined date+time range validation.
 */
class MaskerValidator {  
    static triggerAllValidations() {
        // 1. Run validation Synchronously (Fixes "Save" button missing errors)
        document.querySelectorAll('[masker]').forEach(el => {
            const errorMessage = this.validate(el);
            // Find where the error should physically sit (e.g., after the Minutes dropdown)
            const anchor = this._findErrorAnchor(el); 
            
            if (errorMessage) {
                this.displayError(el, errorMessage);
            } else {
                this.clearError(el);
            }
        });

        // 2. Scrape the DOM for the results
        const formErrors = [];
        const errorSpans = document.getElementsByClassName('error-msg');

        Array.from(errorSpans).forEach(span => {
            if (span.style.display !== 'none' && span.textContent.trim() !== '') {
                const message = span.textContent.trim();
                const inputId = span.dataset.errorFor;
                const inputElement = document.getElementById(inputId);
                // Fallback to "Field" if element is missing, avoiding crashes
                const inputTitle = inputElement ? (inputElement.title || inputElement.name) : 'Field';

                formErrors.push({
                    id: inputId,
                    title: inputTitle,
                    message: message
                });
            }
        });

        return formErrors;
    }

    /**
     * The centralized validation function.
     * @param {HTMLElement} el The element to validate.
     * @param {object} priority An object defining the execution order.
     * @returns {string|null} An error message string or null if valid.
     */
    static validate(el, priority = { 'required': 1, 'format': 2, 'complex': 3 }) {
        const maskerAttr = el.getAttribute('masker') || '';

        const checkRequired = () => {
            if (el.hasAttribute('required') || maskerAttr.includes('required')) {
                return this.validateRequired(el);
            }
            return null;
        };

        const checkFormat = () => {
            if (el.value && el.value !== el.placeholder) {
                if (maskerAttr.startsWith('date')) return this.validateDate(el);
                if (maskerAttr.startsWith('email')) return this.validateEmail(el);
                if (maskerAttr.startsWith('time')) return this.validateTime(el);
            }
            return null;
        };

        const checkComplex = () => {
            if (el.dataset.pair) {
                const pairName = el.dataset.pair;
                const sd = document.querySelector(`[masker*="date begin"][data-pair="${pairName}"]`);
                const st = document.querySelector(`[masker*="time begin"][data-pair="${pairName}"]`);
                const ed = document.querySelector(`[masker*="date end"][data-pair="${pairName}"]`);
                const et = document.querySelector(`[masker*="time end"][data-pair="${pairName}"]`);

                if ((sd && ed) || (st && et)) {
                    return this.validateDateTimeRange(sd, st, ed, et);
                }
            }
            return null;
        };

        const checkFunctions = {
            required: checkRequired,
            format: checkFormat,
            complex: checkComplex
        };

        const sortedChecks = Object.keys(priority).sort((a, b) => priority[a] - priority[b]);

        for (const priFunction of sortedChecks) {
            if (checkFunctions[priFunction]) {
                const error = checkFunctions[priFunction]();
                if (error) return error;
            }
        }

        return null;
    }

    static getOrCreateErrorContainer(el, anchor) {
        if (!el.id) return null;
        
        // Find existing error container linked to this input
        let container = document.querySelector(`[data-error-for="${el.id}"]`);
        
        if (!container) {
            container = document.createElement('span');
            container.className = 'error-msg';
            // LINK to the original input (so the Save button knows what field failed)
            container.setAttribute('data-error-for', el.id);
            // PLACE after the anchor (so it fits in the UI)
            anchor.insertAdjacentElement('afterend', container);
        }
        return container;
    }

    static displayError(el, msg) {
        // Find where visual element should go
        const anchor = MaskerValidator._findErrorAnchor(el);
        const c = this.getOrCreateErrorContainer(el, anchor);
        if (!c) return;
        c.textContent = msg;
        c.style.display = 'inline';
    }

    static clearError(el) {
        const anchor = MaskerValidator._findErrorAnchor(el);
        const c = this.getOrCreateErrorContainer(el, anchor);
        if (!c) return;
        c.textContent = '';
        c.style.display = 'none';
    }

    // REQUIRED FIELD
    static validateRequired(el) {
        const maskerAttr = el.getAttribute('masker') || '';
        // Default is Strict (spaces are NOT enough). 
        // If 'white-space-okay' is found, we allow spaces to pass validation.
        const allowWhitespace = maskerAttr.includes('white-space-okay');

        const val = el.value;
        const isSelect = el.tagName.toLowerCase() === 'select';

        // 1. Check for Placeholder conflict (legacy/placeholder-as-value check)
        if (!isSelect && val === el.placeholder) {
            return el.getAttribute('data-errMsg') || 'This field is required.';
        }

        let isInvalid = false;

        if (allowWhitespace) {
            // LOOSE: User can enter "   " and it counts as valid.
            // We only fail if it is truly empty/null.
            isInvalid = !val || val.length === 0;
        } else {
            // STRICT (Default): "   " is considered empty.
            // We fail if the trimmed value is empty.
            isInvalid = !val || val.trim() === '';
        }

        if (isInvalid) {
            return el.getAttribute('data-errMsg') || 'This field is required.';
        }
        
        return null;
    }

    // SINGLE DATE
    static validateDate(el) {
        const v = el.value;
        if (!v || v === el.placeholder) return null;

        // NEW: ISO Fallback. If value is strictly YYYY-MM-DD, assume valid system date.
        // This prevents the "Strict Mode" bug that stops your calendar from loading.
        if (v.match(/^\d{4}-\d{2}-\d{2}$/)) return null;

        const mask = el.getAttribute('masker') || '';
        const rawFmt = el.getAttribute('data-format') || 'MDY';
        if (rawFmt === 'US-MIL') return null;

        const alias = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY/MM/DD', 'US-CIV': 'MM/DD/YYYY' };
        const fmt = alias[rawFmt] || rawFmt;
        const nowY = new Date().getFullYear();
        
        const allowAnyYearDigits = mask.includes('year-digits-any');
        const ignoreMax = mask.includes('ignore-max'); 

        // --- 1. Max Days Out Check ---
        const maxDaysOutAttr = el.getAttribute('data-max-days-out');
        if (maxDaysOutAttr) {
            const userDate = this.#toDate(el);
            if (userDate) {
                const maxDaysOut = parseInt(maxDaysOutAttr, 10);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const cutoffDate = new Date(today);
                cutoffDate.setDate(today.getDate() + maxDaysOut);
                if (userDate > cutoffDate) {
                    return el.getAttribute('data-max-days-errmsg') || `Date cannot be more than ${maxDaysOut} days in the future.`;
                }
            }
        }

        // --- 2. Normalize & Split ---
        const parts = v.split(/[^0-9]+/).filter(x => x);
        if (parts.length !== 3) return 'Date is not valid.';

        let rawY, rawM, rawD;

        if (fmt.startsWith('Y')) {
            [rawY, rawM, rawD] = parts;
        } else if (fmt.startsWith('D')) {
            [rawD, rawM, rawY] = parts;
        } else {
            [rawM, rawD, rawY] = parts;
        }

        const normM = rawM.padStart(2, '0');
        const normD = rawD.padStart(2, '0');
        const normY = rawY; 

        // --- 3. Validate Year ---
        const isValidLen = allowAnyYearDigits ? normY.length > 0 : normY.length === 4;
        if (!isValidLen) return allowAnyYearDigits ? 'Year is required.' : 'Year must be 4 digits.';

        const y = parseInt(normY, 10);
        if (isNaN(y)) return 'Year is not valid.';

        if (!mask.includes('ancient future')) {
            if (mask.includes('ancient') && y > nowY) return 'Year cannot be in the future.';
            if (mask.includes('future') && y < nowY) return 'Year cannot be in the past.';
            
            if (mask.includes('2000')) {
                if (y < 2000) return `Year cannot be before 2000.`;
                if (!ignoreMax && y > nowY) return `Year must be between 2000 and ${nowY}.`;
            }
            
            if (mask.includes('1900')) {
                if (y < 1900) return `Year cannot be before 1900.`;
                if (!ignoreMax && y > nowY) return `Year must be between 1900 and ${nowY}.`;
            }

            // Default Scheduling Logic (Future Only)
            if (!allowAnyYearDigits && !mask.includes('ancient') && !mask.includes('1900') && !mask.includes('2000') && y < nowY) {
                return `Year cannot be before ${nowY}.`;
            }
        }

        // --- 4. Validate Month ---
        const m = parseInt(normM, 10);
        if (isNaN(m) || m < 1 || m > 12) return 'Month must be 01-12.';

        // --- 5. Validate Day ---
        const d = parseInt(normD, 10);
        if (isNaN(d) || d < 1 || d > 31) return 'Day must be 01-31.';

        const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let maxDays = daysInMonth[m];

        if (m === 2) {
             const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
             if (isLeap) maxDays = 29;
        }

        if (d > maxDays) return `Invalid date: ${m}/${d} does not exist in year ${y}.`;

        return null;
    }
    

    // DATE‐ONLY RANGE
    static validateDateRange(startEl, endEl) {
        if (!startEl.value || !endEl.value) return null;

        const d1 = this.#toDate(startEl);
        const d2 = this.#toDate(endEl);
        if (!d1 || !d2) return null;

        if (d1 > d2) {
            const t1 = startEl.title || 'Start date';
            const t2 = endEl.title || 'End date';
            return startEl.dataset.errMsgRangeStart || `${t1} cannot be set after ${t2}`;
        }

        return null;
    }

    // EMAIL
    static validateEmail(el) {
        if (!el.value) return null;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(el.value)) {
            return el.getAttribute('data-errMsg') || 'Please enter a valid email address.';
        }
        return null;
    }

    // TIME
    static validateTime(el) {
        const totalMinutes = this.#toTime(el);
        if (el.value && totalMinutes === null) {
            return 'Please enter a valid time (HH:MM).';
        }
        return null;
    }

    static findNextSelectWithPartialId(element, partialId) {
        let nextSibling = element.nextElementSibling;

        while (nextSibling) {
            if (nextSibling.tagName === 'SELECT' && nextSibling.id.includes(partialId)) {
                return nextSibling;
            }
            nextSibling = nextSibling.nextElementSibling;
        }
        return null;
    }

    static validateDateTimeRange(sd, st, ed, et) {
        const hasSD = sd && sd.value && sd.value !== sd.placeholder;
        const hasED = ed && ed.value && ed.value !== ed.placeholder;
        const t1 = st ? this.#toTime(st) : null;
        const t2 = et ? this.#toTime(et) : null;
        const hasST = t1 !== null;
        const hasET = t2 !== null;

        // Helper to get custom message or default
        const getMsg = (defaultMsg) => {
            return sd.getAttribute('data-err-msg-range') || 
                   ed.getAttribute('data-err-msg-range') || 
                   defaultMsg;
        };

        if (hasSD && hasED && !hasST && !hasET) return this.validateDateRange(sd, ed);

        if (hasST && hasET && !hasSD && !hasED) {
            if (t1 >= t2) return getMsg('End time must be after start time.');
        }

        if (hasSD && hasST && hasED && hasET) {
            const d1_obj = this.#toDate(sd);
            const d2_obj = this.#toDate(ed);
            if (!d1_obj || !d2_obj) return null;

            if (d1_obj.toDateString() === d2_obj.toDateString()) {
                if (t1 >= t2) return getMsg('End time must be after start time on the same day.');
            } else {
                const dt1 = this.#toDateTime(sd, st);
                const dt2 = this.#toDateTime(ed, et);
                if (!dt1 || !dt2 || dt1 > dt2) return getMsg('End date must be on or after the start date.');
            }
        }
        return null;
    }

    static #toDate(el) {
        if (!el || !el.value) return null;
        const v = el.value.trim();

        // --- NEW: ROBUST ISO FALLBACK ---
        // Instead of strict match, we look for YYYY-MM-DD or YYYY/MM/DD at the START.
        // This accepts "2026-01-15", "2026-01-15T12:00:00Z", "2026/01/15", etc.
        const isoMatch = v.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})/);
        
        if (isoMatch) {
            const y = parseInt(isoMatch[1], 10);
            const m = parseInt(isoMatch[2], 10);
            const d = parseInt(isoMatch[3], 10);
            
            // Basic sanity check to ensure it's a real date
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return new Date(y, m - 1, d);
            }
        }

        // --- Standard Parsing Logic ---
        const raw = el.getAttribute('data-format') || 'MDY';
        const alias = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY/MM/DD', 'US-CIV': 'MM/DD/YYYY' };
        const fmt = alias[raw] || raw;
        
        // Strictly split by non-digits
        const parts = v.split(/[^0-9]+/).filter(p => p !== "").map(n => parseInt(n, 10));
        
        // Strict length check (Must be exactly 3 parts: M, D, Y)
        if (parts.length !== 3) return null;

        let [mm, dd, yy] = [NaN, NaN, NaN];
        
        if (fmt.startsWith('M')) [mm, dd, yy] = parts;
        else if (fmt.startsWith('D')) [dd, mm, yy] = parts;
        else if (fmt.startsWith('Y')) [yy, mm, dd] = parts;
        else return null; 

        if ([mm, dd, yy].some(n => isNaN(n))) return null;
        if (mm < 1 || mm > 12) return null;
        if (dd < 1 || dd > 31) return null;

        const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let maxDays = daysInMonth[mm];

        if (mm === 2) {
             const isLeap = (yy % 4 === 0 && yy % 100 !== 0) || (yy % 400 === 0);
             if (isLeap) maxDays = 29;
        }

        if (dd > maxDays) return null;

        return new Date(yy, mm - 1, dd);
    }

    static #toTime(el) {
        // Handle native time inputs
        if (el.type === 'time') {
            if (!el.value) return null;
            const [h, m] = el.value.split(':').map(n => parseInt(n, 10));
            if (isNaN(h) || isNaN(m)) return null;
            if (h < 0 || h > 23 || m < 0 || m > 59) return null; // Range check
            return h * 60 + m;
        }

        // Handle text inputs masked as time
        const val = el.value;
        if (!val || !val.includes(':')) return null;

        const parts = val.split(':');
        const hrs = parseInt(parts[0], 10);
        
        // Handle SharePoint style selects if present (legacy support)
        const $el = el.closest('td, .ms-dtinput');
        const minsSelect = $el ? $el.querySelector('select[id*="Minutes"]') : null;
        
        // If minutes are in a select dropdown, use that, otherwise parse from string
        const mins = minsSelect ? parseInt(minsSelect.value, 10) : parseInt(parts[1], 10);

        if (isNaN(hrs) || isNaN(mins)) return null;
        
        // Strict Range Check
        if (hrs < 0 || hrs > 23) return null;
        if (mins < 0 || mins > 59) return null;

        return hrs * 60 + mins;
    }

    static #toDateTime(de, te) {
        const dateObj = this.#toDate(de);
        const mins = this.#toTime(te);
        if (!dateObj || mins === null) return null;
        dateObj.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return dateObj;
    }

    static _findErrorAnchor(el) {
        // 1. Check for explicit override attribute (YOUR NEW LOGIC)
        if (el.hasAttribute('data-error-anchor')) {
            const anchorId = el.getAttribute('data-error-anchor');
            if (anchorId === 'self') return el;
            
            const customAnchor = document.getElementById(anchorId);
            if (customAnchor) return customAnchor;
        }

        // 2. Existing Logic (RESTORED)
        // This ensures fields using 'data-pair' without your new attribute still work
        if (el.dataset.pair) {
            const pairName = el.dataset.pair;
            const endEl = document.querySelector(`[masker*="end"][data-pair="${pairName}"]`);
            if (endEl) {
                const timePartner = endEl.getAttribute('masker')?.includes('time') ? endEl : document.querySelector(`[masker*="time end"][data-pair="${pairName}"]`);
                if (timePartner) {
                    return MaskerValidator.findNextSelectWithPartialId(timePartner, 'Minutes') || timePartner;
                }
                return endEl;
            }
        }

        return el;
    }
}


/**
 * Masker: scans the DOM for [masker], wires up masks & blur-listeners,
 * and defers to Validator for inline errors.
 */
class Masker {
    // registry for observers: each record { target, observer, descriptor }
    static _observers = [];

    // Utility: is element visible (conservative)
    static #isVisible(el) {
        try {
            if (!el || !el.ownerDocument) return false;
            const s = getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
        } catch (e) {
            return true;
        }
    }

    // Utility: safely attempt to set selection, deferring if not visible
    static #trySetSelection(el, start = 0, end = 0) {
        try {
            if (this.#isVisible(el)) {
                el.setSelectionRange(start, end);
                return;
            }
            requestAnimationFrame(() => {
                try { el.setSelectionRange(start, end); } catch (e) { /* ignore */ }
            });
        } catch (e) {
            // ignore environments where setSelectionRange isn't supported
        }
    }

    /**
     * init:
     * - No-arg: scans whole document for [masker], [required]
     * - String arg:
     *   - '#id' or '.class' => scope to that container and scan inside it for [masker],[required]
     *   - other string => treated as explicit selector
     * - Object arg: { selector, includeHidden, observe, container (optional) }
     */
    static init(arg = {}) {
        // defaults
        let selector = '[masker], [required]';
        let includeHidden = false;
        let observe = false;
        let containerElement = null;
        let explicitSelectorProvided = false;

        // normalize argument
        if (typeof arg === 'string') {
            if (arg.startsWith('#') || arg.startsWith('.')) {
                // scope to that container for the default tokens
                containerElement = document.querySelector(arg) || null;
            } else {
                selector = arg; // explicit selector
                explicitSelectorProvided = true;
            }
        } else if (typeof arg === 'object' && arg !== null) {
            selector = arg.selector || selector;
            includeHidden = !!arg.includeHidden;
            observe = !!arg.observe;
            if (arg.container) {
                try {
                    containerElement = arg.container.nodeType ? arg.container : document.querySelector(arg.container);
                } catch (e) {
                    containerElement = null;
                }
            }
            if (typeof arg.selector === 'string' && (arg.selector.startsWith('#') || arg.selector.startsWith('.'))) {
                containerElement = document.querySelector(arg.selector) || containerElement;
                selector = '[masker], [required]';
                explicitSelectorProvided = false;
            } else {
                explicitSelectorProvided = (arg.selector !== undefined && arg.selector !== '[masker], [required]');
            }
        }

        // Query nodes: if containerElement is provided and selector is default tokens, query inside container
        let nodes = [];
        try {
            if (containerElement && selector === '[masker], [required]') {
                nodes = Array.from(containerElement.querySelectorAll(selector));
            } else {
                nodes = Array.from(document.querySelectorAll(selector));
            }
        } catch (e) {
            // fallback: try querying document with default tokens
            try {
                nodes = Array.from(document.querySelectorAll('[masker], [required]'));
            } catch (e2) {
                nodes = [];
            }
        }

        // Bind each node
        nodes.forEach(el => this.#bindElement(el, includeHidden));

        // Setup observer(s) if requested
        if (observe) {
            const observeTarget = (containerElement && containerElement.nodeType) ? containerElement : document.body;

            const descriptor = {
                selector: selector,
                includeHidden: !!includeHidden,
                explicitSelectorProvided: !!explicitSelectorProvided
            };

            const descriptorEquals = (a, b) => a.selector === b.selector && a.includeHidden === b.includeHidden && a.explicitSelectorProvided === b.explicitSelectorProvided;

            let existing = null;
            for (const rec of this._observers) {
                if (rec.target === observeTarget && descriptorEquals(rec.descriptor, descriptor)) {
                    existing = rec;
                    break;
                }
            }

            if (!existing) {
                const mo = new MutationObserver(mutations => {
                    for (const m of mutations) {
                        if (m.type !== 'childList') continue;
                        m.addedNodes.forEach(node => {
                            if (node.nodeType !== 1) return;
                            try {
                                if (descriptor.explicitSelectorProvided && descriptor.selector && descriptor.selector !== '[masker], [required]') {
                                    try { if (node.matches && node.matches(descriptor.selector)) this.#bindElement(node, descriptor.includeHidden); } catch (e) { /* ignore invalid selector */ }
                                    if (node.querySelectorAll) {
                                        try { node.querySelectorAll(descriptor.selector).forEach(n => this.#bindElement(n, descriptor.includeHidden)); } catch (e) { /* ignore invalid selector */ }
                                    }
                                } else {
                                    if (node.matches && (node.matches('[masker]') || node.matches('[required]'))) this.#bindElement(node, descriptor.includeHidden);
                                    if (node.querySelectorAll) node.querySelectorAll('[masker], [required]').forEach(n => this.#bindElement(n, descriptor.includeHidden));
                                }
                            } catch (ignore) { /* defensive */ }
                        });
                    }
                });

                mo.observe(observeTarget, { childList: true, subtree: true });

                this._observers.push({
                    target: observeTarget,
                    observer: mo,
                    descriptor: descriptor
                });
            }
        }

        return this;
    }

    // Exposed helper: run quick visibility-dependent steps after a container becomes visible
    static refreshVisible(container = document) {
        const root = container && container.nodeType ? container : (typeof container === 'string' ? document.querySelector(container) || document : document);
        root.querySelectorAll('[masker]').forEach(el => {
            try {
                const m = el.getAttribute('masker') || '';
                if (m.includes('char-count')) {
                    const fb = document.querySelector(`[data-feedback-for="${el.id}"]`);
                    if (fb && this.#isVisible(el)) {
                        fb.style.display = 'block';
                        const rawText = (el.textContent || '').trim() ? el.textContent : (el.value || '');
                        const cleanedText = rawText.replace(/\u200B|\r|\n/g, '');
                        const currLength = cleanedText.length;
                        const maxLength = el.getAttribute('maxlength') || el.maxLength;
                        fb.textContent = `${currLength} / ${maxLength}`;
                    }
                }

                if (this.#isVisible(el)) {
                    const mLower = (el.getAttribute('masker') || '').toLowerCase();
                    if (mLower.includes('date') || mLower.includes('phone') || mLower.includes('email')) {
                        try { el.setSelectionRange(0, 0); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) { /* defensive */ }
        });
    }

    // In class Masker
    static #bindElement(el, includeHidden = false) {
    if (!el || el.dataset.maskBound === 'true') return;
    if (!el.isConnected) return;

    if (!includeHidden) {
        try {
            if (!this.#isVisible(el)) return;
        } catch (e) { /* ignore */ }
    }

    el.dataset.maskBound = 'true';

    // This listener triggers the validation logic below
    el.addEventListener('blur', e => this.#handleValidation(e.target));

    const m = el.getAttribute('masker');

    if (!m) {
        this.#addRequiredValidation(el);
        return;
    }

    const tokenizedArr = m.split(' ').filter(Boolean);

    if (tokenizedArr.includes('char-count')) this.#setupCharCounter(el);
    else if (tokenizedArr.includes('number')) {
        const minNum = el.min ? parseInt(el.min, 10) : null;
        const maxNum = el.max ? parseInt(el.max, 10) : null;
        this.#setupNumberMask(el, minNum, maxNum);
    }
    else if (tokenizedArr.includes('phone')) this.#setupPhoneMask(el);
    else if (tokenizedArr.includes('email')) this.#setupEmailMask(el);
    else if (tokenizedArr.includes('time')) this.#setupTimeField(el);
    else if (tokenizedArr.includes('date')) {
        this.#setupDateMask(el);
        el.addEventListener('change', e => this.#handleValidation(e.target));
    }

    if (tokenizedArr.includes('special')) {
        this.#setupFilterSpecialCharactersMask(el);
    }

    this.#addRequiredValidation(el);
}

    // In class Masker

    static #clearAllErrorsForPair(el) {
        // Always clear the current element's error
        MaskerValidator.clearError(el);

        // FEATURE: If 'single-line-errors' is present, DO NOT clear the partner's errors.
        // This allows errors to exist on both lines simultaneously.
        if (el.hasAttribute('single-line-errors')) {
            return;
        }

        // DEFAULT: Legacy behavior clears all errors in the pair to prevent stale messages
        if (el.dataset.pair) {
            const pairName = el.dataset.pair;
            document.querySelectorAll(`[data-pair="${pairName}"]`).forEach(p => {
                MaskerValidator.clearError(p);
                if (p.getAttribute('masker')?.includes('time')) {
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(p, 'Minutes');
                    if (minutesSelect) MaskerValidator.clearError(minutesSelect);
                }
            });
        }
    }

    static #handleValidation(el) {
        setTimeout(() => {
            this.#clearAllErrorsForPair(el);
            
            const errorMessage = MaskerValidator.validate(el);
            if (errorMessage) {
                // displayError handles finding the anchor (e.g. Minutes dropdown) internally
                MaskerValidator.displayError(el, errorMessage);
            }

            // Sync Check for 'single-line-errors' mode
            // If we didn't clear the partner above, we must re-validate them now
            // to ensure they don't show a stale error if the conflict is resolved.
            if (el.hasAttribute('single-line-errors') && el.dataset.pair) {
                const pairName = el.dataset.pair;
                document.querySelectorAll(`[data-pair="${pairName}"]`).forEach(p => {
                    if (p === el) return;
                    
                    const pError = MaskerValidator.validate(p);
                    if (pError) {
                        MaskerValidator.displayError(p, pError);
                    } else {
                        MaskerValidator.clearError(p);
                    }
                });
            }
        }, 300);
    }
   

    static #addRequiredValidation(el) {
        const m = el.getAttribute('masker') || '';
        if (el.hasAttribute('required') || m.includes('required')) {
            el.addEventListener('blur', e => MaskerValidator.validateRequired(e.target));
            el.addEventListener('input', e => MaskerValidator.clearError(e.target));
        }
    }

    // DATE MASK + VALIDATION
    static #setupDateMask(el) {
        const maskAttr = el.getAttribute('masker') || '';
        const rawFmt = el.getAttribute('data-format') || 'MDY';
        const alias = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY/MM/DD', 'US-CIV': 'MM/DD/YYYY' };
        const fmt = alias[rawFmt] || rawFmt;
        const ph = fmt.replace(/[MDY]/g, '_');
        const visible = maskAttr.includes('visible');

        if (rawFmt === 'US-MIL') {
            return this.#setupMilDateMask(el);
        }

        if (visible) el.value = ph;

        const onInput = e => {
            this.#applyDateMask(e, fmt);
            MaskerValidator.clearError(e.target);
        };

        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = ph;
                this.#trySetSelection(e.target, 0, 0);
            }
        });
        el.addEventListener('input', onInput);
        el.addEventListener('keydown', e => {
            if (e.target.value === ph && e.key === 'Backspace') e.target.value = '';
        });

        // --- UPDATED BLUR LISTENER ---
        el.addEventListener('blur', e => {
            if (e.target.value === ph && !visible) {
                e.target.value = '';
            }

            const errorMessage = MaskerValidator.validate(e.target);

            // SIMPLIFIED: Pass e.target directly. 
            // displayError will call _findErrorAnchor internally to place the text,
            // but keeps the error ID linked to e.target.
            if (errorMessage) {
                MaskerValidator.displayError(e.target, errorMessage);
            } else {
                MaskerValidator.clearError(e.target);
                
                // Also clear the visual anchor if it's different
                // (This handles the case where the error was previously shown on the anchor)
                const anchor = MaskerValidator._findErrorAnchor(e.target);
                if (anchor !== e.target) MaskerValidator.clearError(anchor);
            }
        });
    }

    static #setupMilDateMask(el) {
        const placeholder = 'YYYY MMM DD';
        if (el.getAttribute('masker').includes('visible')) el.value = placeholder;
        
        el.addEventListener('input', this.#applyMilDateMask);
        
        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = placeholder;
                this.#trySetSelection(e.target, 0, 0);
            }
        });
        
        el.addEventListener('keydown', e => {
            if (e.target.value === placeholder && e.key === 'Backspace') {
                e.target.value = '';
            }
        });

        // --- CORRECTED BLUR LISTENER ---
        el.addEventListener('blur', e => {
            if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
                e.target.value = '';
            }

            const errorMessage = MaskerValidator.validate(e.target);

            if (errorMessage) {
                // Pass e.target directly. 
                // displayError will call _findErrorAnchor internally to place the text correctly.
                MaskerValidator.displayError(e.target, errorMessage);
            } else {
                MaskerValidator.clearError(e.target);
                
                // Clear the visual anchor if it is different from the input
                // We use the centralized helper here too
                const anchor = this._findErrorAnchor(e.target);
                if (anchor !== e.target) MaskerValidator.clearError(anchor);
            }
        });
    }

    static #applyMilDateMask(e) {
        const i = e.target;
        const c = i.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        let out = c.slice(0, 4);
        if (c.length > 4) out += ' ' + c.slice(4, 7);
        if (c.length > 7) out += ' ' + c.slice(7, 9);
        i.value = out;
    }

    static #applyDateMask(e, fmt) {
        const i = e.target;
        const c = i.value.replace(/\D/g, '');
        let out = '', ci = 0;
        for (let j = 0; j < fmt.length && ci < c.length; j++) {
            out += /[MDY]/.test(fmt[j]) ? c[ci++] : fmt[j];
        }
        i.value = out;
    }

    // CHAR COUNTER
    static #setupCharCounter(el) {
        let fb = document.querySelector(`[data-feedback-for="${el.id}"]`);

        if (!fb) {
            fb = document.createElement('span');
            fb.className = 'char-counter-feedback';
            fb.dataset.feedbackFor = el.id;
            el.insertAdjacentElement('afterend', fb);
        }

        const visibleToken = el.getAttribute('masker').includes('visible');
        if (!visibleToken) {
            fb.style.display = 'none';
        } else {
            if (this.#isVisible(el)) {
                this.#updateCharCount(el, fb);
            }
        }

        el.addEventListener('keydown', e => this.#limitInput(e));
        el.addEventListener('input', () => {
            if (this.#isVisible(el)) {
                this.#updateCharCount(el, fb);
            } else {
                const rawText = (el.textContent || '').trim() ? el.textContent : (el.value || '');
                const cleanedText = rawText.replace(/\u200B|\r|\n/g, '');
                const currLength = cleanedText.length;
                const maxLength = el.getAttribute('maxlength') || el.maxLength;
                fb.textContent = `${currLength} / ${maxLength}`;
            }
        });
    }

    static #updateCharCount(el, fb) {
        if (!this.#isVisible(el)) return;
        if (fb.style.display === 'none') fb.style.display = 'block';

        const rawText = (el.textContent || '').trim() ? el.textContent : (el.value || '');
        const cleanedText = rawText.replace(/\u200B|\r|\n/g, '');

        const currLength = cleanedText.length;
        const maxLength = el.getAttribute('maxlength') || el.maxLength;

        fb.textContent = `${currLength} / ${maxLength}`;
    }

    // NUMBER MASK
    static #setupNumberMask(el, minNum, maxNum) {
        el.addEventListener('input', e => {
            const target = e.target;
            target.value = target.value.replace(/\D/g, '').slice(0, target.maxLength);

            const currValStr = target.value;
            if (currValStr === '') {
                target.style.backgroundColor = '';
                target.style.color = '';
                return;
            }

            const currValNum = parseInt(currValStr, 10);
            const isTooLow = minNum !== null && currValNum < minNum;
            const isTooHigh = maxNum !== null && currValNum > maxNum;

            if (isTooLow || isTooHigh) {
                target.style.backgroundColor = '#D32F2F';
                target.style.color = 'white';

                setTimeout(() => {
                    target.style.backgroundColor = '';
                    target.style.color = '';

                    if (isTooLow) {
                        target.value = minNum;
                    } else if (isTooHigh) {
                        target.value = maxNum;
                    }
                }, 400);
            } else {
                target.style.backgroundColor = '';
                target.style.color = '';
            }
        });
    }

    // SPECIAL CHARACTERS MASK
    static #setupFilterSpecialCharactersMask(el) {
        el.addEventListener('input', e => {
            const input = e.target;
            const extraAllowed = input.dataset.allowChars || '';
            const escapedExtra = extraAllowed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const filterRegex = new RegExp(`[^a-zA-Z0-9_${escapedExtra}-]`, 'g');
            input.value = input.value.replace(filterRegex, '');
        });
    }

    // PHONE MASK
    static #setupPhoneMask(el) {
        const formats = {
            US: '(000) 000-0000', DSN: '000-000-0000', UK: '00000 000000',
            FR: '00 00 00 00 00', DE: '0000 0000000', JP: '000-0000-0000',
            IN: '00000 00000', CN: '000 0000 0000', KR: '00-0000-0000',
            BR: '(00) 00000-0000', AR: '(000) 0000-0000', AU: '0000 000 000'
        };
        const fmt = formats[el.getAttribute('data-format') || 'US'] || el.getAttribute('data-format');
        const placeholder = fmt.replace(/0/g, '_');
        if (el.getAttribute('masker').includes('visible')) {
            el.value = placeholder;
        }

        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = placeholder;
                this.#trySetSelection(e.target, 0, 0);
            }
        });
        el.addEventListener('input', e => this.#applyPatternMask(e, fmt, '0'));
        el.addEventListener('keydown', e => {
            if (e.target.value === placeholder && e.key === 'Backspace') {
                e.target.value = '';
            }
        });

        el.addEventListener('blur', e => {
            if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
                e.target.value = '';
            }

            const errorMessage = MaskerValidator.validate(e.target);

            if (errorMessage) {
                MaskerValidator.displayError(e.target, errorMessage);
            } else {
                MaskerValidator.clearError(e.target);
            }
        });
    }

    static #applyPatternMask(e, fmt, ph) {
        const input = e.target;
        const digits = input.value.replace(/\D/g, '');
        let out = '', di = 0;
        for (let i = 0; i < fmt.length && di < digits.length; i++) {
            out += (fmt[i] === ph ? digits[di++] : fmt[i]);
        }
        input.value = out;
    }

    // EMAIL MASK
    static #setupEmailMask(el) {
        const placeholder = '___@___';

        const setPlaceholder = () => {
            if (!el.value) {
                el.value = placeholder;
                el.classList.add('placeholder-text');
            }
        };

        const removePlaceholder = () => {
            if (el.value === placeholder) {
                el.value = '';
            }
            el.classList.remove('placeholder-text');
        };

        el.addEventListener('focus', setPlaceholder);
        el.addEventListener('keydown', e => {
            if (el.value === placeholder && !['Tab', 'Shift', 'Control', 'Alt'].includes(e.key)) {
                removePlaceholder();
            }
        });
        el.addEventListener('input', e => this.#applyEmailMask(e));

        el.addEventListener('blur', () => {
            if (el.value === placeholder) {
                removePlaceholder();
            }

            const errorMessage = MaskerValidator.validate(el);

            if (errorMessage) {
                MaskerValidator.displayError(el, errorMessage);
            } else {
                MaskerValidator.clearError(el);
            }
        });
    }

    static #applyEmailMask(e) {
        const input = e.target;
        const validChars = /[^a-zA-Z0-9-._@]/g;
        input.value = input.value.replace(validChars, '').replace(/\s/g, '');
    }

    // TIME FIELD MASK + BLUR
    static #setupTimeField(el) {
        const maskAttr = el.getAttribute('masker') || '';
        const isBegin = maskAttr.includes('time begin');
        const isEnd = maskAttr.includes('time end');

        if (el.tagName === 'INPUT' && el.type === 'time') {
            el.addEventListener('blur', e => {
                const errorMessage = MaskerValidator.validate(e.target);
                if (errorMessage) {
                    MaskerValidator.displayError(e.target, errorMessage);
                } else {
                    MaskerValidator.clearError(e.target);
                }
            });
            return;
        }

        if (isBegin || isEnd) {
            const container = el.closest('td, .ms-dtinput');
            if (!container) {
                // Bail gracefully; observer binding will attach later if observe:true
                return;
            }
            container.querySelectorAll('select').forEach(select => {
                select.addEventListener('blur', () => {
                    const errorMessage = MaskerValidator.validate(el);
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(el, 'Minutes');

                    if (errorMessage) {
                        MaskerValidator.displayError(minutesSelect || el, errorMessage);
                    } else {
                        MaskerValidator.clearError(el);
                        if (minutesSelect) MaskerValidator.clearError(minutesSelect);
                    }
                });
            });
        }
    }

    static #limitInput(e) {
        const t = e.target;
        if (t.maxLength < 0) return;
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
        const currLength = (t.textContent || '').length || (t.value || '').length;
        if (currLength >= t.maxLength && !allowed.includes(e.key)) {
            e.preventDefault();
        }
    }

    // Helper to disconnect observers for cleanup if needed
    static disconnectObserverFor(target) {
        const observeTarget = target && target.nodeType ? target : (typeof target === 'string' ? document.querySelector(target) : document.body);
        for (let i = this._observers.length - 1; i >= 0; i--) {
            const rec = this._observers[i];
            if (rec.target === observeTarget) {
                try { rec.observer.disconnect(); } catch (e) { /* ignore */ }
                this._observers.splice(i, 1);
            }
        }
    }
}

// initialize on DOM ready with sensible defaults
document.addEventListener('DOMContentLoaded', () => Masker.init());