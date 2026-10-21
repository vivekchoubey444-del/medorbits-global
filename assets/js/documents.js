
/* =========================================================
   MedOrbits -- assets/js/documents.js
   Document management, upload, download, preview, and delete
   Version: 1.2.0
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsDocuments) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const CONSTANTS = window.MedOrbitsConstants || {};

  const API_BASE = String(
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    "/api"
  ).replace(/\/+$/, "");

  const ENDPOINTS = Object.freeze({
    documents:
      CONSTANTS.API?.DOCUMENTS ||
      `${API_BASE}/documents`
  });

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const ALLOWED_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png"
  ]);

  const ALLOWED_EXTENSIONS = new Set([
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png"
  ]);

  const state = {
    documents: [],
    loading: false,
    uploading: false,
    error: null,
    selectedDocument: null
  };

  const listeners = new Set();

  let loadSequence = 0;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function getDocumentId(item) {
    return String(
      item?.id ??
      item?.documentId ??
      item?._id ??
      ""
    );
  }

  function getDocumentName(item) {
    return String(
      item?.originalName ||
      item?.name ||
      item?.filename ||
      "Document"
    );
  }

  function getDocumentType(item) {
    return String(
      item?.documentType ||
      item?.type ||
      "Other"
    );
  }

  function getDocumentStatus(item) {
    return String(
      item?.status ||
      item?.verificationStatus ||
      "Uploaded"
    );
  }

  function formatBytes(bytes) {
    const size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) {
      return "Unknown size";
    }

    if (size === 0) return "0 Bytes";

    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(size) / Math.log(1024)),
      units.length - 1
    );

    return `${(size / Math.pow(1024, index)).toFixed(
      index ? 2 : 0
    )} ${units[index]}`;
  }

  function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "--";

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function validateFile(file) {
    if (
      typeof File === "undefined" ||
      !(file instanceof File)
    ) {
      return {
        valid: false,
        error: "Please select a valid file."
      };
    }

    if (file.size <= 0) {
      return {
        valid: false,
        error: "The selected file is empty."
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: "File size must not exceed 10 MB."
      };
    }

    const filename = String(file.name || "");
    const dotIndex = filename.lastIndexOf(".");
    const extension = dotIndex >= 0
      ? filename.slice(dotIndex).toLowerCase()
      : "";

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return {
        valid: false,
        error: "Only PDF, JPG, PNG, and JPEG files are allowed."
      };
    }

    if (file.type && !ALLOWED_TYPES.has(file.type.toLowerCase())) {
      return {
        valid: false,
        error: "The selected file type is not allowed."
      };
    }

    return { valid: true, error: null };
  }

  function isFormData(value) {
    return typeof FormData !== "undefined" &&
      value instanceof FormData;
  }

  async function requestJSON(url, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    if (options.body && !isFormData(options.body)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await window.fetch(url, {
      credentials: "same-origin",
      ...options,
      headers
    });

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    let result = null;

    if (contentType.toLowerCase().includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    if (!response.ok) {
      const message =
        result && typeof result === "object"
          ? result.message || result.error
          : null;

      throw new Error(
        message || `Request failed (${response.status}).`
      );
    }

    return result;
  }

  function extractDocuments(result) {
    if (Array.isArray(result)) return result;
    if (!result || typeof result !== "object") return [];

    const candidates = [
      result.documents,
      result.data?.documents,
      result.results,
      result.data
    ];

    return candidates.find(Array.isArray) || [];
  }

  async function load(options = {}) {
    const sequence = ++loadSequence;

    state.loading = true;
    state.error = null;
    notify();

    try {
      const query = new URLSearchParams();

      if (options.type) {
        query.set("type", String(options.type));
      }

      if (options.status) {
        query.set("status", String(options.status));
      }

      const suffix = query.toString();
      const url = suffix
        ? `${ENDPOINTS.documents}?${suffix}`
        : ENDPOINTS.documents;

      const result = await requestJSON(url);

      if (sequence !== loadSequence) {
        return getDocuments();
      }

      state.documents = extractDocuments(result).filter(function (item) {
        return item && typeof item === "object";
      });

      return getDocuments();
    } catch (error) {
      if (sequence === loadSequence) {
        state.error = error.message || "Unable to load documents.";
      }

      return [];
    } finally {
      if (sequence === loadSequence) {
        state.loading = false;
        notify();
      }
    }
  }

  async function upload(file, metadata = {}) {
    const validation = validateFile(file);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (state.uploading) {
      throw new Error("A document upload is already in progress.");
    }

    state.uploading = true;
    state.error = null;
    notify();

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append(
        "documentType",
        String(metadata.documentType || metadata.type || "Other")
      );

      if (metadata.applicationId) {
        formData.append("applicationId", String(metadata.applicationId));
      }

      if (metadata.description) {
        formData.append("description", String(metadata.description));
      }

      if (metadata.title) {
        formData.append("title", String(metadata.title));
      }

      const result = await requestJSON(ENDPOINTS.documents, {
        method: "POST",
        body: formData
      });

      const uploaded =
        result?.document ||
        result?.data?.document ||
        result?.data ||
        result;

      if (
        uploaded &&
        typeof uploaded === "object" &&
        !Array.isArray(uploaded) &&
        getDocumentId(uploaded)
      ) {
        const id = getDocumentId(uploaded);

        state.documents = [
          uploaded,
          ...state.documents.filter(function (item) {
            return getDocumentId(item) !== id;
          })
        ];
      } else {
        await load();
      }

      notify();
      return uploaded;
    } catch (error) {
      state.error = error.message || "Document upload failed.";
      throw error;
    } finally {
      state.uploading = false;
      notify();
    }
  }

  async function uploadFromForm(form) {
    const target = typeof form === "string"
      ? document.querySelector(form)
      : form;

    if (!target) {
      throw new Error("Document upload form was not found.");
    }

    const fileInput = target.querySelector('input[type="file"]');
    const file = fileInput?.files?.[0];

    if (!file) {
      throw new Error("Please choose a file to upload.");
    }

    const formData = new FormData(target);

    return upload(file, {
      documentType:
        formData.get("documentType") ||
        formData.get("type") ||
        "Other",
      applicationId: formData.get("applicationId"),
      description: formData.get("description"),
      title: formData.get("title")
    });
  }

  async function remove(id) {
    const documentId = String(id || "");

    if (!documentId) {
      throw new Error("Document ID is required.");
    }

    await requestJSON(
      `${ENDPOINTS.documents}/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );

    state.documents = state.documents.filter(function (item) {
      return getDocumentId(item) !== documentId;
    });

    if (
      state.selectedDocument &&
      getDocumentId(state.selectedDocument) === documentId
    ) {
      clearPreview();
    }

    notify();
    return true;
  }

  function getDocuments() {
    return [...state.documents];
  }

  function getDocument(id) {
    const target = String(id ?? "");

    return state.documents.find(function (item) {
      return getDocumentId(item) === target;
    }) || null;
  }

  function filter(options = {}) {
    return state.documents.filter(function (item) {
      if (
        options.type &&
        normalize(getDocumentType(item)) !== normalize(options.type)
      ) {
        return false;
      }

      if (
        options.status &&
        normalize(getDocumentStatus(item)) !== normalize(options.status)
      ) {
        return false;
      }

      if (options.search) {
        const query = normalize(options.search);

        const searchable = [
          getDocumentName(item),
          getDocumentType(item),
          getDocumentStatus(item),
          item.description
        ].map(normalize).join(" ");

        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  }

  function getState() {
    return {
      documents: getDocuments(),
      loading: state.loading,
      uploading: state.uploading,
      error: state.error,
      selectedDocument: state.selectedDocument
    };
  }

  function resolveElement(element) {
    if (!element) return null;

    return typeof element === "string"
      ? document.querySelector(element)
      : element;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function render(container, items = state.documents) {
    const target = resolveElement(container);

    if (!target) return false;

    target.replaceChildren();

    if (state.loading && !items.length) {
      target.appendChild(
        createElement("p", "documents-status", "Loading documents...")
      );

      return true;
    }

    if (state.error && !items.length) {
      target.appendChild(
        createElement(
          "p",
          "documents-status documents-status--error",
          state.error
        )
      );

      return true;
    }

    if (!items.length) {
      const empty = createElement("div", "documents-empty-state");

      empty.append(
        createElement("h3", "", "No documents uploaded"),
        createElement(
          "p",
          "",
          "Upload your documents to keep your application records organized."
        )
      );

      target.appendChild(empty);
      return true;
    }

    items.forEach(function (item) {
      const id = getDocumentId(item);
      const name = getDocumentName(item);
      const status = getDocumentStatus(item);
      const statusClass = normalize(status).replace(/[^a-z0-9-]/g, "-");

      const card = createElement("article", "document-card");
      card.dataset.documentId = id;

      const icon = createElement("div", "document-card__icon", "📄");
      icon.setAttribute("aria-hidden", "true");

      const content = createElement("div", "document-card__content");

      content.append(
        createElement("h3", "", name),
        createElement("p", "", getDocumentType(item)),
        createElement(
          "p",
          "",
          formatBytes(item.size ?? item.fileSize)
        ),
        createElement(
          "p",
          "",
          `Uploaded: ${formatDate(item.createdAt || item.uploadedAt)}`
        )
      );

      const statusElement = createElement(
        "span",
        `document-status document-status--${statusClass}`,
        status
      );

      content.appendChild(statusElement);

      const actions = createElement("div", "document-card__actions");

      [
        ["Preview", "data-document-preview-id"],
        ["Download", "data-document-download-id"],
        ["Delete", "data-document-delete-id"]
      ].forEach(function ([label, attribute]) {
        const button = createElement("button", "", label);

        button.type = "button";
        button.setAttribute(attribute, id);

        if (!id) button.disabled = true;

        actions.appendChild(button);
      });

      card.append(icon, content, actions);
      target.appendChild(card);
    });

    return true;
  }

  function clearPreview() {
    if (state.selectedDocument?.previewURL) {
      URL.revokeObjectURL(state.selectedDocument.previewURL);
    }

    state.selectedDocument = null;
    renderPreview("[data-document-preview]", null);
  }

  async function download(id) {
    const item = getDocument(id);

    if (!item) {
      throw new Error("Document not found.");
    }

    const documentId = getDocumentId(item);

    if (!documentId) {
      throw new Error("Document ID is missing.");
    }

    const response = await window.fetch(
      `${ENDPOINTS.documents}/${encodeURIComponent(documentId)}/download`,
      { credentials: "same-origin" }
    );

    if (!response.ok) {
      throw new Error(`Download failed (${response.status}).`);
    }

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectURL;
    anchor.download = getDocumentName(item);

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(objectURL);
    }, 1000);

    return true;
  }

  async function preview(id) {
    const item = getDocument(id);

    if (!item) {
      throw new Error("Document not found.");
    }

    const documentId = getDocumentId(item);

    if (!documentId) {
      throw new Error("Document ID is missing.");
    }

    const response = await window.fetch(
      `${ENDPOINTS.documents}/${encodeURIComponent(documentId)}/preview`,
      { credentials: "same-origin" }
    );

    if (!response.ok) {
      throw new Error(`Preview failed (${response.status}).`);
    }

    const blob = await response.blob();

    if (
      ![
        "application/pdf",
        "image/jpeg",
        "image/png"
      ].includes(blob.type.toLowerCase())
    ) {
      throw new Error("The server returned an unsupported preview format.");
    }

    clearPreview();

    const objectURL = URL.createObjectURL(blob);

    state.selectedDocument = {
      ...item,
      previewURL: objectURL,
      previewMimeType: blob.type
    };

    renderPreview(
      "[data-document-preview]",
      state.selectedDocument
    );

    notify();

    return state.selectedDocument;
  }

  function renderPreview(container, item = state.selectedDocument) {
    const target = resolveElement(container);

    if (!target) return false;

    target.replaceChildren();

    if (!item) return true;

    const url = item.previewURL || "";
    const mimeType = normalize(
      item.previewMimeType ||
      item.mimeType ||
      item.mimetype ||
      item.contentType
    );

    const isPDF =
      mimeType === "application/pdf" ||
      normalize(getDocumentName(item)).endsWith(".pdf");

    const section = createElement("section", "document-preview");
    const header = createElement("div", "document-preview__header");

    const title = createElement("h3", "", getDocumentName(item));
    const close = createElement("button", "", "Close");

    close.type = "button";
    close.setAttribute("data-document-preview-close", "");

    header.append(title, close);
    section.appendChild(header);

    if (!url) {
      section.appendChild(
        createElement("p", "", "Preview is not available for this document.")
      );
    } else if (isPDF) {
      const frame = createElement("iframe", "document-preview__frame");

      frame.title = `Preview: ${getDocumentName(item)}`;
      frame.src = url;
      frame.setAttribute("sandbox", "allow-same-origin");
      section.appendChild(frame);
    } else if (
      mimeType === "image/jpeg" ||
      mimeType === "image/png"
    ) {
      const image = createElement("img", "document-preview__image");

      image.src = url;
      image.alt = getDocumentName(item);
      section.appendChild(image);
    } else {
      section.appendChild(
        createElement("p", "", "Preview is not available for this file type.")
      );
    }

    target.appendChild(section);
    return true;
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    listeners.add(callback);

    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  function notify() {
    const snapshot = getState();

    listeners.forEach(function (callback) {
      try {
        callback(snapshot);
      } catch (error) {
        console.error("[MedOrbits Documents] Listener error:", error);
      }
    });

    document.dispatchEvent(
      new CustomEvent("medorbits:documents-updated", {
        detail: snapshot
      })
    );
  }

  function showMessage(message, type = "info") {
    if (window.MedOrbitsToast?.show) {
      window.MedOrbitsToast.show(message, type);
      return;
    }

    document.dispatchEvent(
      new CustomEvent("medorbits:toast", {
        detail: { message, type }
      })
    );
  }

  document.addEventListener("submit", async function (event) {
    const form = event.target.closest("[data-document-upload-form]");

    if (!form) return;

    event.preventDefault();

    const button = form.querySelector('[type="submit"]');

    if (button) button.disabled = true;

    try {
      await uploadFromForm(form);
      form.reset();

      render("[data-documents-list]");

      showMessage("Document uploaded successfully.", "success");
    } catch (error) {
      showMessage(
        error.message || "Document upload failed.",
        "error"
      );
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener("change", function (event) {
    const input = event.target;

    if (
      !(input instanceof Element) ||
      !input.matches("[data-document-file-input]")
    ) {
      return;
    }

    const file = input.files?.[0];

    if (!file) return;

    const result = validateFile(file);

    if (!result.valid) {
      input.value = "";
      showMessage(result.error, "error");
    }
  });

  document.addEventListener("click", async function (event) {
    if (!(event.target instanceof Element)) return;

    const previewButton = event.target.closest(
      "[data-document-preview-id]"
    );

    const downloadButton = event.target.closest(
      "[data-document-download-id]"
    );

    const deleteButton = event.target.closest(
      "[data-document-delete-id]"
    );

    const closeButton = event.target.closest(
      "[data-document-preview-close]"
    );

    if (previewButton) {
      previewButton.disabled = true;

      try {
        await preview(previewButton.getAttribute("data-document-preview-id"));
      } catch (error) {
        showMessage(error.message || "Unable to preview document.", "error");
      } finally {
        previewButton.disabled = false;
      }

      return;
    }

    if (downloadButton) {
      downloadButton.disabled = true;

      try {
        await download(downloadButton.getAttribute("data-document-download-id"));
      } catch (error) {
        showMessage(error.message || "Unable to download document.", "error");
      } finally {
        downloadButton.disabled = false;
      }

      return;
    }

    if (deleteButton) {
      const id = deleteButton.getAttribute("data-document-delete-id");

      if (!window.confirm("Are you sure you want to delete this document?")) {
        return;
      }

      deleteButton.disabled = true;

      try {
        await remove(id);
        render("[data-documents-list]");

        showMessage("Document deleted successfully.", "success");
      } catch (error) {
        showMessage(error.message || "Unable to delete document.", "error");
      } finally {
        deleteButton.disabled = false;
      }

      return;
    }

    if (closeButton) {
      clearPreview();
      notify();
    }
  });

  function initialize() {
    if (!document.querySelector("[data-documents-list]")) return;

    load().then(function () {
      render("[data-documents-list]");
    });
  }

  const api = Object.freeze({
    load,
    upload,
    uploadFromForm,
    remove,
    download,
    preview,
    validateFile,
    formatBytes,
    formatDate,
    getDocuments,
    getDocument,
    getState,
    filter,
    render,
    renderPreview,
    clearPreview,
    subscribe
  });

  window.MedOrbitsDocuments = api;

  window.addEventListener("pagehide", function () {
    if (state.selectedDocument?.previewURL) {
      URL.revokeObjectURL(state.selectedDocument.previewURL);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }

})(window, document);
