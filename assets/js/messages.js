
/* =========================================================
   MedOrbits -- Messages Module
   File: /assets/js/messages.js
   Purpose: Messaging, conversations, attachments, unread counts
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsMessages) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const API_BASE = String(
    CONFIG.API_BASE_URL || CONFIG.apiBaseUrl || "/api"
  ).replace(/\/+$/, "");

  const DEFAULT_PAGE_SIZE = 20;
  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
  const MAX_MESSAGE_LENGTH = 10000;
  const POLLING_MIN_INTERVAL = 15000;
  const CACHE_KEY = "medorbits_messages_cache";

  const ALLOWED_ATTACHMENT_TYPES = Object.freeze([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);

  const state = {
    conversations: [],
    activeConversation: null,
    messages: [],
    unreadCount: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    loading: false,
    sending: false,
    pollingTimer: null,
    initialized: false,
    destroyed: false,
    requests: new Map()
  };

  const listeners = new Map();
  const boundForms = new WeakSet();
  const boundSearchInputs = new WeakSet();
  const boundRefreshButtons = new WeakSet();
  const pendingRead = new Set();

  const utils = {
    escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    formatDate(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return "";

      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
    },

    formatTime(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return "";

      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
    },

    formatFileSize(bytes) {
      const size = Math.max(0, Number(bytes) || 0);

      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    },

    initials(name) {
      return String(name || "User")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
    },

    currentUserId() {
      const user =
        window.MedOrbitsAuth?.getUser?.() ||
        window.MedOrbitsUserModel?.getCurrentUser?.() ||
        window.MedOrbitsUser ||
        {};

      return String(user.id || user._id || user.userId || "");
    },

    dispatch(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(
        `medorbits:messages:${name}`,
        { detail }
      ));
    },

    notify(message, type = "info") {
      if (window.MedOrbitsToast?.[type]) {
        window.MedOrbitsToast[type](message);
        return;
      }

      if (window.MedOrbitsErrorHandler?.notify) {
        window.MedOrbitsErrorHandler.notify(message, type);
        return;
      }

      if (window.MedOrbitsApp?.notify) {
        window.MedOrbitsApp.notify(message, type);
        return;
      }

      this.dispatch("notification", { message, type });
    },

    getCache() {
      try {
        return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
      } catch {
        return {};
      }
    },

    setCache(data) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        // Storage can be unavailable or full.
      }
    },

    updateCache(key, value) {
      const cache = this.getCache();
      cache[key] = value;
      this.setCache(cache);
    },

    isValidId(value) {
      return (
        (typeof value === "string" || typeof value === "number") &&
        String(value).trim().length > 0
      );
    },

    resolveElement(target, fallbackSelector) {
      if (typeof target === "string") {
        try {
          return document.querySelector(target);
        } catch {
          return null;
        }
      }

      if (target && target.nodeType === 1) return target;

      return fallbackSelector
        ? document.querySelector(fallbackSelector)
        : null;
    }
  };

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;

    if (options.body != null && !isFormData &&
        !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token =
      window.MedOrbitsAuth?.getToken?.() ||
      window.MedOrbitsAuth?.getAccessToken?.();

    if (token) headers.set("Authorization", `Bearer ${token}`);

    const fetchOptions = { ...options, headers };
    delete fetchOptions.responseType;

    if (isFormData) headers.delete("Content-Type");

    if (!fetchOptions.credentials) {
      fetchOptions.credentials = "same-origin";
    }

    const response = await fetch(
      `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
      fetchOptions
    );

    const contentType = response.headers.get("content-type") || "";
    let data = null;

    if (options.responseType === "blob" && response.ok) {
      data = await response.blob();
    } else if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => "");
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status}).`
      );

      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function normalizeConversation(item = {}) {
    return {
      ...item,
      id: String(
        item.id || item._id || item.conversationId || ""
      ),
      subject: String(item.subject || item.title || "Conversation"),
      participants: Array.isArray(item.participants) ? item.participants : [],
      lastMessage: item.lastMessage || item.last_message || null,
      unreadCount: Math.max(0, Number(
        item.unreadCount ?? item.unread_count ?? 0
      ) || 0),
      updatedAt:
        item.updatedAt ||
        item.updated_at ||
        item.lastMessageAt ||
        item.createdAt ||
        null,
      status: item.status || "active",
      metadata: item.metadata || {}
    };
  }

  function normalizeMessage(item = {}) {
    return {
      ...item,
      id: String(item.id || item._id || item.messageId || ""),
      conversationId: String(
        item.conversationId ||
        item.conversation_id ||
        item.threadId ||
        ""
      ),
      senderId: String(
        item.senderId ||
        item.sender_id ||
        item.sender?.id ||
        item.userId ||
        ""
      ),
      senderName: String(
        item.senderName ||
        item.sender?.name ||
        item.user?.name ||
        "User"
      ),
      body: String(item.body ?? item.content ?? item.text ?? ""),
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      createdAt:
        item.createdAt || item.created_at || item.timestamp || null,
      readAt: item.readAt || item.read_at || null,
      editedAt: item.editedAt || item.edited_at || null,
      deleted: Boolean(item.deleted || item.isDeleted),
      status: item.status || "sent"
    };
  }

  function normalizeList(response) {
    if (Array.isArray(response)) return response;

    const data = response?.data;

    if (Array.isArray(data)) return data;

    return (
      data?.items ||
      data?.conversations ||
      data?.messages ||
      response?.items ||
      response?.conversations ||
      response?.messages ||
      []
    );
  }

  function getConversation(id) {
    return state.conversations.find(
      (item) => item.id === String(id)
    ) || null;
  }

  function getMessage(id) {
    return state.messages.find(
      (item) => item.id === String(id)
    ) || null;
  }

  function emitUpdate() {
    updateUnreadCount();

    utils.dispatch("updated", {
      conversations: state.conversations.slice(),
      activeConversation: state.activeConversation,
      messages: state.messages.slice(),
      unreadCount: state.unreadCount
    });
  }

  function updateUnreadCount() {
    state.unreadCount = state.conversations.reduce(
      (total, item) => total + item.unreadCount,
      0
    );

    document.querySelectorAll("[data-message-unread-count]").forEach((el) => {
      el.textContent = String(state.unreadCount);
      el.hidden = state.unreadCount <= 0;
    });

    document.querySelectorAll("[data-message-unread-badge]").forEach((el) => {
      el.textContent = state.unreadCount > 99
        ? "99+"
        : String(state.unreadCount);

      el.hidden = state.unreadCount <= 0;
    });
  }

  async function loadConversations(options = {}) {
    const query = new URLSearchParams();

    if (options.search) query.set("search", String(options.search));
    if (options.status) query.set("status", String(options.status));

    const page = Number(options.page);
    if (Number.isInteger(page) && page > 0) {
      query.set("page", String(page));
    }

    const suffix = query.toString();
    state.loading = true;
    utils.dispatch("loading", { loading: true });

    try {
      const response = await request(
        `/messages/conversations${suffix ? `?${suffix}` : ""}`
      );

      state.conversations = normalizeList(response)
        .map(normalizeConversation)
        .filter((item) => item.id)
        .sort((a, b) => {
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        });

      state.page = Number(options.page) > 0 ? Number(options.page) : 1;

      if (state.activeConversation) {
        state.activeConversation =
          getConversation(state.activeConversation.id) ||
          state.activeConversation;
      }

      utils.updateCache("conversations", state.conversations);
      updateUnreadCount();
      renderConversations(options.container);
      emitUpdate();

      utils.dispatch("conversations-loaded", {
        conversations: state.conversations.slice()
      });

      return state.conversations.slice();
    } catch (error) {
      utils.notify(error.message || "Unable to load messages.", "error");
      utils.dispatch("error", { error, action: "load-conversations" });
      throw error;
    } finally {
      state.loading = false;
      utils.dispatch("loading", { loading: false });
    }
  }

  async function loadMessages(conversationId, options = {}) {
    if (!utils.isValidId(conversationId)) {
      throw new Error("A valid conversation ID is required.");
    }

    const id = String(conversationId);
    const page = Number(options.page);
    const limit = Number(options.limit);

    const query = new URLSearchParams({
      page: String(Number.isInteger(page) && page > 0 ? page : 1),
      limit: String(
        Number.isInteger(limit) && limit > 0
          ? Math.min(limit, 100)
          : state.pageSize
      )
    });

    if (options.before) query.set("before", String(options.before));
    if (options.after) query.set("after", String(options.after));

    state.loading = true;
    state.activeConversation = getConversation(id);
    utils.dispatch("loading", { loading: true });

    try {
      const response = await request(
        `/messages/conversations/${encodeURIComponent(id)}/messages?${query}`
      );

      const incoming = normalizeList(response)
        .map(normalizeMessage)
        .filter((item) => item.id);

      if (options.append) {
        const known = new Set(state.messages.map((item) => item.id));

        state.messages = [
          ...incoming.filter((item) => !known.has(item.id)),
          ...state.messages
        ];
      } else {
        state.messages = incoming;
      }

      state.messages.sort((a, b) => {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });

      state.page = Number(options.page) > 0 ? Number(options.page) : 1;

      renderMessages(options.container);
      emitUpdate();

      utils.dispatch("messages-loaded", {
        conversationId: id,
        messages: state.messages.slice()
      });

      if (options.markRead !== false) {
        markConversationRead(id).catch(() => {});
      }

      return state.messages.slice();
    } catch (error) {
      utils.notify(error.message || "Unable to load conversation.", "error");
      utils.dispatch("error", { error, action: "load-messages" });
      throw error;
    } finally {
      state.loading = false;
      utils.dispatch("loading", { loading: false });
    }
  }

  async function sendMessage(conversationId, body, options = {}) {
    const id = String(conversationId || "");
    const text = String(body ?? "").trim();
    const attachments = Array.isArray(options.attachments)
      ? options.attachments
      : [];

    if (!id) throw new Error("A conversation is required.");

    if (!text && !attachments.length) {
      throw new Error("Enter a message or attach a file.");
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Messages cannot exceed 10,000 characters.");
    }

    if (state.sending) {
      throw new Error("A message is already being sent.");
    }

    state.sending = true;
    utils.dispatch("sending", { sending: true });

    try {
      const response = await request(
        `/messages/conversations/${encodeURIComponent(id)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: text,
            attachments,
            replyTo: options.replyTo || null
          })
        }
      );

      const raw = response?.data?.message ||
        response?.message ||
        response?.data ||
        response;

      const message = normalizeMessage(raw);

      if (message.id && !getMessage(message.id)) {
        state.messages.push(message);
        state.messages.sort((a, b) => {
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        });
      }

      const conversation = getConversation(id);

      if (conversation) {
        conversation.lastMessage = message;
        conversation.updatedAt = message.createdAt || new Date().toISOString();
      }

      renderMessages(options.container);
      renderConversations(options.conversationContainer);
      emitUpdate();

      utils.dispatch("message-sent", {
        conversationId: id,
        message
      });

      return message;
    } catch (error) {
      utils.notify(error.message || "Message could not be sent.", "error");
      utils.dispatch("error", { error, action: "send-message" });
      throw error;
    } finally {
      state.sending = false;
      utils.dispatch("sending", { sending: false });
    }
  }

  async function createConversation(payload = {}) {
    const recipientIds = Array.isArray(payload.recipientIds)
      ? payload.recipientIds.filter(utils.isValidId).map(String)
      : utils.isValidId(payload.recipientId)
        ? [String(payload.recipientId)]
        : [];

    if (!recipientIds.length) {
      throw new Error("Select at least one recipient.");
    }

    const response = await request("/messages/conversations", {
      method: "POST",
      body: JSON.stringify({
        subject: String(payload.subject || "").trim(),
        recipientIds,
        initialMessage: String(payload.initialMessage || "").trim(),
        metadata: payload.metadata || {}
      })
    });

    const raw = response?.data?.conversation ||
      response?.conversation ||
      response?.data ||
      response;

    const conversation = normalizeConversation(raw);

    if (conversation.id) {
      state.conversations = [
        conversation,
        ...state.conversations.filter((item) => item.id !== conversation.id)
      ];

      updateUnreadCount();
      renderConversations(payload.container);
      utils.dispatch("conversation-created", { conversation });
    }

    return conversation;
  }

  async function markConversationRead(conversationId) {
    const id = String(conversationId || "");

    if (!id) throw new Error("A conversation ID is required.");
    if (pendingRead.has(id)) return false;

    pendingRead.add(id);

    try {
      const response = await request(
        `/messages/conversations/${encodeURIComponent(id)}/read`,
        { method: "POST", body: JSON.stringify({}) }
      );

      const conversation = getConversation(id);
      if (conversation) conversation.unreadCount = 0;

      state.messages = state.messages.map((message) => {
        if (message.conversationId !== id) return message;

        return {
          ...message,
          readAt: message.readAt || new Date().toISOString()
        };
      });

      updateUnreadCount();
      renderConversations();
      emitUpdate();

      utils.dispatch("conversation-read", {
        conversationId: id,
        response
      });

      return true;
    } finally {
      pendingRead.delete(id);
    }
  }

  async function markMessageRead(messageId) {
    const id = String(messageId || "");

    if (!id) throw new Error("A message ID is required.");

    await request(`/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: JSON.stringify({})
    });

    const message = getMessage(id);
    if (message) message.readAt = new Date().toISOString();

    utils.dispatch("message-read", { messageId: id });
    return true;
  }

  async function deleteMessage(messageId) {
    const id = String(messageId || "");
    if (!id) throw new Error("A message ID is required.");

    const message = getMessage(id);

    await request(`/messages/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    state.messages = state.messages.filter((item) => item.id !== id);

    renderMessages();
    emitUpdate();

    utils.dispatch("message-deleted", {
      messageId: id,
      conversationId: message?.conversationId || ""
    });

    return true;
  }

  async function deleteConversation(conversationId) {
    const id = String(conversationId || "");
    if (!id) throw new Error("A conversation ID is required.");

    await request(
      `/messages/conversations/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    state.conversations = state.conversations.filter(
      (item) => item.id !== id
    );

    if (state.activeConversation?.id === id) {
      state.activeConversation = null;
      state.messages = [];
      renderMessages();
    }

    updateUnreadCount();
    renderConversations();
    emitUpdate();

    utils.dispatch("conversation-deleted", { conversationId: id });
    return true;
  }

  async function uploadAttachment(file) {
    if (typeof File === "undefined" || !(file instanceof File)) {
      throw new Error("Select a valid file.");
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error("Attachments must be 10 MB or smaller.");
    }

    if (
      !file.type ||
      !ALLOWED_ATTACHMENT_TYPES.includes(file.type)
    ) {
      throw new Error("This file type is not supported.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await request("/messages/attachments", {
      method: "POST",
      body: formData
    });

    const attachment = response?.data?.attachment ||
      response?.attachment ||
      response?.data ||
      response;

    utils.dispatch("attachment-uploaded", { attachment });
    return attachment;
  }

  async function downloadAttachment(attachmentId, filename) {
    const id = String(attachmentId || "");
    if (!id) throw new Error("An attachment ID is required.");

    const blob = await request(
      `/messages/attachments/${encodeURIComponent(id)}/download`,
      { method: "GET", responseType: "blob" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename || "attachment";
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function searchMessages(query, options = {}) {
    const term = String(query || "").trim();
    if (!term) return [];

    const params = new URLSearchParams({ q: term });

    if (options.conversationId) {
      params.set("conversationId", String(options.conversationId));
    }

    if (Number(options.limit) > 0) {
      params.set("limit", String(Math.min(Number(options.limit), 100)));
    }

    const response = await request(`/messages/search?${params}`);
    const results = normalizeList(response).map(normalizeMessage);

    utils.dispatch("search-results", { query: term, results });
    return results;
  }

  function renderConversations(target) {
    const elements = target
      ? [utils.resolveElement(target)]
      : Array.from(document.querySelectorAll("[data-messages-list]"));

    elements.filter(Boolean).forEach((container) => {
      if (!state.conversations.length) {
        container.replaceChildren();

        const empty = document.createElement("div");
        empty.className = "mo-messages-empty";
        empty.setAttribute("role", "status");
        empty.textContent = "No conversations found.";
        container.appendChild(empty);
        return;
      }

      container.innerHTML = state.conversations.map((conversation) => {
        const last = conversation.lastMessage;
        const preview = last
          ? (last.body || last.content || "Attachment")
          : "No messages yet";

        const active = state.activeConversation?.id === conversation.id;
        const unread = conversation.unreadCount;

        return `
          <button type="button"
            class="mo-conversation-item${active ? " is-active" : ""}"
            data-message-conversation="${utils.escapeHTML(conversation.id)}"
            aria-current="${active ? "true" : "false"}">
            <span class="mo-conversation-avatar" aria-hidden="true">${utils.escapeHTML(utils.initials(conversation.subject))}</span>
            <span class="mo-conversation-content">
              <span class="mo-conversation-title">${utils.escapeHTML(conversation.subject)}</span>
              <span class="mo-conversation-preview">${utils.escapeHTML(preview)}</span>
            </span>
            <span class="mo-conversation-meta">
              <time>${utils.escapeHTML(utils.formatTime(conversation.updatedAt))}</time>
              ${unread > 0
                ? `<span class="mo-message-unread" aria-label="${unread} unread messages">${unread > 99 ? "99+" : unread}</span>`
                : ""}
            </span>
          </button>
        `;
      }).join("");
    });
  }

  function renderMessages(target) {
    const elements = target
      ? [utils.resolveElement(target)]
      : Array.from(document.querySelectorAll("[data-messages-thread]"));

    elements.filter(Boolean).forEach((container) => {
      if (!state.activeConversation || !state.messages.length) {
        container.replaceChildren();

        const empty = document.createElement("div");
        empty.className = "mo-messages-empty";
        empty.setAttribute("role", "status");
        empty.textContent = state.activeConversation
          ? "No messages yet. Start the conversation."
          : "Select a conversation to view messages.";

        container.appendChild(empty);
        return;
      }

      const currentUserId = utils.currentUserId();

      container.innerHTML = state.messages.map((message) => {
        const own = Boolean(
          currentUserId && message.senderId === currentUserId
        );

        const body = message.deleted
          ? "This message was deleted."
          : message.body;

        const attachments = message.attachments.map((attachment) => {
          const id = attachment.id ||
            attachment._id ||
            attachment.attachmentId ||
            "";

          const filename = attachment.name ||
            attachment.filename ||
            "Attachment";

          if (!id) {
            return `<span class="mo-message-attachment">${utils.escapeHTML(filename)}</span>`;
          }

          return `
            <button type="button" class="mo-message-attachment"
              data-message-download="${utils.escapeHTML(id)}"
              data-message-filename="${utils.escapeHTML(filename)}">
              <span aria-hidden="true">📎</span>
              <span>${utils.escapeHTML(filename)}</span>
              <small>${utils.escapeHTML(utils.formatFileSize(attachment.size))}</small>
            </button>
          `;
        }).join("");

        return `
          <article class="mo-message${own ? " mo-message-own" : ""}"
            data-message-id="${utils.escapeHTML(message.id)}">
            <div class="mo-message-bubble">
              ${!own ? `<div class="mo-message-sender">${utils.escapeHTML(message.senderName)}</div>` : ""}
              <div class="mo-message-body">${utils.escapeHTML(body).replace(/\n/g, "<br>")}</div>
              ${attachments ? `<div class="mo-message-attachments">${attachments}</div>` : ""}
              <div class="mo-message-footer">
                <time datetime="${utils.escapeHTML(message.createdAt || "")}">${utils.escapeHTML(utils.formatTime(message.createdAt))}</time>
                ${message.editedAt ? "<span>Edited</span>" : ""}
                ${own ? `<span>${utils.escapeHTML(message.status)}</span>` : ""}
              </div>
            </div>
          </article>
        `;
      }).join("");

      container.scrollTop = container.scrollHeight;
    });
  }

  function bindForms() {
    document.querySelectorAll("[data-message-compose]").forEach((form) => {
      if (boundForms.has(form)) return;
      boundForms.add(form);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const conversationId =
          form.dataset.conversationId ||
          state.activeConversation?.id;

        const textarea = form.querySelector(
          "[name='message'], [name='body'], textarea"
        );

        const fileInput = form.querySelector(
          "input[type='file'][name='attachments'], input[type='file'][name='attachment']"
        );

        const submit = form.querySelector(
          "button[type='submit'], input[type='submit']"
        );

        if (!conversationId) {
          utils.notify("Select a conversation first.", "warning");
          return;
        }

        if (submit) submit.disabled = true;

        try {
          const attachments = [];

          for (const file of Array.from(fileInput?.files || [])) {
            attachments.push(await uploadAttachment(file));
          }

          await sendMessage(conversationId, textarea?.value || "", {
            attachments,
            container: form.dataset.threadTarget || undefined,
            conversationContainer: form.dataset.listTarget || undefined
          });

          if (textarea) textarea.value = "";
          if (fileInput) fileInput.value = "";

          form.dispatchEvent(new CustomEvent("messages:sent", {
            bubbles: true
          }));
        } catch (error) {
          utils.notify(error.message || "Unable to send message.", "error");
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    });
  }

  function bindConversationClicks() {
    document.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest("[data-message-conversation]");

      if (button) {
        const id = button.dataset.messageConversation;

        state.activeConversation = getConversation(id);
        state.messages = [];
        renderConversations();
        renderMessages();

        try {
          await loadMessages(id);
        } catch {
          // loadMessages reports request errors.
        }

        return;
      }

      const download = event.target.closest("[data-message-download]");

      if (download) {
        try {
          await downloadAttachment(
            download.dataset.messageDownload,
            download.dataset.messageFilename
          );
        } catch (error) {
          utils.notify(error.message || "Download failed.", "error");
        }

        return;
      }

      const deleteButton = event.target.closest("[data-message-delete]");

      if (deleteButton) {
        if (!window.confirm("Delete this message?")) return;

        try {
          await deleteMessage(deleteButton.dataset.messageDelete);
          utils.notify("Message deleted.", "success");
        } catch (error) {
          utils.notify(error.message || "Unable to delete message.", "error");
        }

        return;
      }

      const deleteThread = event.target.closest("[data-conversation-delete]");

      if (deleteThread) {
        if (!window.confirm("Delete this conversation?")) return;

        try {
          await deleteConversation(deleteThread.dataset.conversationDelete);
          utils.notify("Conversation deleted.", "success");
        } catch (error) {
          utils.notify(error.message || "Unable to delete conversation.", "error");
        }
      }
    });
  }

  function bindSearch() {
    document.querySelectorAll("[data-message-search]").forEach((input) => {
      if (boundSearchInputs.has(input)) return;
      boundSearchInputs.add(input);

      let timer = null;
      let controller = null;

      input.addEventListener("input", () => {
        window.clearTimeout(timer);

        timer = window.setTimeout(async () => {
          const query = input.value.trim();

          if (!query) {
            renderConversations(input.dataset.target || undefined);
            return;
          }

          try {
            const results = await searchMessages(query, {
              conversationId: input.dataset.conversationId || undefined
            });

            if (input.value.trim() !== query) return;

            const container = utils.resolveElement(
              input.dataset.resultsTarget,
              "[data-message-search-results]"
            );

            if (!container) return;

            container.innerHTML = results.length
              ? results.map((message) => `
                  <button type="button" class="mo-message-search-result"
                    data-message-search-result="${utils.escapeHTML(message.conversationId)}">
                    <strong>${utils.escapeHTML(message.senderName)}</strong>
                    <span>${utils.escapeHTML(message.body)}</span>
                    <time>${utils.escapeHTML(utils.formatDate(message.createdAt))}</time>
                  </button>
                `).join("")
              : '<div class="mo-messages-empty" role="status">No matching messages.</div>';
          } catch (error) {
            utils.notify(error.message || "Message search failed.", "error");
          }
        }, 300);
      });
    });
  }

  function bindSearchResults() {
    document.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;

      const result = event.target.closest("[data-message-search-result]");
      if (!result) return;

      const id = result.dataset.messageSearchResult;
      if (!id) return;

      try {
        if (!getConversation(id)) await loadConversations();

        state.activeConversation = getConversation(id);
        state.messages = [];
        renderConversations();
        renderMessages();

        await loadMessages(id);
      } catch {
        // Errors are handled by the request methods.
      }
    });
  }

  function bindRefreshControls() {
    document.querySelectorAll("[data-messages-refresh]").forEach((button) => {
      if (boundRefreshButtons.has(button)) return;
      boundRefreshButtons.add(button);

      button.addEventListener("click", async () => {
        try {
          await loadConversations();

          if (state.activeConversation) {
            await loadMessages(state.activeConversation.id, {
              markRead: false
            });
          }
        } catch {
          // Request methods report failures.
        }
      });
    });
  }

  function startPolling(interval) {
    stopPolling();

    const delay = Math.max(
      POLLING_MIN_INTERVAL,
      Number(interval) || 30000
    );

    state.pollingTimer = window.setInterval(async () => {
      if (document.hidden || state.loading || state.sending) return;

      try {
        await loadConversations();

        if (state.activeConversation) {
          await loadMessages(state.activeConversation.id, {
            markRead: false
          });
        }
      } catch {
        // Polling failures should not interrupt the application.
      }
    }, delay);
  }

  function stopPolling() {
    if (state.pollingTimer) {
      window.clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }
  }

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("A callback function is required.");
    }

    const event = `medorbits:messages:${eventName}`;
    document.addEventListener(event, callback);

    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);

    return () => off(eventName, callback);
  }

  function off(eventName, callback) {
    const event = `medorbits:messages:${eventName}`;
    const callbacks = listeners.get(event);

    if (!callbacks) return;

    if (callback) {
      document.removeEventListener(event, callback);
      callbacks.delete(callback);
    } else {
      callbacks.forEach((listener) => {
        document.removeEventListener(event, listener);
      });

      callbacks.clear();
    }

    if (!callbacks.size) listeners.delete(event);
  }

  async function init(options = {}) {
    if (state.initialized && !options.force) return api;

    state.destroyed = false;

    bindForms();
    bindConversationClicks();
    bindSearch();
    bindSearchResults();
    bindRefreshControls();

    try {
      await loadConversations(options);
    } catch {
      // The module remains available if the API is temporarily offline.
    }

    if (options.polling) {
      startPolling(options.pollingInterval);
    }

    state.initialized = true;
    utils.dispatch("initialized", { unreadCount: state.unreadCount });

    return api;
  }

  function destroy() {
    stopPolling();
    state.initialized = false;
    state.destroyed = true;

    listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        document.removeEventListener(event, callback);
      });
    });

    listeners.clear();
  }

  const api = Object.freeze({
    init,
    destroy,
    on,
    off,

    loadConversations,
    loadMessages,
    createConversation,
    sendMessage,

    markConversationRead,
    markMessageRead,
    deleteMessage,
    deleteConversation,

    uploadAttachment,
    downloadAttachment,
    searchMessages,

    renderConversations,
    renderMessages,

    startPolling,
    stopPolling,

    getConversations: () => state.conversations.slice(),
    getMessages: () => state.messages.slice(),
    getActiveConversation: () => state.activeConversation,
    getUnreadCount: () => state.unreadCount,

    getState: () => ({
      conversations: state.conversations.slice(),
      activeConversation: state.activeConversation,
      messages: state.messages.slice(),
      unreadCount: state.unreadCount,
      loading: state.loading,
      sending: state.sending,
      initialized: state.initialized
    }),

    constants: Object.freeze({
      DEFAULT_PAGE_SIZE,
      MAX_ATTACHMENT_SIZE,
      MAX_MESSAGE_LENGTH,
      ALLOWED_ATTACHMENT_TYPES
    })
  });

  window.MedOrbitsMessages = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Messages = api;

  function autoInit() {
    if (document.querySelector(
      "[data-messages-list], [data-messages-thread], [data-message-compose]"
    )) {
      init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

})(window, document);
