# Masker.js v2.0

**Masker.js** is a lightweight, dependency-free JavaScript UI library that provides robust input masking and form validation. It's driven by two core classes, `Masker` & `MaskerValidator`, which work together to:

  * Apply input masks for phone numbers, dates, and numbers.
  * Provide real-time character counters for text fields.
  * Handle a full suite of validations: required, email, date/time formats, and year ranges.
  * Perform complex cross-field comparisons for date and time ranges.
  * Offer a centralized validation system for easy form submission checks.

The library is designed to be **declarative first**, meaning you control it primarily by adding simple attributes to your HTML.

-----


## Core Concepts

  * **Declarative Control**: You activate features like `masker="phone required"` directly in your HTML, keeping your script clean.
  * **Centralized Validation**: A single master function, `MaskerValidator.validate()`, runs all applicable checks on an element, ensuring consistent and predictable error handling.
  * **Validation Priority**: Checks are intelligently ordered (**1. Required**, **2. Format**, **3. Complex**) so users get the most relevant feedback first. For example, you won't see a "Date is in the past" error on an empty field; you'll see "This field is required."

-----


## Setup & Initialization

The library is flexible and can be set up in two ways, making it suitable for any environment from static HTML pages to complex SharePoint forms.

### Method 1: Declarative Setup (in HTML)

This is the most common method. Simply add the `masker` attribute to your elements. The library initializes automatically when the page loads.

```html
<input type="text" masker="phone required" data-format="US" />

<label>Start Date:</label>
<input type="text" masker="date begin required" data-pair="project-dates" />

<label>End Date:</label>
<input type="text" masker="date end required" data-pair="project-dates" />
```

### Method 2: Programmatic Setup (with JavaScript)

This method is essential for dynamic applications like **SharePoint** where you can't edit the HTML directly. Use JavaScript to add the attributes to the elements first, then **manually call `Masker.init()`**.

```javascript
//This example uses jQuery, but Masker.js doesn't require jQuery to run as it's written in vanilla JS.

// 1. Select the elements 
const phoneInput = $("input[title='Work Phone']");
const startDateInput = $("input[title='Start Date Required Field']");

// 2. Add the masker attributes programmatically
phoneInput.attr({
  'masker': 'phone required',
  'data-format': 'US'
});
startDateInput.attr({
  'masker': 'date begin required',
  'data-pair': 'project-dates'
});

// 3. Manually initialize the library to find the new attributes
Masker.init();
```

-----

\<hr\>

## Feature Reference

### Input Masks

  * **Phone Number**: `masker="phone"`
      * Use `data-format="..."` for different regions.
      * Supported formats: `US`, `UK`, `FR`, `DE`, `JP`, `IN`, `CN`, `KR`, `BR`, `AR`, `AU`, `DSN`.
  * **Date**: `masker="date"`
      * Use `data-format="MDY|DMY|YMD"` to set the format.
  * **Number Only**: `masker="number"`
      * Restricts input to digits only.

### Validation

  * **Required**: Add the `required` keyword to any `masker` attribute or use the standard `required` attribute.
      * `masker="phone required"`
  * **Email**: `masker="email"`
  * **Date Year Range**: Add a keyword to a `date` mask.
      * `future`: Year cannot be in the past.
      * `ancient`: Year can be in the past.
      * `1900`: Year must be between 1900 and the current year.
      * `2000`: Year must be between 2000 and the current year.

### Advanced Features

  * **Date/Time Ranges**: Link two or more date/time fields with a matching `data-pair` attribute. Use the `begin` and `end` keywords. The library ensures the start is before the end.
    ```html
    <input masker="date begin" data-pair="vacation">
    <input masker="time begin" data-pair="vacation">
    <input masker="date end" data-pair="vacation">
    <input masker="time end" data-pair="vacation">
    ```
  * **Character Counter**: `masker="char-count"`
      * Must be used on an element with a `maxlength` attribute.
      * Requires a feedback element linked with `data-feedback-for="your-input-id"`.
    <!-- end list -->
    ```html
    <textarea id="notes" masker="char-count" maxlength="200"></textarea>
    <div data-feedback-for="notes"></div>
    ```
  * **Custom Error Messages**: Override default error messages using `data-errMsg`.
    ```html
    <input masker="email required" data-errMsg="A valid email is needed to proceed.">
    ```

-----



## API Reference

While the library is designed to be used declaratively, key methods are available for programmatic control, especially for handling form submissions.

### `Masker`

| Method | Description |
| :--- | :--- |
| **`Masker.init()`** | Scans the DOM for `[masker]` elements and applies all masks and validation listeners. Runs automatically on page load but should be called manually after programmatic setup. |

### `MaskerValidator`

| Method | Description |
| :--- | :--- |
| **`triggerAllValidations()`** | Fires the validation for every `[masker]` element on the page. **Returns an array of error objects** (`{id, title, message}`). If the array is empty, the form is valid. This is the primary method for pre-submission checks. |
| **`validate(el)`** | Runs the complete, prioritized validation sequence for a **single element**. Returns an error string or `null` if valid. |
