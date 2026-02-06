# Masker.js v2.1

**Masker.js** is a lightweight, dependency-free JavaScript UI library that provides robust input masking and form validation. It's driven by two core classes, `Masker` & `MaskerValidator`, which work together to:

* Apply input masks for phone numbers, dates, and numbers.
* Provide real-time character counters for text fields.
* Handle a full suite of validations: required, email, date/time formats, and year ranges.
* Perform complex cross-field comparisons for date and time ranges.
* Offer a centralized validation system for easy form submission checks.
* **New in 2.1:** Precise control over error message placement and decoupling of paired error messages.

The library is designed to be **declarative first**, meaning you control it primarily by adding simple attributes to your HTML.

---

## Core Concepts

* **Declarative Control**: You activate features like `masker="phone required"` directly in your HTML, keeping your script clean.
* **Centralized Validation**: A single master function, `MaskerValidator.validate()`, runs all applicable checks on an element, ensuring consistent and predictable error handling.
* **Validation Priority**: Checks are intelligently ordered (**1. Required**, **2. Format**, **3. Complex**) so users get the most relevant feedback first.
* **Flexible Anchoring**: Validation errors are usually placed after the input, but v2.1 allows you to anchor them to any DOM element (useful for complex layouts like Date + Time groupings).

---

## Feature Reference

### Input Masks

* **Phone Number**: `masker="phone"`
    * Use `data-format="..."` for different regions.
    * Supported formats: `US`, `UK`, `FR`, `DE`, `JP`, `IN`, `CN`, `KR`, `BR`, `AR`, `AU`, `DSN`.
* **Date**: `masker="date"`
    * Use `data-format="MDY|DMY|YMD"` to set the format.
    * **Robust Parsing**: v2.1 includes ISO fallback parsing to better handle system-generated dates.
* **Number Only**: `masker="number"`
    * Restricts input to digits only.

### Validation

* **Required**: Add the `required` keyword to any `masker` attribute or use the standard `required` attribute.
* **Email**: `masker="email"`
* **Date Year Range**: Add a keyword to a `date` mask.
    * `future` / `ancient`
    * `1900` / `2000` (Restricts year ranges)

### Advanced Features

* **Date/Time Ranges**: Link two or more date/time fields with a matching `data-pair` attribute.
    ```html
    <input masker="date begin" data-pair="vacation">
    <input masker="date end" data-pair="vacation">
    ```
* **Error Anchoring (New in v2.1)**:
    By default, errors appear immediately after the input. Use `data-error-anchor` to target a specific element ID where the error should be appended.
    ```html
    <input masker="date required" data-error-anchor="my-container" />
    ```
* **Single-Line / Split Errors (New in v2.1)**:
    By default, `Masker` groups errors for paired fields (clearing both when one is corrected). To allow errors to persist independently on both lines (e.g., "Start Time Required" and "End Time Required" simultaneously), add the `single-line-errors` attribute.
    ```html
    <input masker="date begin" data-pair="x" single-line-errors="true">
    <input masker="date end" data-pair="x" single-line-errors="true">
    ```
* **Character Counter**: `masker="char-count"`
    * Requires `maxlength` and a linked `data-feedback-for` element.

---

## API Reference

### `Masker`

| Method | Description |
| :--- | :--- |
| **`Masker.init()`** | Scans the DOM for `[masker]` elements and applies all masks and validation listeners. Runs automatically on page load but should be called manually after programmatic setup. |

### `MaskerValidator`

| Method | Description |
| :--- | :--- |
| **`triggerAllValidations()`** | Fires validation for every `[masker]` element. **Returns an array of error objects** (`{id, title, message}`). Used for pre-submission checks. |
| **`validate(el)`** | Runs the complete validation sequence for a **single element**. Returns an error string or `null`. |
| **`findErrorAnchor(el)`** | **New in 2.1**: Public helper that returns the DOM element where an error message *would* be placed for a given input, respecting `data-error-anchor` attributes. |

* **Error Anchoring (New in v2.1)**:
    By default, errors appear immediately after the input. Use `data-error-anchor` to target a specific element ID where the error should be appended.
    ```html
    <input masker="date required" data-error-anchor="my-container" />
    <div id="my-container"></div>
    ```
