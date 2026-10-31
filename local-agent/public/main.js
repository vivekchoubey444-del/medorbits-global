
/**
 * ============================================================
 * MedOrbits Local Agent -- Dashboard Controller
 * File: /local_agent/public/main.js
 * Version: 2.0.0
 *
 * Responsibilities:
 *  - Robot dashboard interactions
 *  - Live task progress and metrics
 *  - Terminal event rendering
 *  - Backend SSE integration
 *  - Start / pause / resume / stop controls
 *  - Connection and offline status
 *  - Safe event validation
 *
 * Security:
 *  - No API secrets in frontend code
 *  - No arbitrary command execution
 *  - No HTML injection from backend events
 *  - Actual completion requires backend confirmation
 * ============================================================
 */

"use strict";

(() => {
  const CONFIG = Object.freeze({
    apiBase: window.MEDORBIT_AGENT_API_BASE || "/api/agent",
    eventEndpoint: "/events",
    reconnectDelay: 3000,
    maxReconnectDelay: 30000,
    maxTerminalLines: 150,
    requestTimeout: 15000,
    maxMessageLength: 2000
  });

  const TASKS = Object.freeze([
    {
      id: "scan",
      label: "Repository scanning",
      icon: "🔍"
    },
    {
      id: "analysis",
      label: "Code analysis",
      icon: "🧠"
    },
    {
      id: "planning",
      label: "Repair planning",
      icon: "🛠️"
    },
    {
      id: "generation",
      label: "Code generation",
      icon: "💻"
    },
    {
      id: "testing",
      label: "Testing and validation",
      icon: "🧪"
    },
    {
      id: "report",
      label: "Upgrade report",
      icon: "📦"
    }
  ]);

  const STATE = {
    connected: false,
    running: false,
    paused: false,
    stopped: false,
    currentTask: null,
    progress: 0,
    tasks: {},
    metrics: {
      files: 0,
      issues: 0,
      updated: 0,
      tests: 0
    },
    eventSource: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    activeController: null
  };

  const $ = (id) => document.getElementById(id);

  const ELEMENTS = {
    start: $("startBtn"),
    pause: $("pauseBtn"),
    stop: $("stopBtn"),
    workerState: $("workerState"),
    connection: $("connection"),
    activity: $("activity"),
    robotMessage: $("robotMessage"),
    robotDescription: $("robotDescription"),
    progressBar: $("progressBar"),
    progressText: $("progressText"),
    taskCount: $("taskCount"),
    terminal: $("terminal"),
    terminalStatus: $("terminalStatus"),
    statusDot: $("statusDot"),
    files: $("filesMetric"),
    issues: $("issuesMetric"),
    updated: $("updatedMetric"),
    tests: $("testsMetric")
  };

  function safeText(value, max = CONFIG.maxMessageLength) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .slice(0, max);
  }

  function setText(element, value) {
    if (element) {
      element.textContent = safeText(value);
    }
  }

  function log(message, type = "info") {
    if (!ELEMENTS.terminal) return;

    const allowedTypes = new Set([
      "info",
      "success",
      "warning",
      "error"
    ]);

    const line = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString();

    line.className = "log " +
      (allowedTypes.has(type) ? type : "info");

    line.textContent =
      `[${timestamp}] ${safeText(message)}`;

    ELEMENTS.terminal.appendChild(line);

    while (
      ELEMENTS.terminal.children.length >
      CONFIG.maxTerminalLines
    ) {
      ELEMENTS.terminal.removeChild(
        ELEMENTS.terminal.firstChild
      );
    }

    ELEMENTS.terminal.scrollTop =
      ELEMENTS.terminal.scrollHeight;
  }

  function setConnection(connected) {
    STATE.connected = Boolean(connected);

    setText(
      ELEMENTS.connection,
      connected ? "CONNECTED" : "OFFLINE"
    );

    setText(
      ELEMENTS.terminalStatus,
      connected ? "BACKEND CONNECTED" : "LOCAL / OFFLINE"
    );

    if (ELEMENTS.statusDot) {
      ELEMENTS.statusDot.style.background =
        connected ? "var(--green)" : "var(--gold)";
    }
  }

  function setWorkerState(state) {
    const normalized = String(state).toUpperCase();

    const allowed = [
      "IDLE",
      "WORKING",
      "PAUSED",
      "STOPPED",
      "ERROR"
    ];

    if (!allowed.includes(normalized)) return;

    setText(ELEMENTS.workerState, normalized);

    STATE.running = normalized === "WORKING";
    STATE.paused = normalized === "PAUSED";
    STATE.stopped = normalized === "STOPPED";
  }

  function setProgress(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return;

    STATE.progress = Math.max(
      0,
      Math.min(100, number)
    );

    if (ELEMENTS.progressBar) {
      ELEMENTS.progressBar.style.width =
        STATE.progress + "%";
    }

    setText(
      ELEMENTS.progressText,
      Math.round(STATE.progress) + "%"
    );
  }

  function setTaskState(taskId, status) {
    const taskIndex = TASKS.findIndex(
      task => task.id === taskId
    );

    if (taskIndex === -1) return;

    const normalized = String(status).toUpperCase();

    const allowed = [
      "WAITING",
      "ACTIVE",
      "DONE",
      "FAILED",
      "SKIPPED"
    ];

    if (!allowed.includes(normalized)) return;

    STATE.tasks[taskId] = normalized;

    const taskElement = document.querySelector(
      `[data-task="${taskIndex}"]`
    );

    if (!taskElement) return;

    taskElement.classList.remove(
      "active",
      "done",
      "failed"
    );

    if (normalized === "ACTIVE") {
      taskElement.classList.add("active");
    }

    if (normalized === "DONE") {
      taskElement.classList.add("done");
    }

    if (normalized === "FAILED") {
      taskElement.classList.add("failed");
    }

    const stateElement =
      taskElement.querySelector(".task-state");

    setText(stateElement, normalized);

    updateTaskCount();
  }

  function updateTaskCount() {
    const completed = TASKS.filter(
      task => STATE.tasks[task.id] === "DONE"
    ).length;

    setText(
      ELEMENTS.taskCount,
      `${completed} / ${TASKS.length}`
    );
  }

  function updateMetric(name, value) {
    const mapping = {
      files: ELEMENTS.files,
      issues: ELEMENTS.issues,
      updated: ELEMENTS.updated,
      tests: ELEMENTS.tests
    };

    const target = mapping[name];
    const number = Number(value);

    if (
      !target ||
      !Number.isSafeInteger(number) ||
      number < 0
    ) return;

    STATE.metrics[name] = number;
    setText(target, number.toLocaleString());
  }

  function setActivity(message, description) {
    setText(ELEMENTS.activity, message);

    if (description !== undefined) {
      setText(ELEMENTS.robotDescription, description);
    }
  }

  function setRobotMessage(message) {
    setText(ELEMENTS.robotMessage, message);
  }

  function resetTasks() {
    STATE.tasks = {};

    TASKS.forEach(task => {
      setTaskState(task.id, "WAITING");
    });

    setProgress(0);
  }

  function apiUrl(path) {
    const base = new URL(
      CONFIG.apiBase,
      window.location.origin
    );

    if (base.origin !== window.location.origin) {
      throw new Error(
        "Cross-origin API base is not permitted by this dashboard."
      );
    }

    return new URL(path.replace(/^\/+/, ""), base).toString();
  }

  async function apiRequest(path, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeout
    );

    try {
      const response = await fetch(apiUrl(path), {
        method: options.method || "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...(options.headers || {})
        },
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          `Agent API returned HTTP ${response.status}`
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("Expected JSON API response.");
      }

      return await response.json();

    } finally {
      clearTimeout(timeout);
    }
  }

  function validateEvent(event) {
    if (!event || typeof event !== "object") {
      return false;
    }

    if (typeof event.type !== "string") {
      return false;
    }

    return event.type.length <= 80;
  }

  function handleEvent(event) {
    if (!validateEvent(event)) return;

    switch (event.type) {
      case "agent.connected":
        setConnection(true);
        log("Backend event stream connected.", "success");
        break;

      case "agent.started":
        setWorkerState("WORKING");
        setActivity("Agent started working");
        setRobotMessage("Let's improve MedOrbits!");
        log("Repository operation started.", "success");
        break;

      case "agent.paused":
        setWorkerState("PAUSED");
        setActivity("Agent operation paused");
        log("Agent paused.", "warning");
        break;

      case "agent.resumed":
        setWorkerState("WORKING");
        setActivity("Agent resumed");
        log("Agent resumed.", "success");
        break;

      case "agent.stopped":
        setWorkerState("STOPPED");
        setActivity("Agent stopped");
        log("Agent stopped by request.", "warning");
        break;

      case "task.started":
        if (typeof event.task_id === "string") {
          STATE.currentTask = event.task_id;
          setTaskState(event.task_id, "ACTIVE");
        }

        setActivity(event.message || "Working on task");
        setRobotMessage(event.robot_message || "Working...");
        log(event.message || "Task started.", "info");
        break;

      case "task.completed":
        if (typeof event.task_id === "string") {
          setTaskState(event.task_id, "DONE");
        }

        log(event.message || "Task completed.", "success");
        break;

      case "task.failed":
        if (typeof event.task_id === "string") {
          setTaskState(event.task_id, "FAILED");
        }

        log(event.message || "Task failed.", "error");
        break;

      case "agent.progress":
        setProgress(event.progress);
        break;

      case "agent.metric":
        if (
          typeof event.name === "string" &&
          Object.prototype.hasOwnProperty.call(
            STATE.metrics,
            event.name
          )
        ) {
          updateMetric(event.name, event.value);
        }
        break;

      case "agent.log":
        log(event.message, event.level || "info");
        break;

      case "agent.completed":
        // Completion must be emitted by the backend only after
        // the actual requested work and verification have finished.
        setWorkerState("IDLE");
        setProgress(100);
        setActivity("Backend confirmed completion");
        setRobotMessage("Mission accomplished!");
        log(
          "Backend confirmed operation completion.",
          "success"
        );
        break;

      case "agent.error":
        setWorkerState("ERROR");
        setActivity("Agent encountered an error");
        log(event.message || "Unknown backend error.", "error");
        break;

      default:
        // Unknown event types are ignored.
        break;
    }
  }

  function disconnectEvents() {
    if (STATE.eventSource) {
      STATE.eventSource.close();
      STATE.eventSource = null;
    }
  }

  function connectEvents() {
    if (STATE.eventSource) return;

    let endpoint;

    try {
      endpoint = apiUrl(CONFIG.eventEndpoint);
    } catch (error) {
      log(error.message, "error");
      return;
    }

    if (!("EventSource" in window)) {
      log("This browser does not support Server-Sent Events.", "warning");
      return;
    }

    const source = new EventSource(endpoint, {
      withCredentials: true
    });

    STATE.eventSource = source;

    source.onopen = () => {
      STATE.reconnectAttempts = 0;
      setConnection(true);
    };

    source.onmessage = message => {
      try {
        handleEvent(JSON.parse(message.data));
      } catch {
        log("Ignored malformed backend event.", "warning");
      }
    };

    source.onerror = () => {
      setConnection(false);
      disconnectEvents();

      STATE.reconnectAttempts++;

      const delay = Math.min(
        CONFIG.maxReconnectDelay,
        CONFIG.reconnectDelay *
          Math.pow(1.5, STATE.reconnectAttempts - 1)
      );

      log(
        `Backend connection lost. Reconnecting in ${Math.round(delay / 1000)} seconds.`,
        "warning"
      );

      clearTimeout(STATE.reconnectTimer);

      STATE.reconnectTimer = setTimeout(
        connectEvents,
        delay
      );
    };
  }

  async function startAgent() {
    if (STATE.running) return;

    if (!STATE.connected) {
      log(
        "Cannot start real work: backend is not connected.",
        "warning"
      );

      setActivity(
        "Backend connection required",
        "Connect the Python agent backend to perform real repository operations."
      );

      return;
    }

    try {
      resetTasks();

      setRobotMessage("Starting repository operations...");
      setActivity("Sending start request");

      const result = await apiRequest("/start", {
        method: "POST",
        body: {
          requested_by: "dashboard",
          operation: "repository_maintenance"
        }
      });

      log(
        result.message || "Start request accepted by backend.",
        "success"
      );

    } catch (error) {
      setWorkerState("ERROR");
      log(`Start request failed: ${error.message}`, "error");
    }
  }

  async function pauseAgent() {
    if (!STATE.running) return;

    try {
      await apiRequest("/pause", {
        method: "POST",
        body: {}
      });

      log("Pause request sent.", "warning");

    } catch (error) {
      log(`Pause request failed: ${error.message}`, "error");
    }
  }

  async function stopAgent() {
    if (!STATE.running && !STATE.paused) return;

    try {
      await apiRequest("/stop", {
        method: "POST",
        body: {}
      });

      log("Stop request sent to backend.", "warning");

    } catch (error) {
      log(`Stop request failed: ${error.message}`, "error");
    }
  }

  function bindControls() {
    ELEMENTS.start?.addEventListener(
      "click",
      startAgent
    );

    ELEMENTS.pause?.addEventListener(
      "click",
      pauseAgent
    );

    ELEMENTS.stop?.addEventListener(
      "click",
      stopAgent
    );
  }

  function initialize() {
    bindControls();

    TASKS.forEach(task => {
      STATE.tasks[task.id] = "WAITING";
    });

    setConnection(false);
    setWorkerState("IDLE");
    setProgress(0);

    setRobotMessage("Hello! I am MedOrbits Agent.");
    setActivity(
      "Waiting for backend connection",
      "The robot is ready. Connect the Python agent to start real work."
    );

    log("Dashboard controller initialized.", "success");
    log("Waiting for Python backend event stream.", "info");

    connectEvents();

    window.addEventListener("beforeunload", () => {
      disconnectEvents();
      clearTimeout(STATE.reconnectTimer);
      STATE.activeController?.abort();
    });
  }

  // Public interface for optional backend adapters and debugging.
  window.MedOrbitsAgentUI = Object.freeze({
    handleEvent,
    log,
    setProgress,
    setActivity,
    setRobotMessage,
    setTaskState,
    updateMetric,
    setWorkerState,
    connectEvents,
    disconnectEvents
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
