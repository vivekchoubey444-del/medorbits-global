
/**
 * MedOrbits -- User Profile Manager
 * File: /assets/js/profile.js
 * Version: 1.1.0
 *
 * Preserves:
 * - GET /users/me
 * - PATCH /users/me
 * - POST /users/me/avatar
 * - Existing data-profile-* attributes
 * - window.MedOrbitsProfile public API
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsProfile) return;

  const API = window.MedOrbitsConstants?.API || {
    PREFIX: "/api",
    ENDPOINTS: { USERS: "/users" }
  };

  const API_BASE = String(
    window.MedOrbitsConfig?.API_BASE_URL ||
    API.PREFIX ||
    "/api"
  ).replace(/\/+$/, "");

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
  const ALLOWED_AVATAR_TYPES = new Set([
    "image/jpeg",
    "image/png"
  ]);

  const UPDATE_FIELDS = new Set([
    "full_name",
    "fullName",
    "name",
    "phone",
    "phone_number",
    "date_of_birth",
    "gender",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "pincode",
    "bio",
    "headline",
    "website",
    "linkedin",
    "preferred_language",
    "timezone"
  ]);

  const state = {
    profile: null,
    loading: false,
    updating: false,
    avatarUploading: false,
    loadPromise: null,
    loadController: null,
    listenersBound: false,
    formControllers: new WeakMap(),
    avatarControllers: new WeakMap()
  };

  function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content") || "";
  }

  function notify(message, type = "info") {
    if (window.MedOrbits?.toast?.show) {
      window.MedOrbits.toast.show(message, { type });
      return;
    }

    const method = type === "error" ? "error" : "info";
    console[method](`[MedOrbits Profile] ${message}`);
  }

  function emit(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, {
      detail
    }));
  }

  function apiUrl(path) {
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return `${API_BASE}/${cleanPath}`;
  }

  function getHeaders(extraHeaders = {}) {
    const headers = {
      Accept: "application/json",
      ...extraHeaders
    };

    const csrf = getCsrfToken();

    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }

    return headers;
  }

  async function readPayload(response) {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(
          `Profile request failed with status ${response.status}.`
        );
      }

      return null;
    }

    return response.json();
  }

  async function request(path, options = {}) {
    const headers = getHeaders(options.headers || {});
    const hasBody = options.body !== undefined &&
      options.body !== null;

    if (hasBody && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const fetchOptions = {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      signal: options.signal
    };

    if (hasBody) {
      fetchOptions.body = options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body);
    }

    const response = await fetch(apiUrl(path), fetchOptions);
    const payload = await readPayload(response);

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        "Unable to complete the profile request.";

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function extractProfile(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const candidates = [
      payload.data?.user,
      payload.data?.profile,
      payload.user,
      payload.profile,
      payload.data,
      payload
    ];

    return candidates.find((candidate) =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) || null;
  }

  function getProfileName(profile) {
    return profile.full_name ||
      profile.fullName ||
      profile.name ||
      "";
  }

  function safeSameOriginUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }

    try {
      const url = new URL(value, window.location.origin);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.origin !== window.location.origin
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function renderProfile(profile) {
    if (!profile || typeof profile !== "object") {
      return;
    }

    document.querySelectorAll("[data-profile-field]").forEach((element) => {
      const field = element.dataset.profileField;

      if (!field || !Object.prototype.hasOwnProperty.call(profile, field)) {
        return;
      }

      const value = profile[field];

      if (
        value === null ||
        value === undefined ||
        typeof value === "object"
      ) {
        return;
      }

      element.textContent = String(value);
    });

    document.querySelectorAll("[data-profile-name]").forEach((element) => {
      element.textContent = String(getProfileName(profile));
    });

    document.querySelectorAll("[data-profile-email]").forEach((element) => {
      element.textContent = String(profile.email || "");
    });

    document.querySelectorAll("[data-profile-avatar]").forEach((element) => {
      if (!(element instanceof HTMLImageElement)) {
        return;
      }

      const avatar = safeSameOriginUrl(
        profile.avatar ||
        profile.profile_image ||
        profile.avatar_url ||
        ""
      );

      if (avatar) {
        element.src = avatar;
        element.hidden = false;
      } else {
        element.removeAttribute("src");
        element.hidden = true;
      }

      element.alt = getProfileName(profile)
        ? `${getProfileName(profile)} profile photo`
        : "Profile photo";
    });

    emit("medorbits:profile-rendered", {
      profile: { ...profile }
    });
  }

  async function load(options = {}) {
    if (state.loadPromise && !options.force) {
      return state.loadPromise;
    }

    if (state.loadController) {
      state.loadController.abort();
    }

    const controller = new AbortController();
    state.loadController = controller;
    state.loading = true;

    emit("medorbits:profile-loading", { loading: true });

    const promise = (async () => {
      try {
        const payload = await request("users/me", {
          method: "GET",
          signal: controller.signal
        });

        if (controller.signal.aborted) {
          return state.profile;
        }

        const profile = extractProfile(payload);

        if (!profile) {
          throw new Error("The server returned an invalid profile.");
        }

        state.profile = profile;
        renderProfile(profile);

        emit("medorbits:profile-loaded", {
          profile: { ...profile }
        });

        return profile;
      } catch (error) {
        if (error.name === "AbortError") {
          return state.profile;
        }

        emit("medorbits:profile-error", {
          operation: "load",
          message: error.message
        });

        throw error;
      } finally {
        if (state.loadController === controller) {
          state.loading = false;
          state.loadController = null;
          state.loadPromise = null;

          emit("medorbits:profile-loading", {
            loading: false
          });
        }
      }
    })();

    state.loadPromise = promise;

    return promise;
  }

  function extractUpdateData(details) {
    const form = details instanceof HTMLFormElement
      ? details
      : null;

    const source = form
      ? Object.fromEntries(new FormData(form).entries())
      : details;

    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new TypeError("Profile details must be an object or form.");
    }

    const data = {};

    Object.keys(source).forEach((key) => {
      if (!UPDATE_FIELDS.has(key)) {
        return;
      }

      const value = source[key];

      if (typeof value !== "string") {
        return;
      }

      const cleaned = value.trim();

      if (cleaned.length > 5000) {
        throw new Error(`${key} exceeds the maximum allowed length.`);
      }

      data[key] = cleaned;
    });

    if (!Object.keys(data).length) {
      throw new Error("No supported profile fields were provided.");
    }

    return data;
  }

  async function update(details = {}) {
    if (state.updating) {
      throw new Error("A profile update is already in progress.");
    }

    const data = extractUpdateData(details);

    state.updating = true;

    emit("medorbits:profile-updating", {
      updating: true
    });

    try {
      const payload = await request("users/me", {
        method: "PATCH",
        body: data
      });

      const updatedProfile = extractProfile(payload);

      if (updatedProfile) {
        state.profile = updatedProfile;
      } else if (state.profile) {
        state.profile = {
          ...state.profile,
          ...data
        };
      } else {
        // A successful response may omit the updated profile.
        await load({ force: true });
      }

      if (state.profile) {
        renderProfile(state.profile);
      }

      emit("medorbits:profile-updated", {
        profile: state.profile
          ? { ...state.profile }
          : null
      });

      notify("Profile updated successfully.", "success");

      return state.profile;
    } catch (error) {
      emit("medorbits:profile-error", {
        operation: "update",
        message: error.message
      });

      throw error;
    } finally {
      state.updating = false;

      emit("medorbits:profile-updating", {
        updating: false
      });
    }
  }

  async function uploadAvatar(file) {
    if (!(file instanceof File)) {
      throw new TypeError("Select a valid image file.");
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      throw new Error("Upload a JPG or PNG image.");
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_SIZE) {
      throw new Error("The image must be larger than 0 bytes and no more than 5 MB.");
    }

    if (state.avatarUploading) {
      throw new Error("An avatar upload is already in progress.");
    }

    const formData = new FormData();
    formData.append("avatar", file, file.name);

    state.avatarUploading = true;

    emit("medorbits:avatar-uploading", {
      uploading: true
    });

    try {
      const payload = await request("users/me/avatar", {
        method: "POST",
        body: formData
      });

      const updatedProfile = extractProfile(payload);

      if (updatedProfile) {
        state.profile = updatedProfile;
      } else {
        await load({ force: true });
      }

      if (state.profile) {
        renderProfile(state.profile);
      }

      emit("medorbits:avatar-uploaded", {
        profile: state.profile
          ? { ...state.profile }
          : null
      });

      notify("Profile photo updated.", "success");

      return state.profile;
    } catch (error) {
      emit("medorbits:profile-error", {
        operation: "avatar",
        message: error.message
      });

      throw error;
    } finally {
      state.avatarUploading = false;

      emit("medorbits:avatar-uploading", {
        uploading: false
      });
    }
  }

  function bindForms() {
    document.querySelectorAll("[data-profile-form]").forEach((form) => {
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (state.formControllers.has(form)) {
        return;
      }

      const controller = new AbortController();
      state.formControllers.set(form, controller);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) {
          return;
        }

        const button = form.querySelector('[type="submit"]');

        if (button) {
          button.disabled = true;
          button.setAttribute("aria-busy", "true");
        }

        try {
          await update(form);
        } catch (error) {
          notify(
            error.message || "Unable to update profile.",
            "error"
          );
        } finally {
          if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
          }
        }
      }, { signal: controller.signal });
    });

    document.querySelectorAll("[data-avatar-input]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      if (state.avatarControllers.has(input)) {
        return;
      }

      const controller = new AbortController();
      state.avatarControllers.set(input, controller);

      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];

        if (!file) {
          return;
        }

        input.disabled = true;

        try {
          await uploadAvatar(file);
        } catch (error) {
          notify(
            error.message || "Avatar upload failed.",
            "error"
          );
        } finally {
          input.value = "";
          input.disabled = false;
        }
      }, { signal: controller.signal });
    });
  }

  async function init() {
    bindForms();

    const hasProfileElements = document.querySelector(
      [
        "[data-profile-field]",
        "[data-profile-name]",
        "[data-profile-email]",
        "[data-profile-form]",
        "[data-profile-avatar]"
      ].join(",")
    );

    if (!hasProfileElements) {
      return null;
    }

    try {
      return await load();
    } catch (error) {
      notify(
        error.message || "Unable to load profile.",
        "error"
      );

      return null;
    }
  }

  function destroy() {
    if (state.loadController) {
      state.loadController.abort();
      state.loadController = null;
    }

    document.querySelectorAll("[data-profile-form]").forEach((form) => {
      const controller = state.formControllers.get(form);

      if (controller) {
        controller.abort();
        state.formControllers.delete(form);
      }
    });

    document.querySelectorAll("[data-avatar-input]").forEach((input) => {
      const controller = state.avatarControllers.get(input);

      if (controller) {
        controller.abort();
        state.avatarControllers.delete(input);
      }
    });

    state.loadPromise = null;
    state.loading = false;
  }

  const publicAPI = {
    load,
    update,
    uploadAvatar,
    render: renderProfile,
    init,
    destroy,

    get current() {
      return state.profile;
    },

    get loading() {
      return state.loading;
    },

    get updating() {
      return state.updating;
    },

    get avatarUploading() {
      return state.avatarUploading;
    }
  };

  window.MedOrbitsProfile = Object.freeze(publicAPI);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    void init();
  }
})();
