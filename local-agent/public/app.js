
'use strict';

/**
 * MedOrbits Local Agent -- Browser Application
 * File: /local-agent/public/app.js
 * Version: 1.0.0
 *
 * Browser-side dashboard controller.
 *
 * Expected optional API endpoints:
 *   GET  /api/agent/status
 *   GET  /api/agent/tasks
 *   GET  /api/agent/config
 *   POST /api/agent/tasks
 *   POST /api/agent/audit
 *   POST /api/agent/check
 *   POST /api/agent/cancel
 *
 * Security:
 * - No arbitrary shell or JavaScript execution.
 * - No secrets stored in localStorage.
 * - All API calls use same-origin URLs.
 * - Dynamic content is rendered as text, never as HTML.
 * - Destructive actions are not exposed by this dashboard.
 */

(() => {
  const APP_VERSION = '1.0.0';

  const CONFIG = Object.freeze({
    apiBase: '/api/agent',
    requestTimeoutMs: 20_000,
    refreshIntervalMs: 15_000,
    maxLogEntries: 200,
    maxInputLength: 4000
  });

  const state = {
    initialized: false,
    busy: false,
    stopped: false,
    refreshTimer: null,
    controller: null,
    status: null,
    tasks: [],
    logs: [],
    activeView: 'overview'
  };

  const selectors = {
    status: '[data-agent-status]',
    statusText: '[data-agent-status-text]',
    taskList: '[data-task-list]',
    logList: '[data-log-list]',
    refreshButton: '[data-action="refresh"]',
    auditButton: '[data-action="audit"]',
    checkButton: '[data-action="check"]',
    cancelButton: '[data-action="cancel"]',
    taskForm: '[data-task-form]',
    taskInput: '[name="task"]',
    message: '[data-app-message]',
    loading: '[data-loading]',
    version: '[data-app-version]',
    navLinks: '[data-view]'
  };

  class AppError extends Error {
    constructor(message, code = 'APP_ERROR', status = 0) {
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.status = status;
    }
  }

  function query(selector, root = document) {
    return root.querySelector(selector);
  }

  function queryAll(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setText(element, value) {
    if (!element) return;
    element.textContent = value == null ? '' : String(value);
  }

  function addLog(message, level = 'info') {
    const entry = {
      id: createId(),
      timestamp: new Date().toISOString(),
      level,
      message: String(message).slice(0, 1000)
    };

    state.logs.unshift(entry);
    state.logs.length = Math.min(state.logs.length, CONFIG.maxLogEntries);

    renderLogs();
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function formatTime(value) {
    if (!value) return '--';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '--';

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function showMessage(message, type = 'info') {
    const element = query(selectors.message);

    if (element) {
      setText(element, message);
      element.dataset.type = type;
      element.hidden = false;
      element.setAttribute('role', type === 'error' ? 'alert' : 'status');
    }

    if (type === 'error') {
      addLog(message, 'error');
    }
  }

  function clearMessage() {
    const element = query(selectors.message);

    if (element) {
      setText(element, '');
      element.hidden = true;
      delete element.dataset.type;
    }
  }

  function setBusy(busy) {
    state.busy = Boolean(busy);

    queryAll('button[data-action], button[type="submit"]').forEach((button) => {
      if (button.dataset.allowWhileBusy === 'true') return;
      button.disabled = state.busy;
    });

    const loading = query(selectors.loading);

    if (loading) {
      loading.hidden = !state.busy;
      loading.setAttribute('aria-hidden', String(!state.busy));
    }

    document.documentElement.dataset.busy = String(state.busy);
  }

  function normalizeApiPath(endpoint) {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) {
      throw new AppError('Invalid API endpoint.', 'INVALID_ENDPOINT');
    }

    if (endpoint.startsWith('//') || endpoint.includes('\\')) {
      throw new AppError('Unsafe API endpoint.', 'INVALID_ENDPOINT');
    }

    const url = new URL(endpoint, window.location.origin);

    if (url.origin !== window.location.origin) {
      throw new AppError('Cross-origin API requests are not allowed.', 'INVALID_ENDPOINT');
    }

    return `${url.pathname}${url.search}`;
  }

  async function request(endpoint, options = {}) {
    const url = normalizeApiPath(endpoint);
    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(new Error('Request timed out.')),
      CONFIG.requestTimeoutMs
    );

    const externalSignal = options.signal;
    let abortListener;

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        abortListener = () => controller.abort(externalSignal.reason);
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    let body;

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'same-origin',
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';

      let payload = null;

      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();

        if (text) {
          payload = { message: text.slice(0, 500) };
        }
      }

      if (!response.ok) {
        const message = payload && typeof payload.message === 'string'
          ? payload.message
          : `Request failed with HTTP ${response.status}.`;

        throw new AppError(
          message.slice(0, 500),
          'HTTP_ERROR',
          response.status
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (controller.signal.aborted) {
        throw new AppError(
          'Request was cancelled or timed out.',
          'REQUEST_ABORTED'
        );
      }

      throw new AppError(
        'Unable to contact the local-agent service.',
        'NETWORK_ERROR'
      );
    } finally {
      window.clearTimeout(timeout);

      if (externalSignal && abortListener) {
        externalSignal.removeEventListener('abort', abortListener);
      }
    }
  }

  function getStatusLabel(status) {
    const normalized = String(status || 'unknown').toLowerCase();

    const labels = {
      ready: 'Ready',
      running: 'Running',
      idle: 'Idle',
      stopped: 'Stopped',
      degraded: 'Degraded',
      error: 'Error',
      unknown: 'Unknown'
    };

    return labels[normalized] || normalized.slice(0, 40);
  }

  function renderStatus(status) {
    state.status = status && typeof status === 'object' ? status : {};

    const statusElement = query(selectors.status);
    const textElement = query(selectors.statusText);

    const value = state.status.status ||
      (state.status.running ? 'running' : 'ready');

    const label = getStatusLabel(value);

    if (statusElement) {
      statusElement.dataset.state = String(value).toLowerCase();
      statusElement.setAttribute('aria-label', `Agent status: ${label}`);
    }

    setText(textElement, label);

    const mappings = {
      '[data-agent-version]': state.status.version || APP_VERSION,
      '[data-agent-active-tasks]': state.status.activeTasks ?? 0,
      '[data-agent-completed-tasks]': state.status.completedTasks ?? 0,
      '[data-agent-mode]': state.status.readOnly === false ? 'Configured' : 'Read-only',
      '[data-agent-last-updated]': formatTime(state.status.updatedAt)
    };

    for (const [selector, content] of Object.entries(mappings)) {
      setText(query(selector), content);
    }
  }

  function normalizeTask(task) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      return null;
    }

    return {
      id: String(task.id || task.taskId || createId()).slice(0, 128),
      name: String(task.name || task.title || task.type || 'Untitled task').slice(0, 200),
      type: String(task.type || 'unknown').slice(0, 80),
      status: String(task.status || 'unknown').slice(0, 40).toLowerCase(),
      createdAt: task.createdAt || task.startedAt || null,
      completedAt: task.completedAt || null,
      message: typeof task.message === 'string'
        ? task.message.slice(0, 500)
        : ''
    };
  }

  function createCell(text, className) {
    const cell = document.createElement('span');
    cell.textContent = text;

    if (className) cell.className = className;

    return cell;
  }

  function renderTasks() {
    const container = query(selectors.taskList);

    if (!container) return;

    container.replaceChildren();

    if (state.tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No tasks available.';
      container.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const task of state.tasks) {
      const item = document.createElement('article');
      item.className = 'task-item';
      item.dataset.taskId = task.id;

      const heading = document.createElement('div');
      heading.className = 'task-item__heading';
      heading.appendChild(createCell(task.name, 'task-item__name'));
      heading.appendChild(createCell(task.status, `task-status task-status--${safeClass(task.status)}`));

      const details = document.createElement('div');
      details.className = 'task-item__details';
      details.appendChild(createCell(`Type: ${task.type}`));
      details.appendChild(createCell(`Created: ${formatTime(task.createdAt)}`));

      item.append(heading, details);

      if (task.message) {
        const message = document.createElement('p');
        message.className = 'task-item__message';
        message.textContent = task.message;
        item.appendChild(message);
      }

      fragment.appendChild(item);
    }

    container.appendChild(fragment);
  }

  function safeClass(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40) || 'unknown';
  }

  function renderLogs() {
    const container = query(selectors.logList);

    if (!container) return;

    container.replaceChildren();

    if (state.logs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No local activity recorded in this session.';
      container.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const entry of state.logs) {
      const item = document.createElement('article');
      item.className = `log-item log-item--${safeClass(entry.level)}`;

      const timestamp = document.createElement('time');
      timestamp.dateTime = entry.timestamp;
      timestamp.textContent = formatTime(entry.timestamp);

      const message = document.createElement('span');
      message.textContent = entry.message;

      item.append(timestamp, message);
      fragment.appendChild(item);
    }

    container.appendChild(fragment);
  }

  async function loadStatus() {
    const payload = await request(`${CONFIG.apiBase}/status`);

    renderStatus(payload && (payload.status || payload.agent || payload));
    return payload;
  }

  async function loadTasks() {
    const payload = await request(`${CONFIG.apiBase}/tasks`);

    const rawTasks = Array.isArray(payload)
      ? payload
      : Array.isArray(payload && payload.tasks)
        ? payload.tasks
        : [];

    state.tasks = rawTasks
      .map(normalizeTask)
      .filter(Boolean)
      .slice(0, 500);

    renderTasks();

    return state.tasks;
  }

  async function refresh(options = {}) {
    if (state.busy && !options.force) return;

    try {
      const results = await Promise.allSettled([
        loadStatus(),
        loadTasks()
      ]);

      const failures = results.filter((result) => result.status === 'rejected');

      if (failures.length > 0) {
        const message = failures
          .map((result) => result.reason?.message || 'Refresh failed.')
          .join(' ');

        showMessage(message, 'error');
      } else {
        clearMessage();
      }

      return results;
    } catch (error) {
      showMessage(error.message || 'Refresh failed.', 'error');
      return null;
    }
  }

  async function submitTask(taskText) {
    const description = String(taskText || '').trim();

    if (!description) {
      showMessage('Enter a task description first.', 'error');
      return;
    }

    if (description.length > CONFIG.maxInputLength) {
      showMessage(
        `Task description must be ${CONFIG.maxInputLength} characters or fewer.`,
        'error'
      );
      return;
    }

    setBusy(true);
    clearMessage();

    try {
      const result = await request(`${CONFIG.apiBase}/tasks`, {
        method: 'POST',
        body: {
          description,
          mode: 'safe',
          readOnly: true
        }
      });

      addLog('Task submitted successfully.', 'success');
      showMessage('Task submitted.', 'success');

      const input = query(selectors.taskInput);
      if (input) input.value = '';

      await refresh({ force: true });

      return result;
    } catch (error) {
      showMessage(error.message || 'Unable to submit task.', 'error');
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function runAudit() {
    setBusy(true);
    clearMessage();

    try {
      const result = await request(`${CONFIG.apiBase}/audit`, {
        method: 'POST',
        body: { mode: 'safe', readOnly: true }
      });

      addLog('Repository audit requested.', 'success');
      showMessage('Audit completed or queued.', 'success');

      await refresh({ force: true });

      return result;
    } catch (error) {
      showMessage(error.message || 'Audit request failed.', 'error');
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function runCheck() {
    setBusy(true);
    clearMessage();

    try {
      const result = await request(`${CONFIG.apiBase}/check`, {
        method: 'POST',
        body: { mode: 'safe', readOnly: true }
      });

      addLog('Repository health check requested.', 'success');
      showMessage('Health check completed or queued.', 'success');

      await refresh({ force: true });

      return result;
    } catch (error) {
      showMessage(error.message || 'Health check request failed.', 'error');
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function cancelTasks() {
    if (state.stopped) return;

    const confirmed = window.confirm(
      'Request cancellation of active agent tasks? Completed work will not be rolled back.'
    );

    if (!confirmed) return;

    state.stopped = true;
    setBusy(true);

    try {
      await request(`${CONFIG.apiBase}/cancel`, {
        method: 'POST',
        body: { reason: 'Requested from local-agent dashboard.' }
      });

      addLog('Cancellation requested.', 'warn');
      showMessage('Cancellation requested. Check task status for confirmation.', 'info');
    } catch (error) {
      state.stopped = false;
      showMessage(error.message || 'Cancellation request failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function showView(viewName) {
    const name = String(viewName || '').trim();

    if (!/^[a-z0-9_-]{1,50}$/i.test(name)) return;

    state.activeView = name;

    queryAll('[data-panel]').forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', String(!active));
    });

    queryAll(selectors.navLinks).forEach((link) => {
      const active = link.dataset.view === name;
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function bindEvents() {
    const refreshButton = query(selectors.refreshButton);
    const auditButton = query(selectors.auditButton);
    const checkButton = query(selectors.checkButton);
    const cancelButton = query(selectors.cancelButton);
    const taskForm = query(selectors.taskForm);

    refreshButton?.addEventListener('click', () => {
      refresh({ force: true }).catch(() => {});
    });

    auditButton?.addEventListener('click', () => {
      runAudit().catch(() => {});
    });

    checkButton?.addEventListener('click', () => {
      runCheck().catch(() => {});
    });

    cancelButton?.addEventListener('click', () => {
      cancelTasks().catch(() => {});
    });

    taskForm?.addEventListener('submit', (event) => {
      event.preventDefault();

      const input = query(selectors.taskInput, taskForm);

      submitTask(input?.value || '').catch(() => {});
    });

    queryAll(selectors.navLinks).forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showView(link.dataset.view);
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        startAutoRefresh();
        refresh().catch(() => {});
      }
    });

    window.addEventListener('beforeunload', () => {
      stopAutoRefresh();

      if (state.controller) {
        state.controller.abort();
      }
    });
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    if (document.hidden || state.stopped) return;

    state.refreshTimer = window.setInterval(() => {
      refresh().catch(() => {});
    }, CONFIG.refreshIntervalMs);
  }

  function stopAutoRefresh() {
    if (state.refreshTimer !== null) {
      window.clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  function initialize() {
    if (state.initialized) return;

    state.initialized = true;

    setText(query(selectors.version), APP_VERSION);

    bindEvents();
    renderTasks();
    renderLogs();

    refresh().catch(() => {});
    startAutoRefresh();

    addLog(`Dashboard initialized (${APP_VERSION}).`, 'info');
  }

  const api = Object.freeze({
    version: APP_VERSION,
    refresh,
    submitTask,
    runAudit,
    runCheck,
    cancelTasks,
    getState() {
      return {
        initialized: state.initialized,
        busy: state.busy,
        stopped: state.stopped,
        activeView: state.activeView,
        taskCount: state.tasks.length,
        logCount: state.logs.length
      };
    }
  });

  // Expose a small, read-only public interface for page integrations.
  Object.defineProperty(window, 'MedOrbitsAgentApp', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
