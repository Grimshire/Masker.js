/**
 * Validator: handles required checks, single‐date validation, and date‐range validation.
 */
class Validator {
    static #getOrCreateErrorContainer(el) {
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
  
    static #displayError(el, msg) {
      const c = this.#getOrCreateErrorContainer(el);
      if (c) {
        c.textContent = msg;
        c.style.display = 'inline';
      }
    }
  
    static clearError(el) {
      const c = this.#getOrCreateErrorContainer(el);
      if (c) {
        c.textContent = '';
        c.style.display = 'none';
      }
    }
  
    static validateRequired(el) {
      if (!el.value || el.value === el.placeholder) {
        const msg = el.getAttribute('data-errMsg') || 'This field is required.';
        this.#displayError(el, msg);
        return false;
      }
      this.clearError(el);
      return true;
    }
  
    static validateDate(el) {
      this.clearError(el);
      const v       = el.value;
      if (!v) return true;
      const mask    = el.getAttribute('masker') || '';
      const rawFmt  = el.getAttribute('data-format') || 'MDY';
      if (rawFmt === 'US-MIL') return true;
  
      const aliases = { MDY:'MM/DD/YYYY', DMY:'DD/MM/YYYY', YMD:'YYYY/MM/DD', 'US-CIV':'MM/DD/YYYY' };
      const fmt     = aliases[rawFmt] || rawFmt;
      const nowY    = new Date().getFullYear();
  
      // YEAR
      const yi       = fmt.indexOf('YYYY');
      const yText    = v.substring(yi, yi + 4);
      if (yi >= 0 && yText.length === 4 && !mask.includes('ancient future')) {
        const y = parseInt(yText, 10);
        if (mask.includes('ancient') && y > nowY) {
            this.#displayError(el, 'Year cannot be in the future.');
            return false;
          }
        if (mask.includes('future') && y < nowY) {
          this.#displayError(el, 'Year cannot be in the past.');
          return false;
        }
        if (mask.includes('2000') && (y < 2000 || y > nowY)) {
          this.#displayError(el, `Year must be between 2000 and ${nowY}.`);
          return false;
        }
        if (mask.includes('1900') && (y < 1900 || y > nowY)) {
          this.#displayError(el, `Year must be between 1900 and ${nowY}.`);
          return false;
        }
        if (!mask.includes('ancient') && !mask.includes('1900') && !mask.includes('2000') && y < nowY) {
          this.#displayError(el, `Year cannot be before ${nowY}.`);
          return false;
        }
      }
  
      // MONTH
      const mi = fmt.indexOf('MM');
      if (mi >= 0) {
        const mText = v.substring(mi, mi + 2);
        if (mText.length === 2) {
          const m = parseInt(mText, 10);
          if (m < 1 || m > 12) {
            this.#displayError(el, 'Month must be 01-12.');
            return false;
          }
        }
      }
  
      // DAY
      const di = fmt.indexOf('DD');
      if (di >= 0) {
        const dText = v.substring(di, di + 2);
        if (dText.length === 2) {
          const d = parseInt(dText, 10);
          if (d < 1 || d > 31) {
            this.#displayError(el, 'Day must be 01-31.');
            return false;
          }
        }
      }
  
      return true;
    }
  
    static validateDateRange(startEl, endEl) {
      if (!startEl.value || !endEl.value) return true;
      this.clearError(startEl);
      this.clearError(endEl);
  
      const d1 = this.#toDate(startEl);
      const d2 = this.#toDate(endEl);
      if (!d1 || !d2) return false;
  
      const t1   = startEl.getAttribute('title') || 'Start date';
      const t2   = endEl.getAttribute('title')   || 'End date';
      const msg1 = startEl.dataset.errMsgRangeStart
                 || `${t1} cannot be set after ${t2}`;
      const msg2 = endEl.dataset.errMsgRangeEnd
                 || `${t2} cannot be set before ${t1}`;
  
      if (d1 > d2) {
        this.#displayError(startEl, msg1);
        return false;
      }
      if (d2 < d1) {
        this.#displayError(endEl, msg2);
        return false;
      }
      return true;
    }
  
    static #toDate(el) {
      const rawFmt = el.getAttribute('data-format') || 'MDY';
      const aliases= { MDY:'MM/DD/YYYY', DMY:'DD/MM/YYYY', YMD:'YYYY/MM/DD', 'US-CIV':'MM/DD/YYYY' };
      const fmt    = aliases[rawFmt] || rawFmt;
      const parts  = el.value.split(/[^0-9]/).map(s => parseInt(s, 10));
      let [mm, dd, yyyy] = [NaN, NaN, NaN];
  
      if (fmt === 'MM/DD/YYYY') [mm, dd, yyyy] = parts;
      if (fmt === 'DD/MM/YYYY') [dd, mm, yyyy] = parts;
      if (fmt === 'YYYY/MM/DD') [yyyy, mm, dd] = parts;
  
      if ([mm, dd, yyyy].some(n => isNaN(n))) return null;
      return new Date(yyyy, mm - 1, dd);
    }
  }
  
  
  /**
   * Masker: applies character counters, number masks, phone masks, date masks, and hooks validation.
   */
  class Masker {
    static init() {
      document.querySelectorAll('[masker]').forEach(el => {
        const m = el.getAttribute('masker');
        if (m.startsWith('char-count')) this.#setupCharCounter(el);
        else if (m.startsWith('date')) this.#setupDateMask(el);
        else if (m.startsWith('number')) this.#setupNumberMask(el);
        else if (m.startsWith('phone')) this.#setupPhoneMask(el);
      });
    }
  
    static #addRequiredValidation(el) {
      const m = el.getAttribute('masker') || '';
      if (el.hasAttribute('required') || m.includes('required')) {
        el.addEventListener('blur',  e => Validator.validateRequired(e.target));
        el.addEventListener('input', e => Validator.clearError(e.target));
      }
    }
  
    static #setupDateMask(el) {
      this.#addRequiredValidation(el);
      const maskAttr = el.getAttribute('masker') || '';
      const rawFmt   = el.getAttribute('data-format') || 'MDY';
  
      if (rawFmt === 'US-MIL') {
        return this.#setupMilDateMask(el);
      }
  
      const aliases = { MDY:'MM/DD/YYYY', DMY:'DD/MM/YYYY', YMD:'YYYY/MM/DD', 'US-CIV':'MM/DD/YYYY' };
      const fmt     = aliases[rawFmt] || rawFmt;
      const placeholder = fmt.replace(/[MDY]/g, '_');
      const visible     = maskAttr.includes('visible');
  
      if (visible) el.value = placeholder;
  
      const onInput = e => {
        this.#applyDateMask(e, fmt);
        Validator.validateDate(e.target);
      };
  
      el.addEventListener('focus', e => {
        if (!e.target.value) {
          e.target.value = placeholder;
          setTimeout(() => e.target.setSelectionRange(0, 0), 0);
        }
      });
      el.addEventListener('input', onInput);
      el.addEventListener('blur', e => {
        if (e.target.value === placeholder && !visible) e.target.value = '';
        else Validator.validateDate(e.target);
      });
      el.addEventListener('keydown', e => {
        if (e.target.value === placeholder && e.key === 'Backspace') {
          e.target.value = '';
        }
      });
  
      // range‐check partner on blur
      const isBegin = maskAttr.includes('date begin');
      const isEnd   = maskAttr.includes('date end');
      if (isBegin || isEnd) {
        el.addEventListener('blur', () => {
          const sel = isBegin
                      ? `input[masker*="date end"][data-pair="${el.dataset.pair}"]`
                      : `input[masker*="date begin"][data-pair="${el.dataset.pair}"]`;
          const partner = document.querySelector(sel);
          if (!partner) return;
          const [startEl, endEl] = isBegin ? [el, partner] : [partner, el];
          Validator.validateDateRange(startEl, endEl);
        });
      }
    }
  
    static #setupCharCounter(el) {
      this.#addRequiredValidation(el);
      const fb = document.querySelector(`[data-feedback-for="${el.id}"]`);
      if (!fb) return;
      const visible = el.getAttribute('masker').includes('visible');
      if (!visible) fb.style.display = 'none';
      else this.#updateCharCount(el, fb);
  
      el.addEventListener('keyup',   () => this.#updateCharCount(el, fb));
      el.addEventListener('keydown', e => this.#limitInput(e));
    }
  
    static #updateCharCount(el, fb) {
      if (fb.style.display === 'none') fb.style.display = 'block';
      fb.textContent = `${el.value.length} / ${el.maxLength}`;
    }
  
    static #setupNumberMask(el) {
      this.#addRequiredValidation(el);
      el.addEventListener('input', this.#applyNumberMask);
    }
  
    static #setupPhoneMask(el) {
      this.#addRequiredValidation(el);
      const formats = {
        US:'(000) 000-0000', DSN:'000-000-0000', UK:'00000 000000',
        FR:'00 00 00 00 00', DE:'0000 0000000', JP:'000-0000-0000',
        IN:'00000 00000', CN:'000 0000 0000', KR:'00-0000-0000',
        BR:'(00) 00000-0000', AR:'(000) 0000-0000', AU:'0000 000 000'
      };
      const fmt = formats[el.getAttribute('data-format') || 'US'] || el.getAttribute('data-format');
      const placeholder = fmt.replace(/0/g, '_');
      if (el.getAttribute('masker').includes('visible')) {
        el.value = placeholder;
      }
  
      el.addEventListener('focus', e => {
        if (!e.target.value) {
          e.target.value = placeholder;
          setTimeout(() => e.target.setSelectionRange(0, 0), 0);
        }
      });
      el.addEventListener('input', e => this.#applyPatternMask(e, fmt, '0'));
      el.addEventListener('blur', e => {
        if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
          e.target.value = '';
        }
      });
      el.addEventListener('keydown', e => {
        if (e.target.value === placeholder && e.key === 'Backspace') {
          e.target.value = '';
        }
      });
    }
  
    static #setupMilDateMask(el) {
      this.#addRequiredValidation(el);
      const placeholder = 'YYYY MMM DD';
      if (el.getAttribute('masker').includes('visible')) {
        el.value = placeholder;
      }
      el.addEventListener('input', this.#applyMilDateMask);
      el.addEventListener('focus', e => {
        if (!e.target.value) {
          e.target.value = placeholder;
          setTimeout(() => e.target.setSelectionRange(0, 0), 0);
        }
      });
      el.addEventListener('blur', e => {
        if (e.target.value === placeholder && !el.getAttribute('masker').includes('visible')) {
          e.target.value = '';
        }
      });
      el.addEventListener('keydown', e => {
        if (e.target.value === placeholder && e.key === 'Backspace') {
          e.target.value = '';
        }
      });
    }
  
    // core mask appliers
    static #applyPatternMask(e, fmt, ph) {
      const input = e.target;
      const digits = input.value.replace(/\D/g, '');
      let out = '', di = 0;
      for (let i = 0; i < fmt.length && di < digits.length; i++) {
        out += (fmt[i] === ph ? digits[di++] : fmt[i]);
      }
      input.value = out;
    }
  
    static #applyNumberMask(e) {
      const i = e.target;
      let d = i.value.replace(/\D/g, '');
      if (i.maxLength > 0) d = d.slice(0, i.maxLength);
      i.value = d;
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
      const c = i.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      let out = '', ci = 0;
      for (let j = 0; j < fmt.length && ci < c.length; j++) {
        out += /[MDY]/.test(fmt[j]) ? c[ci++] : fmt[j];
      }
      i.value = out;
    }
  
    static #limitInput(e) {
      const t = e.target;
      if (t.maxLength < 0) return;
      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
      if (t.value.length >= t.maxLength && !allowed.includes(e.key)) {
        e.preventDefault();
      }
    }
  }
  
  // initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => Masker.init());
