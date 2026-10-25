
/* =========================================================
   MEDORBITS | DOCUMENT PREVIEW
   File: assets/js/document-preview.js
   Version: 1.0.0

   Features:
   - PDF preview
   - Image preview
   - Local file selection and drag-and-drop
   - File type and file size validation
   - Document name, type and size display
   - Accessible preview dialog
   - Keyboard controls and focus restoration
   - Object URL cleanup
   - Dynamic content support
   - No external dependencies

   Supported elements:
   [data-document-preview]
   [data-document-input]
   [data-document-dropzone]
   [data-document-preview-open]
   [data-document-preview-remove]
   [data-document-name]
   [data-document-size]
   [data-document-type]
   [data-document-status]
   [data-document-preview-modal]
   [data-document-preview-close]
   [data-document-preview-frame]
   [data-document-preview-image]

   ========================================================= */

(function medOrbitsDocumentPreviewModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_DOCUMENT_PREVIEW_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedExtensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
    allowedMimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp"
    ],
    maxPreviewBytes: 25 * 1024 * 1024,
    selectors: {
      widget: "[data-document-preview]",
      input: "[data-document-input]",
      dropzone: "[data-document-dropzone]",
      previewOpen: "[data-document-preview-open]",
      remove: "[data-document-preview-remove]",
      name: "[data-document-name]",
      size: "[data-document-size]",
      type: "[data-document-type]",
      status: "[data-document-status]",
      modal: "[data-document-preview-modal]",
      close: "[data-document-preview-close]",
      frame: "[data-document-preview-frame]",
      image: "[data-document-preview-image]"
    }
  };

  var state = {
    initialized: false,
    destroyed: false,
    observer: null,
    widgets: new WeakMap(),
    widgetElements: new Set(),
    modal: null,
    modalOwner: null,
    modalPreviousFocus: null,
    modalObjectURL: null,
    modalEscapeHandler: null,
    modalKeyHandler: null,
    styleElement: null,
    listeners: []
  };

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function getElement(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function getElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function addListener(target, eventName, handler, options) {
    if (!target) {
      return;
    }

    target.addEventListener(eventName, handler, options || false);

    state.listeners.push(function () {
      target.removeEventListener(eventName, handler, options || false);
    });
  }

  function addWidgetListener(widget, target, eventName, handler, options) {
    if (!target) {
      return;
    }

    target.addEventListener(eventName, handler, options || false);

    widget.listeners.push(function () {
      target.removeEventListener(eventName, handler, options || false);
    });
  }

  function injectStyles() {
    if (document.getElementById("mo-document-preview-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mo-document-preview-styles";

    style.textContent = [
      ".mo-document-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}",
      "[data-document-preview] [hidden]{display:none!important}",
      "[data-document-preview-modal][hidden]{display:none!important}",
      "[data-document-preview-modal]{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(10,15,25,.82)}",
      "[data-document-preview-modal] [data-document-preview-dialog]{position:relative;width:min(100%,1100px);height:min(90vh,850px);overflow:hidden;display:flex;flex-direction:column;background:#f4f1ea;color:#20242b;border-radius:12px}",
      "[data-document-preview-modal] [data-document-preview-toolbar]{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid #d4d0c7}",
      "[data-document-preview-modal] [data-document-preview-content]{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:.5rem}",
      "[data-document-preview-modal] [data-document-preview-frame]{width:100%;height:100%;min-height:60vh;border:0;background:#fff}",
      "[data-document-preview-modal] [data-document-preview-image]{display:block;max-width:100%;max-height:100%;height:auto;object-fit:contain}",
      "[data-document-preview-modal] [data-document-preview-close]{cursor:pointer}",
      "[data-document-dropzone][data-document-dragging='true']{outline:2px dashed currentColor;outline-offset:3px}",
      "[data-document-status][data-status='error']{color:#a3212c}",
      "[data-document-status][data-status='success']{color:#176b45}",
      "@media(prefers-reduced-motion:reduce){[data-document-preview-modal] *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}"
    ].join("\n");

    document.head.appendChild(style);
    state.styleElement = style;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Unknown size";
    }

    if (bytes < 1024) {
      return bytes + " B";
    }

    var units = ["KB", "MB", "GB", "TB"];
    var value = bytes / 1024;
    var unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return value.toFixed(value >= 10 ? 1 : 2) + " " + units[unitIndex];
  }

  function getExtension(filename) {
    var name = cleanText(filename, 255);
    var dotIndex = name.lastIndexOf(".");

    return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
  }

  function getAllowedExtensions(widget) {
    var custom = widget.root.getAttribute("data-allowed-extensions");

    if (!custom) {
      return CONFIG.allowedExtensions.slice();
    }

    return custom.split(",").map(function (extension) {
      var value = extension.trim().toLowerCase();

      if (!value) {
        return "";
      }

      return value.charAt(0) === "." ? value : "." + value;
    }).filter(Boolean);
  }

  function getMaxFileSize(widget) {
    var customMB = Number(widget.root.getAttribute("data-max-size-mb"));

    if (Number.isFinite(customMB) && customMB > 0) {
      return Math.min(customMB * 1024 * 1024, 100 * 1024 * 1024);
    }

    return CONFIG.maxFileSizeBytes;
  }

  function getFileKind(file) {
    if (!file) {
      return "unknown";
    }

    var extension = getExtension(file.name);
    var mime = String(file.type || "").toLowerCase();

    if (extension === ".pdf" || mime === "application/pdf") {
      return "pdf";
    }

    if (
      [".png", ".jpg", ".jpeg", ".webp"].includes(extension) ||
      ["image/png", "image/jpeg", "image/webp"].includes(mime)
    ) {
      return "image";
    }

    return "unknown";
  }

  function validateFile(file, widget) {
    if (!file) {
      return {
        valid: false,
        message: "Please select a document."
      };
    }

    if (file.size <= 0) {
      return {
        valid: false,
        message: "The selected file is empty."
      };
    }

    if (file.size > getMaxFileSize(widget)) {
      return {
        valid: false,
        message: "The file exceeds the maximum size of " +
          formatBytes(getMaxFileSize(widget)) + "."
      };
    }

    var extension = getExtension(file.name);
    var allowedExtensions = getAllowedExtensions(widget);

    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        message: "This file extension is not supported. Allowed: " +
          allowedExtensions.join(", ") + "."
      };
    }

    var kind = getFileKind(file);

    if (kind === "unknown") {
      return {
        valid: false,
        message: "Only supported PDF and image documents can be previewed."
      };
    }

    /*
     * A browser-provided MIME type can be empty or inaccurate.
     * Extension validation improves usability but is not a
     * security guarantee. The server must validate file contents.
     */
    if (file.type && !CONFIG.allowedMimeTypes.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        message: "The file's declared type is not supported."
      };
    }

    return {
      valid: true,
      message: "Document selected successfully.",
      kind: kind
    };
  }

  function setStatus(widget, message, type) {
    if (!widget.status) {
      return;
    }

    widget.status.textContent = cleanText(message, 500);

    if (type) {
      widget.status.setAttribute("data-status", type);
    } else {
      widget.status.removeAttribute("data-status");
    }

    widget.status.setAttribute("role", type === "error" ? "alert" : "status");
  }

  function updateMetadata(widget, file) {
    if (widget.name) {
      widget.name.textContent = file ? cleanText(file.name, 255) : "";
    }

    if (widget.size) {
      widget.size.textContent = file ? formatBytes(file.size) : "";
    }

    if (widget.type) {
      widget.type.textContent = file
        ? (getFileKind(file) === "pdf" ? "PDF document" : "Image document")
        : "";
    }

    if (widget.previewOpen) {
      widget.previewOpen.disabled = !file;
      widget.previewOpen.hidden = !file;
    }

    if (widget.removeButton) {
      widget.removeButton.disabled = !file;
      widget.removeButton.hidden = !file;
    }
  }

  function releaseWidgetURL(widget) {
    if (widget.objectURL) {
      URL.revokeObjectURL(widget.objectURL);
      widget.objectURL = null;
    }
  }

  function setWidgetFile(widget, file) {
    var validation = validateFile(file, widget);

    if (!validation.valid) {
      setStatus(widget, validation.message, "error");
      return false;
    }

    releaseWidgetURL(widget);

    widget.file = file;
    widget.kind = validation.kind;
    widget.objectURL = URL.createObjectURL(file);

    updateMetadata(widget, file);
    setStatus(widget, validation.message, "success");

    if (widget.root.hasAttribute("data-document-auto-preview")) {
      openPreview(widget);
    }

    return true;
  }

  function clearWidget(widget) {
    releaseWidgetURL(widget);

    widget.file = null;
    widget.kind = null;

    if (widget.input) {
      widget.input.value = "";
    }

    updateMetadata(widget, null);
    setStatus(widget, "No document selected.", "");

    if (state.modalOwner === widget) {
      closePreview();
    }
  }

  function ensureModal() {
    if (state.modal && state.modal.isConnected) {
      return state.modal;
    }

    var modal = getElement(document, CONFIG.selectors.modal);

    if (modal) {
      state.modal = modal;
      return modal;
    }

    modal = document.createElement("div");
    modal.setAttribute("data-document-preview-modal", "");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Document preview");
    modal.hidden = true;

    var dialog = document.createElement("div");
    dialog.setAttribute("data-document-preview-dialog", "");
    dialog.setAttribute("role", "document");

    var toolbar = document.createElement("div");
    toolbar.setAttribute("data-document-preview-toolbar", "");

    var title = document.createElement("strong");
    title.setAttribute("data-document-preview-title", "");
    title.textContent = "Document preview";

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("data-document-preview-close", "");
    closeButton.textContent = "Close";
    closeButton.setAttribute("aria-label", "Close document preview");

    toolbar.appendChild(title);
    toolbar.appendChild(closeButton);

    var content = document.createElement("div");
    content.setAttribute("data-document-preview-content", "");

    var frame = document.createElement("iframe");
    frame.setAttribute("data-document-preview-frame", "");
    frame.title = "PDF document preview";
    frame.hidden = true;

    var image = document.createElement("img");
    image.setAttribute("data-document-preview-image", "");
    image.alt = "Selected document preview";
    image.hidden = true;

    var message = document.createElement("p");
    message.setAttribute("data-document-preview-message", "");
    message.textContent = "Preview unavailable.";

    content.appendChild(frame);
    content.appendChild(image);
    content.appendChild(message);

    dialog.appendChild(toolbar);
    dialog.appendChild(content);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    state.modal = modal;
    state.modalTitle = title;
    state.modalFrame = frame;
    state.modalImage = image;
    state.modalMessage = message;

    addListener(closeButton, "click", closePreview);
    addListener(modal, "click", function (event) {
      if (event.target === modal) {
        closePreview();
      }
    });

    return modal;
  }

  function getModalParts(modal) {
    return {
      title: getElement(modal, "[data-document-preview-title]"),
      frame: getElement(modal, CONFIG.selectors.frame),
      image: getElement(modal, CONFIG.selectors.image),
      message: getElement(modal, "[data-document-preview-message]"),
      close: getElement(modal, CONFIG.selectors.close)
    };
  }

  function clearModalContent() {
    if (!state.modal) {
      return;
    }

    var parts = getModalParts(state.modal);

    if (parts.frame) {
      parts.frame.removeAttribute("src");
      parts.frame.hidden = true;
    }

    if (parts.image) {
      parts.image.removeAttribute("src");
      parts.image.hidden = true;
    }

    if (parts.message) {
      parts.message.hidden = true;
    }

    if (state.modalObjectURL) {
      URL.revokeObjectURL(state.modalObjectURL);
      state.modalObjectURL = null;
    }
  }

  function openPreview(widget) {
    if (!widget.file || !widget.objectURL) {
      setStatus(widget, "Select a supported document before previewing.", "error");
      return false;
    }

    if (widget.file.size > CONFIG.maxPreviewBytes) {
      setStatus(widget, "This file is too large to preview in the browser.", "error");
      return false;
    }

    var modal = ensureModal();
    var parts = getModalParts(modal);

    clearModalContent();

    state.modalPreviousFocus = document.activeElement;
    state.modalOwner = widget;
    state.modalObjectURL = URL.createObjectURL(widget.file);

    modal.hidden = false;
    modal.setAttribute("aria-label", "Preview: " + cleanText(widget.file.name, 200));

    if (parts.title) {
      parts.title.textContent = cleanText(widget.file.name, 255);
    }

    if (parts.message) {
      parts.message.hidden = true;
    }

    if (widget.kind === "pdf" && parts.frame) {
      parts.frame.src = state.modalObjectURL;
      parts.frame.hidden = false;
    } else if (widget.kind === "image" && parts.image) {
      parts.image.src = state.modalObjectURL;
      parts.image.alt = cleanText(widget.file.name, 255);
      parts.image.hidden = false;
    } else if (parts.message) {
      parts.message.textContent =
        "This browser cannot preview the selected document.";
      parts.message.hidden = false;
    }

    document.body.style.overflow = "hidden";

    if (parts.close) {
      parts.close.focus();
    }

    state.modalEscapeHandler = function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };

    state.modalKeyHandler = function (event) {
      if (event.key !== "Tab" || modal.hidden) {
        return;
      }

      var focusable = Array.from(
        modal.querySelectorAll(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (element) {
        return !element.hidden;
      });

      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", state.modalEscapeHandler);
    document.addEventListener("keydown", state.modalKeyHandler);

    return true;
  }

  function closePreview() {
    if (!state.modal || state.modal.hidden) {
      return;
    }

    state.modal.hidden = true;
    clearModalContent();

    document.body.style.overflow = "";

    if (state.modalEscapeHandler) {
      document.removeEventListener("keydown", state.modalEscapeHandler);
      state.modalEscapeHandler = null;
    }

    if (state.modalKeyHandler) {
      document.removeEventListener("keydown", state.modalKeyHandler);
      state.modalKeyHandler = null;
    }

    var previousFocus = state.modalPreviousFocus;
    state.modalPreviousFocus = null;
    state.modalOwner = null;

    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function initializeWidget(root) {
    if (!root || state.widgets.has(root)) {
      return state.widgets.get(root) || null;
    }

    var widget = {
      root: root,
      input: getElement(root, CONFIG.selectors.input),
      dropzone: getElement(root, CONFIG.selectors.dropzone),
      previewOpen: getElement(root, CONFIG.selectors.previewOpen),
      removeButton: getElement(root, CONFIG.selectors.remove),
      name: getElement(root, CONFIG.selectors.name),
      size: getElement(root, CONFIG.selectors.size),
      type: getElement(root, CONFIG.selectors.type),
      status: getElement(root, CONFIG.selectors.status),
      file: null,
      kind: null,
      objectURL: null,
      listeners: []
    };

    state.widgets.set(root, widget);
    state.widgetElements.add(root);

    if (widget.input) {
      widget.input.accept = getAllowedExtensions(widget).join(",");

      addWidgetListener(widget, widget.input, "change", function () {
        var file = widget.input.files && widget.input.files[0];

        if (!file) {
          clearWidget(widget);
          return;
        }

        if (!setWidgetFile(widget, file)) {
          widget.input.value = "";
        }
      });
    }

    if (widget.previewOpen) {
      addWidgetListener(widget, widget.previewOpen, "click", function () {
        openPreview(widget);
      });
      widget.previewOpen.disabled = true;
    }

    if (widget.removeButton) {
      addWidgetListener(widget, widget.removeButton, "click", function () {
        clearWidget(widget);
      });
      widget.removeButton.disabled = true;
    }

    if (widget.dropzone && widget.input) {
      addWidgetListener(widget, widget.dropzone, "dragover", function (event) {
        event.preventDefault();
        widget.dropzone.setAttribute("data-document-dragging", "true");
      });

      addWidgetListener(widget, widget.dropzone, "dragleave", function (event) {
        if (!widget.dropzone.contains(event.relatedTarget)) {
          widget.dropzone.removeAttribute("data-document-dragging");
        }
      });

      addWidgetListener(widget, widget.dropzone, "drop", function (event) {
        event.preventDefault();
        widget.dropzone.removeAttribute("data-document-dragging");

        var file = event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0];

        if (!file) {
          return;
        }

        if (setWidgetFile(widget, file)) {
          /*
           * The FileList cannot be assigned reliably across browsers.
           * Use the widget's internal file state for previews. If a
           * real upload is required, integrate this with your form.
           */
          if (widget.status) {
            widget.status.textContent =
              cleanText(file.name, 255) + " selected by drag and drop.";
          }
        }
      });

      addWidgetListener(widget, widget.dropzone, "keydown", function (event) {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target === widget.dropzone
        ) {
          event.preventDefault();
          widget.input.click();
        }
      });
    }

    updateMetadata(widget, null);

    return widget;
  }

  function refresh() {
    if (state.destroyed) {
      return;
    }

    injectStyles();

    getElements(document, CONFIG.selectors.widget).forEach(function (root) {
      initializeWidget(root);
    });

    /*
     * Support a single shared modal authored in the page.
     * Otherwise it is created when the first preview is opened.
     */
    var authoredModal = getElement(document, CONFIG.selectors.modal);

    if (authoredModal && !state.modal) {
      state.modal = authoredModal;

      var closeButton = getElement(authoredModal, CONFIG.selectors.close);

      if (closeButton) {
        addListener(closeButton, "click", closePreview);
      }

      addListener(authoredModal, "click", function (event) {
        if (event.target === authoredModal) {
          closePreview();
        }
      });
    }
  }

  function getWidget(rootOrElement) {
    if (!rootOrElement) {
      return null;
    }

    var root = rootOrElement.matches &&
      rootOrElement.matches(CONFIG.selectors.widget)
      ? rootOrElement
      : rootOrElement.closest
        ? rootOrElement.closest(CONFIG.selectors.widget)
        : null;

    return root ? state.widgets.get(root) || null : null;
  }

  function setFile(rootOrElement, file) {
    var widget = getWidget(rootOrElement);

    if (!widget) {
      throw new Error("No initialized document preview widget was found.");
    }

    return setWidgetFile(widget, file);
  }

  function removeFile(rootOrElement) {
    var widget = getWidget(rootOrElement);

    if (!widget) {
      return false;
    }

    clearWidget(widget);
    return true;
  }

  function preview(rootOrElement) {
    var widget = getWidget(rootOrElement);

    if (!widget) {
      return false;
    }

    return openPreview(widget);
  }

  function destroyWidget(widget) {
    releaseWidgetURL(widget);

    widget.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    widget.listeners = [];
    widget.file = null;
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    closePreview();

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.widgetElements.forEach(function (root) {
      var widget = state.widgets.get(root);

      if (widget) {
        destroyWidget(widget);
      }
    });

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.widgetElements.clear();
    state.listeners = [];

    if (state.modal && state.modal.parentNode &&
        state.modal.getAttribute("data-mo-created-modal") === "true") {
      state.modal.remove();
    }

    if (state.styleElement && state.styleElement.parentNode) {
      state.styleElement.remove();
    }

    state.destroyed = true;
  }

  var publicAPI = {
    version: "1.0.0",
    refresh: refresh,
    setFile: setFile,
    removeFile: removeFile,
    preview: preview,
    close: closePreview,
    destroy: destroy,
    configure: function (options) {
      if (!options || typeof options !== "object") {
        return false;
      }

      if (Number.isFinite(options.maxFileSizeBytes) && options.maxFileSizeBytes > 0) {
        CONFIG.maxFileSizeBytes = Math.min(
          options.maxFileSizeBytes,
          100 * 1024 * 1024
        );
      }

      if (Array.isArray(options.allowedExtensions)) {
        CONFIG.allowedExtensions = options.allowedExtensions
          .map(function (item) {
            var extension = String(item).trim().toLowerCase();
            return extension.charAt(0) === "." ? extension : "." + extension;
          })
          .filter(function (item) {
            return /^\.[a-z0-9]+$/.test(item);
          });
      }

      return true;
    }
  };

  window[GLOBAL_KEY] = publicAPI;
  window.MedOrbitsDocumentPreview = publicAPI;

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
                (node.matches && node.matches(CONFIG.selectors.widget)) ||
                (node.querySelector && node.querySelector(CONFIG.selectors.widget))
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
