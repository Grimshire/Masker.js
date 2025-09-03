/**
 * MaskerValidator: handles required checks, single‐date validation, date‐range validation,
 * email, time, and combined date+time range validation.
 */
class MaskerValidator {
    static triggerAllValidations() {
        // Triggers all the inline validation events first.
        document.querySelectorAll('[masker]').forEach(el => {
            el.dispatchEvent(new Event('blur'));
        });

        const formErrors = [];
        const errorSpans = document.getElementsByClassName('error-msg');

        // Convert the HTMLCollection to an array to loop through it.
        Array.from(errorSpans).forEach(span => {
            // Only collect visible errors that contain a message.
            if (span.style.display !== 'none' && span.textContent.trim() !== '') {
                const message = span.textContent.trim();

                // Get the ID of the invalid input from the 'data-error-for' attribute.
                const inputId = span.dataset.errorFor;
                const inputElement = document.getElementById(inputId);


                const inputTitle = inputElement ? (inputElement.title || inputElement.name) : 'Field';
                const label = document.querySelector(`label[for="${inputId}"]`);



                // Push an object with the details into the array.
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
 * The new, centralized validation function. It runs all applicable checks for an
 * element in a specific order and returns the first error found.
 * @param {HTMLElement} el The element to validate.
 * @param {object} priority An object defining the execution order.
 * @returns {string|null} An error message string or null if valid.
 */
    static validate(el, priority = { 'required': 1, 'format': 2, 'complex': 3 }) {
        const maskerAttr = el.getAttribute('masker') || '';

        const checkRequired = () => {
            if (el.hasAttribute('required') || maskerAttr.includes('required')) {
                // returns an error message or null
                return this.validateRequired(el);
            }
            return null;
        };

        const checkFormat = () => {
            if (el.value && el.value !== el.placeholder) {
                if (maskerAttr.startsWith('date')) return this.validateDate(el);
                if (maskerAttr.startsWith('email')) return this.validateEmail(el);
                if (maskerAttr.startsWith('time')) return this.validateTime(el);
                // Add other single-field format checks here
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

                if (sd && ed) {
                    return this.validateDateTimeRange(sd, st, ed, et);
                }
            }
            return null;
        };

        // A map to associate priority keys with their functions
        const checkFunctions = {
            required: checkRequired,
            format: checkFormat,
            complex: checkComplex
        };

        // Correctly sort the keys by priority number, lowest to highest (1, 2, 3)
        const sortedChecks = Object.keys(priority).sort((a, b) => priority[a] - priority[b]);

        // Iterate through the checks in the correct order
        for (const priFunction of sortedChecks) {
            if (checkFunctions[priFunction]) {
                const error = checkFunctions[priFunction]();
                // If an error message is returned, stop and return it immediately.
                if (error) {
                    return error;
                }
            }
        }

        // If all checks pass, return null.
        return null;
    }

    static getOrCreateErrorContainer(el) {
        if (!el.id) {
            console.error("Element must have an id to show errors.", el);
            return null;
        }
        let container = document.querySelector(`[data-error-for="${el.id}"]`);
        if (!container) {
            container = document.createElement('span');
            container.className = 'error-msg';
            container.setAttribute('data-error-for', el.id);
            el.insertAdjacentElement('afterend', container);
        }
        return container;
    }

    static displayError(el, msg) {
        const c = this.getOrCreateErrorContainer(el);
        if (!c) return;
        c.textContent = msg;
        c.style.display = 'inline';
        //console.log(`displayError called: ${el.title || el.textContent}. ${msg}`, el);
    }

    static clearError(el) {
        const c = this.getOrCreateErrorContainer(el);
        if (!c) return;
        //console.log(`clearError called: ${el.title || el.textContent}.`, el);
        c.textContent = '';
        c.style.display = 'none';
    }

    // REQUIRED FIELD
    static validateRequired(el) {
        const isSelect = el.tagName.toLowerCase() === 'select';
        const isInvalid = isSelect
            ? !el.value || el.value.trim() === ''
            : !el.value || el.value === el.placeholder;

        if (isInvalid) {
            return el.getAttribute('data-errMsg') || 'This field is required.';
        }
        return null; // Changed from return true
    }

    // SINGLE DATE
    static validateDate(el) {
        const v = el.value;
        if (!v || v === el.placeholder) return null;

        const mask = el.getAttribute('masker') || '';
        const rawFmt = el.getAttribute('data-format') || 'MDY';
        if (rawFmt === 'US-MIL') return null;

        const alias = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY/MM/DD', 'US-CIV': 'MM/DD/YYYY' };
        const fmt = alias[rawFmt] || rawFmt;
        const nowY = new Date().getFullYear();

        // YEAR
        const yi = fmt.indexOf('YYYY');
        const yText = v.substring(yi, yi + 4);
        if (yi >= 0 && yText.length === 4 && !mask.includes('ancient future')) {
            const y = parseInt(yText, 10);
            if (mask.includes('ancient') && y > nowY) return 'Year cannot be in the future.';
            if (mask.includes('future') && y < nowY) return 'Year cannot be in the past.';
            if (mask.includes('2000') && (y < 2000 || y > nowY)) return `Year must be between 2000 and ${nowY}.`;
            if (mask.includes('1900') && (y < 1900 || y > nowY)) return `Year must be between 1900 and ${nowY}.`;
            if (!mask.includes('ancient') && !mask.includes('1900') && !mask.includes('2000') && y < nowY) return `Year cannot be before ${nowY}.`;
        }

        // MONTH
        const mi = fmt.indexOf('MM');
        if (mi >= 0) {
            const m = parseInt(v.substring(mi, mi + 2), 10);
            if (m < 1 || m > 12) return 'Month must be 01-12.';
        }

        // DAY
        const di = fmt.indexOf('DD');
        if (di >= 0) {
            const d = parseInt(v.substring(di - 1, di + 1), 10);
            if (d < 1 || d > 31) return 'Day must be 01-31.';
        }

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
            // Check if the next sibling is a <select> element and its ID contains the partialId
            if (nextSibling.tagName === 'SELECT' && nextSibling.id.includes(partialId)) {
                return nextSibling; // Found the matching element
            }
            nextSibling = nextSibling.nextElementSibling; // Move to the next sibling
        }
        return null; // No matching element found
    }

    // COMBINED DATE + TIME RANGE
    static validateDateTimeRange(sd, st, ed, et) {
        const hasSD = sd && sd.value && sd.value !== sd.placeholder;
        const hasED = ed && ed.value && ed.value !== ed.placeholder;
        const t1 = st ? this.#toTime(st) : null;
        const t2 = et ? this.#toTime(et) : null;
        const hasST = t1 !== null;
        const hasET = t2 !== null;

        // Case 1: A date-only range. We delegate to the simpler function and exit.
        if (hasSD && hasED && !hasST && !hasET) {
            return this.validateDateRange(sd, ed);
        }

        // Case 2: A full date and time range.
        if (hasSD && hasST && hasED && hasET) {
            const d1_obj = this.#toDate(sd);
            const d2_obj = this.#toDate(ed);
            if (!d1_obj || !d2_obj) return null; // Exit if dates are invalid

            // Sub-condition: If the dates are the same, we only need to compare the times.
            if (d1_obj.toDateString() === d2_obj.toDateString()) {
                if (t1 >= t2) {
                    return 'End time must be after start time on the same day.';
                }
            } else {
                // Sub-condition: If dates are different, compare the full datetime.
                const dt1 = this.#toDateTime(sd, st);
                const dt2 = this.#toDateTime(ed, et);
                if (!dt1 || !dt2 || dt1 >= dt2) {
                    return 'End date must be on or after the start date.';
                }
            }
        }

        // If neither of the above validation cases applied, there is no error.
        return null;
    }

    // HELPERS
    static #toDate(el) {
        const raw = el.getAttribute('data-format') || 'MDY';
        const alias = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY/MM/DD', 'US-CIV': 'MM/DD/YYYY' };
        const fmt = alias[raw] || raw;
        const parts = el.value.split(/[^0-9]/).map(n => parseInt(n, 10));
        let [mm, dd, yy] = [NaN, NaN, NaN];
        if (fmt === 'MM/DD/YYYY') [mm, dd, yy] = parts;
        if (fmt === 'DD/MM/YYYY') [dd, mm, yy] = parts;
        if (fmt === 'YYYY/MM/DD') [yy, mm, dd] = parts;
        if ([mm, dd, yy].some(n => isNaN(n))) return null;
        return new Date(yy, mm - 1, dd);
    }

    static #toTime(el) {
        // HTML5 <input type="time">
        if (el.type === 'time') {
            const [h, m] = el.value.split(':').map(n => parseInt(n, 10));
            if (isNaN(h) || isNaN(m)) return null;
            return h * 60 + m;
        }
        // SharePoint <select>
        const $el = el.closest('td, .ms-dtinput');
        const hrs = parseInt(el.value, 10);
        const minsSelect = $el.querySelector('select[id*="Minutes"]');
        const mins = minsSelect ? parseInt(minsSelect.value, 10) : null;
        if (isNaN(hrs) || isNaN(mins)) return null;
        return hrs * 60 + mins;
    }

    static #toDateTime(de, te) {
        const dateObj = this.#toDate(de);
        const mins = this.#toTime(te);
        if (!dateObj || mins === null) return null;
        dateObj.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return dateObj;
    }
}


/**
 * Masker: scans the DOM for [masker], wires up masks & blur-listeners,
 * and defers to Validator for inline errors.
 */
class Masker {
    // Now following the 'Orchestrator' design pattern IOT facilitate a single event listener for blur and input
    static init() {
        document.querySelectorAll('[masker], [required]').forEach(el => {
            const m = el.getAttribute('masker');

            // Attach the single, orchestrated blur listener to every field.
            el.addEventListener('blur', e => this.#handleValidation(e.target));

            // Attach specific real-time masking functions only where needed.
            if (m) {
                if (m.startsWith('char-count')) this.#setupCharCounter(el);
                else if (m.startsWith('number')) this.#setupNumberMask(el);
                else if (m.startsWith('phone')) this.#setupPhoneMask(el);
                else if (m.startsWith('email')) this.#setupEmailMask(el);
                else if (m.startsWith('time')) this.#setupTimeField(el);

                else if (m.startsWith('date')) {
                    this.#setupDateMask(el);
                    el.addEventListener('change', e => this.#handleValidation(e.target));
                }
            }
        });
    }

    static #handleValidation(el) {
        setTimeout(() => {
            // STEP 1: Clear all previous errors from the field and its partners to start fresh.
            this.#clearAllErrorsForPair(el);

            // STEP 2: Call the master Validator to get ONE definitive result.
            const errorMessage = MaskerValidator.validate(el);

            // STEP 3: If, and only if, there is an error, display it in the correct location.
            if (errorMessage) {
                const errorAnchor = this.#findErrorAnchor(el);
                MaskerValidator.displayError(errorAnchor, errorMessage);
            }
        }, 300);
    }

    // HELPER to find the best place to show a range error message.
    static #findErrorAnchor(el) {
        if (el.dataset.pair) {
            const pairName = el.dataset.pair;
            // For a range error, always show it by the 'end' element's time control for consistency.
            const endEl = document.querySelector(`[masker*="end"][data-pair="${pairName}"]`);
            if (endEl) {
                const timePartner = endEl.getAttribute('masker')?.includes('time') ? endEl : document.querySelector(`[masker*="time end"][data-pair="${pairName}"]`);
                if (timePartner) {
                    return MaskerValidator.findNextSelectWithPartialId(timePartner, 'Minutes') || timePartner;
                }
                return endEl;
            }
        }
        return el; // Default to the element that was blurred.
    }

    // HELPER to clear errors from a field and all of its partners.
    static #clearAllErrorsForPair(el) {
        MaskerValidator.clearError(el);
        if (el.dataset.pair) {
            const pairName = el.dataset.pair;
            document.querySelectorAll(`[data-pair="${pairName}"]`).forEach(p => {
                MaskerValidator.clearError(p);
                // Also clear from any associated minutes dropdowns
                if (p.getAttribute('masker')?.includes('time')) {
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(p, 'Minutes');
                    if (minutesSelect) MaskerValidator.clearError(minutesSelect);
                }
            });
        }
    }

    /** * Attach required-field handlers (blur + input) if * either 'required' attribute or 'required' token in masker. */
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
            // This is correct: calls the static method on Validator
            MaskerValidator.clearError(e.target);
        };

        // Your UI listeners are correct.
        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = ph;
                setTimeout(() => e.target.setSelectionRange(0, 0), 0);
            }
        });
        el.addEventListener('input', onInput);
        el.addEventListener('keydown', e => {
            if (e.target.value === ph && e.key === 'Backspace') e.target.value = '';
        });

        // This blur listener correctly uses the Validator's static methods.
        el.addEventListener('blur', e => {
            if (e.target.value === ph && !visible) {
                e.target.value = '';
            }

            const errorMessage = MaskerValidator.validate(e.target);

            let errorAnchor = e.target;
            if (e.target.dataset.pair) {
                const timePartnerSel = `[masker*="time"][data-pair="${e.target.dataset.pair}"]`;
                const timePartner = document.querySelector(timePartnerSel);
                if (timePartner) {
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(timePartner, 'Minutes');
                    if (minutesSelect) errorAnchor = minutesSelect;
                }
            }

            if (errorMessage) {
                // Correct: calls the static method on Validator
                MaskerValidator.displayError(errorAnchor, errorMessage);
            } else {
                // Correct: calls the static method on Validator
                MaskerValidator.clearError(e.target);
                if (errorAnchor !== e.target) MaskerValidator.clearError(errorAnchor);
            }
        });
    }

    static #setupMilDateMask(el) {
        // Your placeholder and UI listeners are correct and unchanged.
        const placeholder = 'YYYY MMM DD';
        if (el.getAttribute('masker').includes('visible')) el.value = placeholder;
        el.addEventListener('input', this.#applyMilDateMask);
        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = placeholder;
                setTimeout(() => e.target.setSelectionRange(0, 0), 0);
            }
        });
        el.addEventListener('keydown', e => {
            if (e.target.value === placeholder && e.key === 'Backspace') {
                e.target.value = '';
            }
        });

        // The blur listener is updated with the same logic as above.
        el.addEventListener('blur', e => {
            if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
                e.target.value = '';
            }

            const errorMessage = MaskerValidator.validate(e.target);
            let errorAnchor = e.target;
            if (e.target.dataset.pair) {
                const timePartnerSel = `[masker*="time"][data-pair="${e.target.dataset.pair}"]`;
                const timePartner = document.querySelector(timePartnerSel);
                if (timePartner) {
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(timePartner, 'Minutes');
                    if (minutesSelect) errorAnchor = minutesSelect;
                }
            }

            if (errorMessage) {
                MaskerValidator.displayError(errorAnchor, errorMessage);
            } else {
                MaskerValidator.clearError(e.target);
                if (errorAnchor !== e.target) MaskerValidator.clearError(errorAnchor);
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
        const fb = document.querySelector(`[data-feedback-for="${el.id}"]`);
        if (!fb) return;
        const visible = el.getAttribute('masker').includes('visible');
        if (!visible) fb.style.display = 'none';
        else this.#updateCharCount(el, fb);

        el.addEventListener('keydown', e => this.#limitInput(e));
        el.addEventListener('keyup', () => this.#updateCharCount(el, fb));
    }

    static #updateCharCount(el, fb) {
        if (fb.style.display === 'none') fb.style.display = 'block';

        // Get the raw text from either a standard input or a content-editable div.
        const rawText = el.textContent || el.value || '';

        // Remove all zero-width space characters.
        const cleanedText = rawText.replace(/\u200B/g, '');

        const currLength = cleanedText.length;
        const maxLength = el.getAttribute('maxlength') || el.maxLength;

        fb.textContent = `${currLength} / ${maxLength}`;
    }

    // NUMBER MASK
    static #setupNumberMask(el) {
        el.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, el.maxLength);
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

        // These listeners for UI and real-time formatting are correct.
        el.addEventListener('focus', e => {
            if (!e.target.value) {
                e.target.value = placeholder;
                setTimeout(() => e.target.setSelectionRange(0, 0), 0);
            }
        });
        el.addEventListener('input', e => this.#applyPatternMask(e, fmt, '0'));
        el.addEventListener('keydown', e => {
            if (e.target.value === placeholder && e.key === 'Backspace') {
                e.target.value = '';
            }
        });

        el.addEventListener('blur', e => {
            // First, handle the placeholder logic as before.
            if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
                e.target.value = '';
            }

            // Next, call the main Validator to run all checks.
            const errorMessage = MaskerValidator.validate(e.target);

            // Finally, make a single decision to show or clear an error.
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

        // Your UI event listeners are correct
        el.addEventListener('focus', setPlaceholder);
        el.addEventListener('keydown', e => {
            if (el.value === placeholder && !['Tab', 'Shift', 'Control', 'Alt'].includes(e.key)) {
                removePlaceholder();
            }
        });
        el.addEventListener('input', e => this.#applyEmailMask(e));

        // --- THIS IS THE CORRECTED BLUR LISTENER ---
        el.addEventListener('blur', () => {
            // First, handle placeholder logic as before.
            if (el.value === placeholder) {
                removePlaceholder();
            }

            // Next, call the main Validator to run ALL checks (required, format, etc.)
            const errorMessage = MaskerValidator.validate(el);

            // Finally, make a single decision to show or clear an error.
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

        // This block for native <input type="time"> remains the same
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

        // --- THIS IS THE CORRECTED LOGIC FOR SHAREPOINT DROPDOWNS ---
        if (isBegin || isEnd) {
            const container = el.closest('td, .ms-dtinput');
            // Attach the listener to both Hours and Minutes dropdowns for better UX
            container.querySelectorAll('select').forEach(select => {
                select.addEventListener('blur', () => {
                    // We always validate based on the main element 'el' (the hours select)
                    const errorMessage = MaskerValidator.validate(el);

                    // Find the minutes dropdown to use as the anchor for the error message
                    const minutesSelect = MaskerValidator.findNextSelectWithPartialId(el, 'Minutes');

                    if (errorMessage) {
                        // Display the error next to the minutes select if it exists,
                        // otherwise fall back to the hours select.
                        MaskerValidator.displayError(minutesSelect || el, errorMessage);
                    } else {
                        // When valid, clear the error from both potential locations
                        MaskerValidator.clearError(el);
                        if (minutesSelect) {
                            MaskerValidator.clearError(minutesSelect);
                        }
                    }
                });
            });
        }
    }

    static #limitInput(e) {
        const t = e.target;
        if (t.maxLength < 0) return;
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
        const currLength = t.textContent.length || t.value.length;
        if (currLength >= t.maxLength && !allowed.includes(e.key)) {
            e.preventDefault();
        }
    }
}

// initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Masker.init());
