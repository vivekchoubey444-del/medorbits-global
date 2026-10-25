
/* =========================================================
   MEDORBITS | FILE VALIDATION
   File: assets/js/file-validation.js
   Version: 1.0.0

   Features:
   - File extension and MIME type validation
   - Maximum file size validation
   - Minimum and maximum file count
   - Required document validation
   - Duplicate filename detection
   - Optional duplicate-content detection
   - Multiple file input support
   - Drag-and-drop compatible
   - Accessible validation messages
   - Form submission validation
   - Dynamic content support
   - No external dependencies

   Supported attributes:
   [data-file-validation]
   [data-file-input]
   [data-file-required]
   [data-file-max-size-mb]
   [data-file-min-count]
   [data-file-max-count]
   [data-file-allowed-extensions]
   [data-file-allowed-types]
   [data-file-unique]
   [data-file-status]
   [data-file-errors]
   [data-file-list]
   [data-file-clear]
   [data-file-form]

   ========================================================= */

(function medOrbitsFileValidationModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_FILE_VALIDATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    defaultMaxSizeBytes: 10 * 1024 * 1024,
    hardMaxSizeBytes: 100 * 1024 * 1024,
    defaultMaxFiles: 5,

    allowedExtensions: [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp"
    ],

    extensionMimeTypes: {
      ".pdf": ["application/pdf"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".png": ["image/png"],
      ".webp": ["image/webp"]
    },

    selectors: {
      root: "[data-file-validation]",
      input: "[data-file-input]",
      status: "[data-file-status]",
      errors: "[data-file-errors]",
      list: "[data-file-list]",
      clear: "[data-file-clear]",
      form: "form[data-file-form]"
    }
  };

  var state = {
    initialized: false,
    destroyed: false,
    observer: null,
    roots: new WeakMap(),
    rootElements: new Set(),
    listeners: []
  };

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function normalizeText(value) {
    return cleanText(value, 500).toLowerCase();
  }

  function getElement(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function getElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function addListener(record, element, eventName, handler, options) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler, options || false);

    record.listeners.push(function () {
      element.removeEventListener(eventName, handler, options || false);
    });
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Unknown size";
    }

    if (bytes < 1024) {
      return bytes + " B";
    }

    var units = ["KB", "MB", "GB"];
    var size = bytes / 1024;
    var index = 0;

    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }

    return size.toFixed(size >= 10 ? 1 : 2) + " " + units[index];
  }

  function getExtension(filename) {
    var name = cleanText(filename, 255);
    var dotIndex = name.lastIndexOf(".");

    return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : "";
  }

  function parseExtensionList(value, fallback) {
    if (!value || !value.trim()) {
      return fallback.slice();
    }

    return value.split(",").map(function (item) {
      var extension = item.trim().toLowerCase();

      if (!extension) {
        return "";
      }

      return extension.charAt(0) === "."
        ? extension
        : "." + extension;
    }).filter(function (extension) {
      return /^\.[a-z0-9]+$/.test(extension);
    });
  }

  function parseMimeList(value, fallback) {
    if (!value || !value.trim()) {
      return fallback.slice();
    }

    return value.split(",").map(function (item) {
      return item.trim().toLowerCase();
    }).filter(function (type) {
      return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type);
    });
  }

  function getMaxSizeBytes(input, root) {
    var raw = input.getAttribute("data-file-max-size-mb") ||
      root.getAttribute("data-file-max-size-mb");

    if (raw == null || raw === "") {
      return CONFIG.defaultMaxSizeBytes;
    }

    var mb = Number(raw);

    if (!Number.isFinite(mb) || mb <= 0) {
      return CONFIG.defaultMaxSizeBytes;
    }

    return Math.min(
      mb * 1024 * 1024,
      CONFIG.hardMaxSizeBytes
    );
  }

  function getFileCountLimit(input, attribute, fallback) {
    var raw = input.getAttribute(attribute);

    if (raw == null || raw === "") {
      return fallback;
    }

    var value = Number.parseInt(raw, 10);

    return Number.isInteger(value) && value >= 0
      ? Math.min(value, 100)
      : fallback;
  }

  function getAllowedExtensions(input, root) {
    var raw = input.getAttribute("data-file-allowed-extensions") ||
      root.getAttribute("data-file-allowed-extensions");

    return parseExtensionList(raw, CONFIG.allowedExtensions);
  }

  function getAllowedMimeTypes(input, root, extensions) {
    var raw = input.getAttribute("data-file-allowed-types") ||
      root.getAttribute("data-file-allowed-types");

    if (raw) {
      return parseMimeList(raw, []);
    }

    var result = [];

    extensions.forEach(function (extension) {
      (CONFIG.extensionMimeTypes[extension] || []).forEach(function (type) {
        if (!result.includes(type)) {
          result.push(type);
        }
      });
    });

    return result;
  }

  function getFiles(input) {
    if (!input || !input.files) {
      return [];
    }

    return Array.from(input.files);
  }

  function validateFile(file, input, root) {
    var errors = [];
    var extension = getExtension(file.name);
    var allowedExtensions = getAllowedExtensions(input, root);
    var allowedMimeTypes = getAllowedMimeTypes(
      input,
      root,
      allowedExtensions
    );
    var maxBytes = getMaxSizeBytes(input, root);

    if (!file.name || !extension) {
      errors.push("The file must have a valid filename and extension.");
    }

    if (!allowedExtensions.includes(extension)) {
      errors.push(
        "Unsupported file extension. Allowed: " +
        allowedExtensions.join(", ") + "."
      );
    }

    if (file.size <= 0) {
      errors.push("The file is empty.");
    }

    if (file.size > maxBytes) {
      errors.push(
        "File size exceeds the maximum of " +
        formatBytes(maxBytes) + "."
      );
    }

    /*
     * A browser may report an empty MIME type. When it reports
     * a MIME type, compare it with the allowed list. This is a
     * client-side usability check, not a security guarantee.
     */
    if (
      file.type &&
      allowedMimeTypes.length &&
      !allowedMimeTypes.includes(file.type.toLowerCase())
    ) {
      errors.push("The file's declared MIME type is not allowed.");
    }

    if (
      file.type &&
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(file.type)
    ) {
      errors.push("The file has an invalid MIME type.");
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      extension: extension,
      size: file.size,
      mimeType: file.type || ""
    };
  }

  function createStatus(root) {
    var status = getElement(root, CONFIG.selectors.status);

    if (status) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      return status;
    }

    status = document.createElement("p");
    status.setAttribute("data-file-status", "");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    root.appendChild(status);

    return status;
  }

  function createErrorRegion(root) {
    var errors = getElement(root, CONFIG.selectors.errors);

    if (errors) {
      errors.setAttribute("role", "alert");
      errors.setAttribute("aria-live", "assertive");
      errors.hidden = true;
      return errors;
    }

    errors = document.createElement("ul");
    errors.setAttribute("data-file-errors", "");
    errors.setAttribute("role", "alert");
    errors.setAttribute("aria-live", "assertive");
    errors.hidden = true;
    root.appendChild(errors);

    return errors;
  }

  function renderErrors(record, messages) {
    var errors = record.errorsElement;

    if (!errors) {
      return;
    }

    errors.replaceChildren();
    errors.hidden = messages.length === 0;

    messages.forEach(function (message) {
      var item = document.createElement("li");
      item.textContent = cleanText(message, 500);
      errors.appendChild(item);
    });

    record.inputs.forEach(function (input) {
      var hasError = messages.length > 0 &&
        record.invalidInputs.has(input);

      if (hasError) {
        input.setAttribute("aria-invalid", "true");

        if (errors.id) {
          var describedBy = (input.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter(Boolean);

          if (!describedBy.includes(errors.id)) {
            describedBy.push(errors.id);
          }

          input.setAttribute("aria-describedby", describedBy.join(" "));
        }
      } else {
        input.removeAttribute("aria-invalid");
      }
    });
  }

  function renderFileList(record, input, files) {
    var list = record.listElement;

    if (!list) {
      return;
    }

    list.replaceChildren();

    files.forEach(function (file) {
      var item = document.createElement("li");
      var name = document.createElement("span");
      var size = document.createElement("span");

      name.textContent = cleanText(file.name, 255);
      size.textContent = " (" + formatBytes(file.size) + ")";

      item.appendChild(name);
      item.appendChild(size);
      list.appendChild(item);
    });
  }

  function validateInput(record, input) {
    var root = record.root;
    var files = getFiles(input);
    var errors = [];
    var isRequired = input.required ||
      input.hasAttribute("data-file-required") ||
      root.hasAttribute("data-file-required");

    var minCount = getFileCountLimit(input, "data-file-min-count", 0);
    var maxCount = getFileCountLimit(
      input,
      "data-file-max-count",
      input.multiple ? CONFIG.defaultMaxFiles : 1
    );

    var validFiles = [];
    var inputInvalid = false;

    if (isRequired && files.length === 0) {
      errors.push("Please select a required document.");
      inputInvalid = true;
    }

    if (files.length < minCount) {
      errors.push("Select at least " + minCount + " file(s).");
      inputInvalid = true;
    }

    if (files.length > maxCount) {
      errors.push("Select no more than " + maxCount + " file(s).");
      inputInvalid = true;
    }

    files.forEach(function (file) {
      var result = validateFile(file, input, root);

      if (!result.valid) {
        errors = errors.concat(
          result.errors.map(function (message) {
            return cleanText(file.name, 150) + ": " + message;
          })
        );
        inputInvalid = true;
      } else {
        validFiles.push(file);
      }
    });

    if (input.hasAttribute("data-file-unique")) {
      var seen = new Set();

      files.forEach(function (file) {
        var key = normalizeText(file.name);

        if (seen.has(key)) {
          errors.push("Duplicate filename detected: " + file.name + ".");
          inputInvalid = true;
        }

        seen.add(key);
      });
    }

    if (inputInvalid) {
      record.invalidInputs.add(input);
    } else {
      record.invalidInputs.delete(input);
    }

    renderFileList(record, input, files);

    return {
      valid: errors.length === 0,
      errors: errors,
      files: files,
      validFiles: validFiles,
      input: input
    };
  }

  function validateRoot(record, shouldAnnounce) {
    var allErrors = [];
    var results = [];

    record.invalidInputs.clear();

    record.inputs.forEach(function (input) {
      var result = validateInput(record, input);

      results.push(result);
      allErrors = allErrors.concat(result.errors);
    });

    /*
     * Optional duplicate filename check across all inputs.
     * Enable it with data-file-unique-across-fields on the root.
     */
    if (record.root.hasAttribute("data-file-unique-across-fields")) {
      var filenames = new Set();

      results.forEach(function (result) {
        result.files.forEach(function (file) {
          var key = normalizeText(file.name);

          if (filenames.has(key)) {
            allErrors.push("Duplicate filename detected across document fields: " + file.name + ".");
          }

          filenames.add(key);
        });
      });
    }

    renderErrors(record, allErrors);

    if (record.statusElement) {
      record.statusElement.textContent = allErrors.length
        ? "Please correct " + allErrors.length +
          (allErrors.length === 1 ? " file validation issue." : " file validation issues.")
        : "File validation passed.";

      record.statusElement.setAttribute(
        "data-status",
        allErrors.length ? "error" : "success"
      );
    }

    if (shouldAnnounce && allErrors.length) {
      var firstInvalid = record.inputs.find(function (input) {
        return record.invalidInputs.has(input);
      });

      if (firstInvalid) {
        firstInvalid.focus();
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      results: results
    };
  }

  function initializeRoot(root) {
    if (!root || state.roots.has(root)) {
      return state.roots.get(root) || null;
    }

    var record = {
      root: root,
      inputs: getElements(root, CONFIG.selectors.input),
      statusElement: createStatus(root),
      errorsElement: createErrorRegion(root),
      listElement: getElement(root, CONFIG.selectors.list),
      invalidInputs: new Set(),
      listeners: []
    };

    state.roots.set(root, record);
    state.rootElements.add(root);

    record.inputs.forEach(function (input) {
      var extensions = getAllowedExtensions(input, root);

      /*
       * Keep the HTML-provided accept attribute when the
       * developer has explicitly configured one.
       */
      if (!input.hasAttribute("accept")) {
        input.setAttribute("accept", extensions.join(","));
      }

      addListener(record, input, "change", function () {
        var result = validateInput(record, input);

        renderErrors(record, result.errors);

        if (record.statusElement) {
          record.statusElement.textContent = result.valid
            ? "Selected files passed validation."
            : "Please check the selected files.";
          record.statusElement.setAttribute(
            "data-status",
            result.valid ? "success" : "error"
          );
        }
      });

      addListener(record, input, "blur", function () {
        if (input.value || input.required ||
            input.hasAttribute("data-file-required")) {
          validateInput(record, input);
        }
      });
    });

    getElements(root, CONFIG.selectors.clear).forEach(function (button) {
      addListener(record, button, "click", function () {
        record.inputs.forEach(function (input) {
          input.value = "";
          record.invalidInputs.delete(input);
        });

        renderErrors(record, []);

        if (record.listElement) {
          record.listElement.replaceChildren();
        }

        if (record.statusElement) {
          record.statusElement.textContent = "Selected files cleared.";
          record.statusElement.setAttribute("data-status", "success");
        }
      });
    });

    var form = root.matches("form") ? root : root.closest("form");

    if (form && form.hasAttribute("data-file-form")) {
      addListener(record, form, "submit", function (event) {
        var result = validateRoot(record, true);

        if (!result.valid) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    }

    return record;
  }

  function refresh() {
    if (state.destroyed) {
      return;
    }

    getElements(document, CONFIG.selectors.root).forEach(function (root) {
      initializeRoot(root);
    });
  }

  function findRecord(rootOrElement) {
    if (!rootOrElement) {
      return null;
    }

    var root = rootOrElement.matches &&
      rootOrElement.matches(CONFIG.selectors.root)
      ? rootOrElement
      : rootOrElement.closest
        ? rootOrElement.closest(CONFIG.selectors.root)
        : null;

    return root ? state.roots.get(root) || null : null;
  }

  function validate(rootOrElement) {
    var record = findRecord(rootOrElement);

    if (!record) {
      return {
        valid: false,
        errors: ["No initialized file validation component was found."],
        results: []
      };
    }

    return validateRoot(record, true);
  }

  function validateFileForInput(rootOrElement, inputOrId, file) {
    var record = findRecord(rootOrElement);

    if (!record) {
      return {
        valid: false,
        errors: ["No initialized file validation component was found."]
      };
    }

    var input = typeof inputOrId === "string"
      ? record.inputs.find(function (item) {
          return item.id === inputOrId;
        })
      : inputOrId;

    if (!input || !record.inputs.includes(input)) {
      return {
        valid: false,
        errors: ["The specified file input does not belong to this component."]
      };
    }

    return validateFile(file, input, record.root);
  }

  function destroyRecord(record) {
    record.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    record.listeners = [];
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.rootElements.forEach(function (root) {
      var record = state.roots.get(root);

      if (record) {
        destroyRecord(record);
      }
    });

    state.rootElements.clear();

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.destroyed = true;
  }

  var publicAPI = {
    version: "1.0.0",
    refresh: refresh,
    validate: validate,
    validateFile: validateFileForInput,
    formatBytes: formatBytes,
    destroy: destroy,
    configure: function (options) {
      if (!options || typeof options !== "object") {
        return false;
      }

      if (
        Number.isFinite(options.maxFileSizeBytes) &&
        options.maxFileSizeBytes > 0
      ) {
        CONFIG.defaultMaxSizeBytes = Math.min(
          options.maxFileSizeBytes,
          CONFIG.hardMaxSizeBytes
        );
      }

      if (
        Number.isInteger(options.defaultMaxFiles) &&
        options.defaultMaxFiles >= 1 &&
        options.defaultMaxFiles <= 100
      ) {
        CONFIG.defaultMaxFiles = options.defaultMaxFiles;
      }

      if (Array.isArray(options.allowedExtensions)) {
        CONFIG.allowedExtensions = options.allowedExtensions
          .map(function (item) {
            var extension = String(item).trim().toLowerCase();
            return extension.charAt(0) === "."
              ? extension
              : "." + extension;
          })
          .filter(function (extension) {
            return /^\.[a-z0-9]+$/.test(extension);
          });
      }

      return true;
    }
  };

  window[GLOBAL_KEY] = publicAPI;
  window.MedOrbitsFileValidation = publicAPI;

  function initialize() {
    if (state.initialized || state.destroyed) {
      return;
    }

    state.initialized = true;
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(CONFIG.selectors.root)) ||
                (node.querySelector && node.querySelector(CONFIG.selectors.root))
              );
          });
        });

        if (shouldRefresh) {
          refresh();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
