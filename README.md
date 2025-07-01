# Masker.js

A pair of lightweight, dependency-free JavaScript classes (`Masker` & `Validator`) that provide:

*   Input masks for:
    *   Character count
    *   Numbers
    *   Phone numbers (US, UK, FR, DE, JP, IN, CN, KR, BR, AR, AU, DSN)
    *   Dates (civil & military)
*   Single-field validation (required, date format, email, & range checks)
*   Cross-field “begin & end” date comparisons
*   Includes a text-limiting feature where an input field or text area is limited to a pre-defined number of characters if desired.
*   Faux input mask for emails

## Table of Contents

1.  [Installation](#installation)
2.  [Usage](#usage)
3.  [API Reference](#api-reference)
4.  [Examples](#examples)
5.  [License](#license)

## Installation

Include the script in your HTML:

```
<script src="path/to/Masker.js"></script>
```

## Usage

1.  Add a `masker="…"` attribute to your `<input>` or `<textarea>` elements.
2.  Optionally mark fields `required` and/or supply custom messages via:
    *   `data-errMsg`
    *   `data-errMsg-range-start`
    *   `data-errMsg-range-end`
3.  Initialize on DOM ready:

```
document.addEventListener('DOMContentLoaded', () => {
  Masker.init();
});
```

## API Reference

### Masker

| Method | Description |
| --- | --- |
| `Masker.init()` | Scans the DOM for `[masker]` elements and applies masks & validation listeners. |

### Validator

| Method | Description |
| --- | --- |
| `Validator.validateRequired(el)` | Ensures `el.value` is non-empty (and not equal to its placeholder). |
| `Validator.validateDate(el)` | Checks month (01–12), day (01–31), and year (range flags: `1900`, `2000`, `future`, `ancient`). |
| `Validator.validateDateRange(startEl, endEl)` | Compares two date fields:  <br>• If **start > end** → error on _start_ (message from `data-errMsg-range-start` or default).  <br>• If **end < start** → error on _end_ (message from `data-errMsg-range-end` or default). |

For a JS fiddle with more extensive examples: https://jsfiddle.net/FirePrism/1fyae4o8/22/

## Examples

### 1) Masker (automatic wiring)

```
<!-- Character counter (hidden until typing) -->
<textarea id="notes" masker="char-count" maxlength="200"></textarea>
<div class="feedback" data-feedback-for="notes"></div>

<!-- Phone mask -->
<input type="text" id="us-phone" masker="phone required" data-format="US" />
<span class="error-msg" data-error-for="us-phone"></span>

<!-- Single date validation -->
<input type="text" id="year-1900" title="Birth Date"
       masker="date 1900" data-format="MDY" required />
<span class="error-msg" data-error-for="year-1900"></span>

<!-- Date range validation (pair "proj") -->
<input type="text" id="start-date" title="Start Date"
       masker="date begin required" data-format="MDY" data-pair="proj" />
<span class="error-msg" data-error-for="start-date"></span>

<input type="text" id="end-date" title="End Date"
       masker="date end required" data-format="MDY" data-pair="proj" />
<span class="error-msg" data-error-for="end-date"></span>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    Masker.init();
  });
</script>
```

### 2) Validator (direct calls)

```
// Validate a required field
const bioEl = document.getElementById('bio');
Validator.validateRequired(bioEl);

// Validate a single date field programmatically
const dateEl = document.getElementById('year-1900');
if (!Validator.validateDate(dateEl)) {
  console.warn('Date is invalid:', dateEl.value);
}

// Compare two date inputs
const startEl = document.getElementById('start-date');
const endEl   = document.getElementById('end-date');
if (!Validator.validateDateRange(startEl, endEl)) {
  console.warn('Range invalid:', startEl.value, endEl.value);
}
```

## License

MIT — you may use, modify and distribute this software so long as you retain the original copyright notice and license text.
