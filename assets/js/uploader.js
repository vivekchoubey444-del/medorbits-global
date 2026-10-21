
/* =========================================================
   MedOrbits -- Secure File Uploader
   File: /assets/js/uploader.js

   Features:
   - File selection and drag-and-drop
   - File size, extension, and MIME-type checks
   - Upload progress when supported by XMLHttpRequest
   - Multiple-file support
   - Accessible status messages
   - Cancellation and cleanup
   - Configurable API endpoint
   - Safe DOM rendering

   IMPORTANT:
   Client-side checks are not a security boundary.
   Validate files, permissions, and content on the server.
   ========================================================= */

(function (window, document) {
  "use strict";

  var CONFIG = window.MedOrbitsConfig || {};
  var CONSTANTS = window.MedOrbitsConstants || {};

  var API_BASE = String(
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    CONFIG.apiBaseURL ||
    "/api"
  ).replace(/\/+$/, "");

  var API = CONSTANTS.API || {};

  var DEFAULTS = Object.freeze({
    endpoint: API.FILE_UPLOAD || API.DOCUMENT_UPLOAD ||
      API_BASE + "/uploads",
    fieldName: "files",
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png"
    ],
    timeout: 120000,
    credentials: "same-origin"
  });

  var instances = [];
  var nextInstanceId = 1;

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function asArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function normalizeString(value) {
    return String(value == null ? "" : value).trim();
  }

  function formatBytes(bytes) {
    var value = Number(bytes);

    if (!Number.isFinite(value) || value < 0) return "Unknown size";
    if (value === 0) return "0 bytes";
    if (value < 1024) return value + " bytes";
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";

    return (value / (1024 * 1024)).toFixed(2) + " MB";
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function resolveElement(value, root) {
    if (!value) return null;

    if (
      typeof window.Element === "function" &&
      value instanceof window.Element
    ) {
      return value;
    }

    try {
      return (root || document).querySelector(value);
    } catch (error) {
      return null;
    }
  }

  function getExtension(filename) {
    var name = String(filename || "").toLowerCase();
    var index = name.lastIndexOf(".");

    return index < 0 ? "" : name.slice(index);
  }

  function normalizeExtensions(extensions) {
    return (extensions || []).map(function (extension) {
      var value = String(extension || "").trim().toLowerCase();

      if (!value) return "";
      return value.charAt(0) === "." ? value : "." + value;
    }).filter(Boolean);
  }

  function validateFile(file, options) {
    options = options || {};

    if (!file || typeof file.name !== "string") {
      return {
        valid: false,
        code: "invalid_file",
        message: "Choose a valid file."
      };
    }

    var maxSize = Number(options.maxFileSize);
    var extensions = normalizeExtensions(options.allowedExtensions);
    var mimeTypes = (options.allowedMimeTypes || []).map(function (type) {
      return String(type).toLowerCase();
    });

    if (Number.isFinite(maxSize) && maxSize > 0 && file.size > maxSize) {
      return {
        valid: false,
        code: "file_too_large",
        message: file.name + " exceeds the maximum size of " +
          formatBytes(maxSize) + "."
      };
    }

    var extension = getExtension(file.name);

    if (extensions.length && extensions.indexOf(extension) === -1) {
      return {
        valid: false,
        code: "extension_not_allowed",
        message: file.name + " has an unsupported file extension."
      };
    }

    /*
     * Browser-provided MIME types may be empty or inaccurate.
     * This check is only a user-experience filter; the server must
     * independently inspect file signatures and content.
     */
    if (
      file.type &&
      mimeTypes.length &&
      mimeTypes.indexOf(file.type.toLowerCase()) === -1
    ) {
      return {
        valid: false,
        code: "mime_type_not_allowed",
        message: file.name + " has an unsupported file type."
      };
    }

    return {
      valid: true,
      code: "valid",
      message: ""
    };
  }

  function parseResponseText(text, contentType) {
    if (!text) return null;

    if (String(contentType || "").toLowerCase().indexOf("json") !== -1) {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error("The server returned an invalid response.");
      }
    }

    return { message: text };
  }

  function getResponseMessage(data, fallback) {
    if (isObject(data)) {
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
      }

      if (typeof data.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    }

    return fallback || "The upload request failed.";
  }

  function makeError(message, code, status) {
    var error = new Error(message);

    error.code = code || "upload_error";
    error.status = status || 0;

    return error;
  }

  function createUploader(options) {
    options = options || {};

    var settings = {
      endpoint: options.endpoint || DEFAULTS.endpoint,
      fieldName: options.fieldName || DEFAULTS.fieldName,
      maxFileSize: options.maxFileSize == null
        ? DEFAULTS.maxFileSize
        : Number(options.maxFileSize),
      maxFiles: options.maxFiles == null
        ? DEFAULTS.maxFiles
        : Number(options.maxFiles),
      allowedExtensions: options.allowedExtensions
        ? options.allowedExtensions.slice()
        : DEFAULTS.allowedExtensions.slice(),
      allowedMimeTypes: options.allowedMimeTypes
        ? options.allowedMimeTypes.slice()
        : DEFAULTS.allowedMimeTypes.slice(),
      timeout: options.timeout == null
        ? DEFAULTS.timeout
        : Number(options.timeout),
      credentials: options.credentials || DEFAULTS.credentials,
      headers: isObject(options.headers) ? options.headers : {},
      additionalFields: isObject(options.additionalFields)
        ? options.additionalFields
        : {},
      withCredentials: options.withCredentials === true,
      onProgress: typeof options.onProgress === "function"
        ? options.onProgress
        : null,
      onSuccess: typeof options.onSuccess === "function"
        ? options.onSuccess
        : null,
      onError: typeof options.onError === "function"
        ? options.onError
        : null
    };

    var state = {
      files: [],
      uploading: false,
      progress: 0,
      error: null,
      result: null,
      xhr: null,
      destroyed: false
    };

    var listeners = [];
    var instanceId = nextInstanceId++;

    function snapshot() {
      return {
        files: state.files.slice(),
        uploading: state.uploading,
        progress: state.progress,
        error: state.error,
        result: state.result
      };
    }

    function notify() {
      var data = snapshot();

      listeners.slice().forEach(function (callback) {
        try {
          callback(data);
        } catch (error) {
          logError("Listener error", error);
        }
      });

      if (!state.destroyed) {
        emit("medorbits:upload:state", {
          instanceId: instanceId,
          state: data
        });
      }
    }

    function emit(name, detail) {
      try {
        document.dispatchEvent(new window.CustomEvent(name, {
          detail: detail || {}
        }));
      } catch (error) {
        // Custom events are optional.
      }
    }

    function logError(message, error) {
      if (window.console && typeof window.console.error === "function") {
        window.console.error("[MedOrbits Uploader] " + message, error);
      }
    }

    function setError(error) {
      state.error = error && error.message
        ? String(error.message)
        : "Upload failed.";

      notify();

      emit("medorbits:upload:error", {
        instanceId: instanceId,
        message: state.error,
        code: error && error.code ? error.code : "upload_error",
        status: error && error.status ? error.status : 0
      });

      if (settings.onError) {
        try {
          settings.onError(error, snapshot());
        } catch (callbackError) {
          logError("Error callback failed", callbackError);
        }
      }
    }

    function validateFiles(files) {
      var list = asArray(files);

      if (!list.length) {
        throw makeError("Select at least one file.", "no_files");
      }

      if (
        Number.isFinite(settings.maxFiles) &&
        settings.maxFiles > 0 &&
        list.length > settings.maxFiles
      ) {
        throw makeError(
          "You can select up to " + settings.maxFiles + " files.",
          "too_many_files"
        );
      }

      list.forEach(function (file) {
        var result = validateFile(file, settings);

        if (!result.valid) {
          throw makeError(result.message, result.code);
        }
      });

      return list;
    }

    function setFiles(files) {
      if (state.destroyed) {
        throw makeError("This uploader has been destroyed.", "destroyed");
      }

      if (state.uploading) {
        throw makeError("Cancel the current upload before changing files.", "busy");
      }

      var list = validateFiles(files);

      state.files = list;
      state.progress = 0;
      state.error = null;
      state.result = null;

      notify();

      emit("medorbits:upload:files-selected", {
        instanceId: instanceId,
        count: list.length
      });

      return list.slice();
    }

    function createFormData(files) {
      var formData = new window.FormData();

      Object.keys(settings.additionalFields).forEach(function (key) {
        var value = settings.additionalFields[key];

        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
          value.forEach(function (item) {
            formData.append(key, String(item));
          });
        } else if (typeof value === "object") {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });

      files.forEach(function (file) {
        formData.append(settings.fieldName, file, file.name);
      });

      return formData;
    }

    function upload(files) {
      if (state.destroyed) {
        return Promise.reject(makeError(
          "This uploader has been destroyed.",
          "destroyed"
        ));
      }

      if (state.uploading) {
        return Promise.reject(makeError(
          "An upload is already in progress.",
          "busy"
        ));
      }

      var selected;

      try {
        selected = files ? validateFiles(files) : validateFiles(state.files);
      } catch (error) {
        setError(error);
        return Promise.reject(error);
      }

      if (!settings.endpoint) {
        var endpointError = makeError(
          "No upload endpoint is configured.",
          "missing_endpoint"
        );

        setError(endpointError);
        return Promise.reject(endpointError);
      }

      state.files = selected.slice();
      state.uploading = true;
      state.progress = 0;
      state.error = null;
      state.result = null;

      notify();

      return new Promise(function (resolve, reject) {
        var xhr = new window.XMLHttpRequest();
        state.xhr = xhr;

        var settled = false;

        function cleanup() {
          if (state.xhr === xhr) state.xhr = null;
        }

        function finishSuccess(result) {
          if (settled) return;
          settled = true;

          cleanup();
          state.uploading = false;
          state.progress = 100;
          state.result = result;
          state.error = null;
          notify();

          emit("medorbits:upload:success", {
            instanceId: instanceId,
            result: result
          });

          if (settings.onSuccess) {
            try {
              settings.onSuccess(result, snapshot());
            } catch (callbackError) {
              logError("Success callback failed", callbackError);
            }
          }

          resolve(result);
        }

        function finishError(error) {
          if (settled) return;
          settled = true;

          cleanup();
          state.uploading = false;

          setError(error);
          notify();

          reject(error);
        }

        xhr.open("POST", settings.endpoint, true);
        xhr.withCredentials = settings.withCredentials;

        if (Number.isFinite(settings.timeout) && settings.timeout > 0) {
          xhr.timeout = settings.timeout;
        }

        Object.keys(settings.headers).forEach(function (key) {
          var lower = key.toLowerCase();

          /*
           * Do not set Content-Type for FormData; the browser must add
           * the multipart boundary automatically.
           */
          if (lower !== "content-type") {
            xhr.setRequestHeader(key, String(settings.headers[key]));
          }
        });

        xhr.upload.onprogress = function (event) {
          if (!event.lengthComputable || settled) return;

          var progress = Math.round((event.loaded / event.total) * 100);
          state.progress = Math.max(0, Math.min(99, progress));

          notify();

          if (settings.onProgress) {
            try {
              settings.onProgress(state.progress, event, snapshot());
            } catch (callbackError) {
              logError("Progress callback failed", callbackError);
            }
          }

          emit("medorbits:upload:progress", {
            instanceId: instanceId,
            progress: state.progress
          });
        };

        xhr.onload = function () {
          var result;

          try {
            result = parseResponseText(
              xhr.responseText,
              xhr.getResponseHeader("content-type")
            );
          } catch (error) {
            finishError(error);
            return;
          }

          if (xhr.status < 200 || xhr.status >= 300) {
            finishError(makeError(
              getResponseMessage(result, "Upload failed. Please try again."),
              result && result.code || "http_error",
              xhr.status
            ));
            return;
          }

          finishSuccess(result);
        };

        xhr.onerror = function () {
          finishError(makeError(
            "A network error prevented the upload.",
            "network_error",
            xhr.status
          ));
        };

        xhr.ontimeout = function () {
          finishError(makeError(
            "The upload timed out. Please try again.",
            "timeout",
            xhr.status
          ));
        };

        xhr.onabort = function () {
          finishError(makeError(
            "The upload was cancelled.",
            "aborted",
            xhr.status
          ));
        };

        try {
          xhr.send(createFormData(selected));
        } catch (error) {
          finishError(makeError(
            "The upload could not be started.",
            "send_failed"
          ));
        }
      });
    }

    function cancel() {
      if (!state.uploading || !state.xhr) return false;

      state.xhr.abort();
      return true;
    }

    function clear() {
      if (state.uploading) {
        throw makeError(
          "Cancel the current upload before clearing the uploader.",
          "busy"
        );
      }

      state.files = [];
      state.progress = 0;
      state.error = null;
      state.result = null;

      notify();
    }

    function subscribe(callback) {
      if (typeof callback !== "function") {
        return function () {};
      }

      if (listeners.indexOf(callback) === -1) {
        listeners.push(callback);
      }

      return function () {
        var index = listeners.indexOf(callback);

        if (index !== -1) listeners.splice(index, 1);
      };
    }

    function destroy() {
      if (state.destroyed) return;

      if (state.uploading && state.xhr) {
        state.xhr.abort();
      }

      state.destroyed = true;
      listeners.length = 0;

      var index = instances.indexOf(api);

      if (index !== -1) instances.splice(index, 1);
    }

    var api = {
      id: instanceId,
      options: settings,
      getState: snapshot,
      getFiles: function () {
        return state.files.slice();
      },
      validateFile: function (file) {
        return validateFile(file, settings);
      },
      setFiles: setFiles,
      upload: upload,
      cancel: cancel,
      clear: clear,
      subscribe: subscribe,
      destroy: destroy
    };

    instances.push(api);

    return api;
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (error) {
      // Event support is optional.
    }
  }

  function createUI(root, options) {
    options = options || {};

    var container = resolveElement(root);
    if (!container) return null;

    var fileInput = container.querySelector(
      'input[type="file"][data-upload-input]'
    );

    if (!fileInput) {
      fileInput = container.querySelector('input[type="file"]');
    }

    if (!fileInput) return null;

    var dropZone = container.querySelector("[data-upload-dropzone]") ||
      fileInput.parentElement;

    var list = container.querySelector("[data-upload-file-list]");
    var progress = container.querySelector("[data-upload-progress]");
    var status = container.querySelector("[data-upload-status]");
    var uploadButton = container.querySelector("[data-upload-submit]");
    var cancelButton = container.querySelector("[data-upload-cancel]");
    var clearButton = container.querySelector("[data-upload-clear]");

    var uploader = createUploader(options);
    var destroyed = false;

    fileInput.multiple = options.multiple !== false;

    if (options.accept) {
      fileInput.setAttribute("accept", options.accept);
    } else if (!fileInput.hasAttribute("accept")) {
      fileInput.setAttribute("accept", DEFAULTS.allowedExtensions.join(","));
    }

    function setStatus(message, type) {
      if (!status) return;

      status.textContent = message || "";
      status.setAttribute("role", type === "error" ? "alert" : "status");

      status.classList.toggle("is-error", type === "error");
      status.classList.toggle("is-success", type === "success");
    }

    function renderFiles(files) {
      if (!list) return;

      list.textContent = "";

      files.forEach(function (file, index) {
        var item = createElement("li", "upload-file");
        var name = createElement("span", "upload-file__name", file.name);
        var size = createElement("span", "upload-file__size", formatBytes(file.size));

        item.setAttribute("data-upload-index", String(index));
        item.appendChild(name);
        item.appendChild(size);
        list.appendChild(item);
      });
    }

    function renderState(snapshot) {
      if (progress) {
        var value = Math.max(0, Math.min(100, snapshot.progress || 0));

        progress.value = value;
        progress.setAttribute("aria-valuenow", String(value));

        if (progress.tagName.toLowerCase() === "progress") {
          progress.max = 100;
        }
      }

      if (uploadButton) {
        uploadButton.disabled = snapshot.uploading || !snapshot.files.length;
      }

      if (cancelButton) {
        cancelButton.disabled = !snapshot.uploading;
      }

      if (clearButton) {
        clearButton.disabled = snapshot.uploading || !snapshot.files.length;
      }

      if (snapshot.error) {
        setStatus(snapshot.error, "error");
      } else if (snapshot.uploading) {
        setStatus("Uploading… " + snapshot.progress + "%", "info");
      } else if (snapshot.result) {
        setStatus("Upload completed successfully.", "success");
      }
    }

    function onFilesSelected(files) {
      try {
        uploader.setFiles(files);
        renderFiles(uploader.getFiles());

        fileInput.setCustomValidity("");
        setStatus(
          files.length + (files.length === 1 ? " file selected." : " files selected."),
          "info"
        );
      } catch (error) {
        fileInput.setCustomValidity(error.message);
        setStatus(error.message, "error");
        fileInput.reportValidity();
      }
    }

    function handleInputChange() {
      onFilesSelected(fileInput.files);
    }

    function handleDragOver(event) {
      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }

      if (dropZone) dropZone.classList.add("is-dragover");
    }

    function handleDragLeave(event) {
      if (
        event.relatedTarget &&
        dropZone &&
        dropZone.contains(event.relatedTarget)
      ) {
        return;
      }

      if (dropZone) dropZone.classList.remove("is-dragover");
    }

    function handleDrop(event) {
      event.preventDefault();

      if (dropZone) dropZone.classList.remove("is-dragover");

      if (uploader.getState().uploading) {
        setStatus("Cancel the current upload before changing files.", "error");
        return;
      }

      var files = event.dataTransfer && event.dataTransfer.files;

      if (!files || !files.length) return;

      onFilesSelected(files);
    }

    function handleSubmit(event) {
      event.preventDefault();

      if (uploader.getState().uploading) return;

      var files = uploader.getFiles();

      if (!files.length) {
        setStatus("Select a file before uploading.", "error");
        fileInput.focus();
        return;
      }

      uploader.upload().then(function () {
        setStatus("Upload completed successfully.", "success");

        if (options.clearOnSuccess) {
          uploader.clear();
          fileInput.value = "";
          renderFiles([]);
        }
      }).catch(function (error) {
        setStatus(error.message || "Upload failed.", "error");
      });
    }

    function handleCancel() {
      uploader.cancel();
    }

    function handleClear() {
      try {
        uploader.clear();
        fileInput.value = "";
        fileInput.setCustomValidity("");
        renderFiles([]);
        setStatus("Selected files cleared.", "info");
      } catch (error) {
        setStatus(error.message, "error");
      }
    }

    function handleKeydown(event) {
      if (!dropZone || event.target !== dropZone) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    }

    var unsubscribe = uploader.subscribe(renderState);

    fileInput.addEventListener("change", handleInputChange);

    if (dropZone) {
      dropZone.addEventListener("dragover", handleDragOver);
      dropZone.addEventListener("dragleave", handleDragLeave);
      dropZone.addEventListener("drop", handleDrop);
      dropZone.addEventListener("keydown", handleKeydown);

      if (!dropZone.hasAttribute("tabindex")) {
        dropZone.setAttribute("tabindex", "0");
      }

      if (!dropZone.hasAttribute("role")) {
        dropZone.setAttribute("role", "button");
      }

      if (!dropZone.hasAttribute("aria-label")) {
        dropZone.setAttribute("aria-label", "Choose files or drag files here");
      }
    }

    if (uploadButton) {
      uploadButton.addEventListener("click", handleSubmit);
    }

    var form = container.matches("form")
      ? container
      : container.querySelector("form[data-upload-form]");

    if (form) {
      form.addEventListener("submit", handleSubmit);
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", handleCancel);
    }

    if (clearButton) {
      clearButton.addEventListener("click", handleClear);
    }

    renderFiles([]);
    renderState(uploader.getState());

    function destroy() {
      if (destroyed) return;
      destroyed = true;

      unsubscribe();

      fileInput.removeEventListener("change", handleInputChange);

      if (dropZone) {
        dropZone.removeEventListener("dragover", handleDragOver);
        dropZone.removeEventListener("dragleave", handleDragLeave);
        dropZone.removeEventListener("drop", handleDrop);
        dropZone.removeEventListener("keydown", handleKeydown);
      }

      if (uploadButton) {
        uploadButton.removeEventListener("click", handleSubmit);
      }

      if (form) {
        form.removeEventListener("submit", handleSubmit);
      }

      if (cancelButton) {
        cancelButton.removeEventListener("click", handleCancel);
      }

      if (clearButton) {
        clearButton.removeEventListener("click", handleClear);
      }

      uploader.destroy();
    }

    return {
      uploader: uploader,
      destroy: destroy,
      refresh: function () {
        renderFiles(uploader.getFiles());
        renderState(uploader.getState());
      }
    };
  }

  function resolveElement(value, root) {
    if (!value) return null;

    if (
      typeof window.Element === "function" &&
      value instanceof window.Element
    ) {
      return value;
    }

    try {
      return (root || document).querySelector(value);
    } catch (error) {
      return null;
    }
  }

  function init(root, options) {
    root = root || document;
    options = options || {};

    var containers = [];

    if (
      typeof window.Element === "function" &&
      root instanceof window.Element &&
      root.matches("[data-medorbits-uploader]")
    ) {
      containers.push(root);
    }

    if (root.querySelectorAll) {
      containers = containers.concat(
        Array.prototype.slice.call(
          root.querySelectorAll("[data-medorbits-uploader]")
        )
      );
    }

    var results = [];

    containers.forEach(function (container) {
      if (container.__medOrbitsUploader) return;

      var ui = createUI(container, options);

      if (ui) {
        container.__medOrbitsUploader = ui;
        results.push(ui);
      }
    });

    return results;
  }

  function destroyAll() {
    instances.slice().forEach(function (instance) {
      instance.destroy();
    });

    getUploaderContainers().forEach(function (container) {
      if (container.__medOrbitsUploader) {
        container.__medOrbitsUploader.destroy();
        delete container.__medOrbitsUploader;
      }
    });
  }

  function getUploaderContainers() {
    return Array.prototype.slice.call(
      document.querySelectorAll("[data-medorbits-uploader]")
    );
  }

  var api = {
    DEFAULTS: DEFAULTS,
    create: createUploader,
    createUI: createUI,
    init: init,
    validateFile: function (file, options) {
      var settings = {
        maxFileSize: options && options.maxFileSize != null
          ? options.maxFileSize
          : DEFAULTS.maxFileSize,
        allowedExtensions: options && options.allowedExtensions
          ? options.allowedExtensions
          : DEFAULTS.allowedExtensions,
        allowedMimeTypes: options && options.allowedMimeTypes
          ? options.allowedMimeTypes
          : DEFAULTS.allowedMimeTypes
      };

      return validateFile(file, settings);
    },
    formatBytes: formatBytes,
    destroyAll: destroyAll
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsUploader = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Uploader = api;

  function autoInit() {
    init(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

})(window, document);
