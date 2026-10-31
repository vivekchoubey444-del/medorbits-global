'use strict';
(() => {
  const API = '/api/agent';
  const $ = (id) => document.getElementById(id);
  const state = { tasks: [], config: null, status: null, filter: 'all', polling: false, toastTimer: null };
  const escapeText = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
  const html = (value, max = 500) => escapeText(value, max).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  const dateText = (value) => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); };
  function toast(message, kind = 'info') { const el = $('toast'); el.textContent = escapeText(message, 240); el.dataset.kind = kind; el.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3600); }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API}${path}`, { method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined, signal: controller.signal });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json() : {};
      if (!response.ok) throw new Error(payload.error || payload.message || `API request failed (${response.status})`);
      return payload;
    } catch (error) { if (error.name === 'AbortError') throw new Error('The request timed out.'); throw error; }
    finally { clearTimeout(timeout); }
  }
  function setConnection(online, label) { const el = $('connection'); el.className = `connection ${online ? 'online' : 'offline'}`; el.querySelector('span').textContent = label || (online ? 'API connected' : 'API offline'); $('apiHealth').textContent = online ? 'Connected' : 'Unavailable'; }
  function renderStatus(status) {
    state.status = status || {};
    const s = state.status;
    $('repoName').textContent = `Repository: ${s.repository || 'not configured'}`;
    $('modeLabel').textContent = `Mode: ${s.mode || 'unknown'}`;
    $('runtimeLabel').textContent = `Node: ${s.nodeVersion || '—'}`;
    $('activeMetric').textContent = Number(s.activeTasks || 0).toLocaleString();
    $('completedMetric').textContent = Number(s.completedTasks || 0).toLocaleString();
    $('failedMetric').textContent = Number(s.failedTasks || 0).toLocaleString();
    $('totalMetric').textContent = Number(s.totalTasks || 0).toLocaleString();
    $('repositoryHealth').textContent = s.repositoryConfigured ? (s.repository || 'Available') : 'Not found';
    $('executionMode').textContent = s.readOnly ? 'Read-only' : 'Restricted';
    $('pythonHealth').textContent = s.pythonExecutable || 'Not reported';
    $('nodeHealth').textContent = s.nodeVersion || 'Not reported';
    const pill = $('healthPill'); pill.textContent = s.status === 'online' ? 'Operational' : (s.status || 'Unavailable'); pill.className = `status-pill ${s.status === 'online' ? 'good' : 'pending'}`;
  }
  function renderConfig(config) {
    state.config = config || {};
    const caps = $('capabilities');
    const features = state.config.features || {};
    const rows = Object.entries(features).map(([key, enabled]) => `<div class="cap-row"><span>${html(key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()))}</span><b class="${enabled ? 'yes' : 'no'}">${enabled ? 'Enabled' : 'Disabled'}</b></div>`).join('');
    caps.innerHTML = rows || '<p class="muted">No capability metadata returned.</p>';
  }
  function statusBadge(status) { const value = String(status || 'unknown').toLowerCase(); return `<span class="task-status ${['completed','failed','cancelled','running','queued'].includes(value) ? value : 'unknown'}">${html(value)}</span>`; }
  function renderTasks(tasks) {
    state.tasks = Array.isArray(tasks) ? tasks : [];
    const shown = state.filter === 'all' ? state.tasks : state.tasks.filter(t => t.status === state.filter);
    $('historyCount').textContent = `${shown.length} task${shown.length === 1 ? '' : 's'}`;
    const tbody = $('taskRows');
    if (!shown.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No tasks in this view. Run an operation above to get started.</td></tr>'; return; }
    tbody.innerHTML = shown.map(task => {
      const cancellable = ['queued','running'].includes(task.status);
      const result = task.message || (task.status === 'completed' ? 'Completed successfully' : 'Awaiting result');
      return `<tr><td><b>${html(task.label || task.type)}</b><small>${html(task.description || '')}</small></td><td><code>${html(task.id, 80)}</code></td><td>${html(dateText(task.createdAt))}</td><td>${statusBadge(task.status)}</td><td class="result-cell">${html(result, 180)}</td><td><div class="row-actions"><button class="mini-button view-task" data-id="${html(task.id, 100)}" type="button">View</button>${cancellable ? `<button class="mini-button danger cancel-task" data-id="${html(task.id, 100)}" type="button">Cancel</button>` : ''}</div></td></tr>`;
    }).join('');
    tbody.querySelectorAll('.view-task').forEach(button => button.addEventListener('click', () => showTask(button.dataset.id)));
    tbody.querySelectorAll('.cancel-task').forEach(button => button.addEventListener('click', () => cancelTask(button.dataset.id)));
  }
  async function refresh(silent = false) {
    if (state.polling) return;
    state.polling = true;
    try {
      const [status, tasks, config] = await Promise.all([request('/status'), request('/tasks'), state.config ? Promise.resolve(state.config) : request('/config')]);
      renderStatus(status); renderTasks(tasks.tasks); renderConfig(config); setConnection(true);
    } catch (error) { setConnection(false, 'API disconnected'); if (!silent) toast(error.message, 'error'); }
    finally { state.polling = false; }
  }
  async function runTask(type, button) {
    if (button) { button.disabled = true; button.dataset.original = button.textContent; button.textContent = 'Queueing…'; }
    try {
      const result = await request('/tasks', { method: 'POST', body: { type, task: type, readOnly: true } });
      toast(result.message || 'Task queued.', 'success'); await refresh(true);
    } catch (error) { toast(error.message, 'error'); }
    finally { if (button) { button.disabled = false; button.textContent = button.dataset.original || 'Run'; } }
  }
  async function cancelTask(taskId) {
    if (!window.confirm('Cancel this queued or running task?')) return;
    try { const result = await request('/cancel', { method: 'POST', body: { taskId } }); toast(result.message || 'Cancellation requested.', 'success'); await refresh(true); }
    catch (error) { toast(error.message, 'error'); }
  }
  function showTask(id) {
    const task = state.tasks.find(item => item.id === id); if (!task) return;
    $('dialogTitle').textContent = task.label || task.type || 'Task details';
    $('dialogMeta').textContent = `${task.id} · ${task.status} · Created ${dateText(task.createdAt)}${task.completedAt ? ` · Finished ${dateText(task.completedAt)}` : ''}`;
    $('dialogOutput').textContent = [task.message || '', task.output || 'No output was returned by this task.', task.exitCode !== null && task.exitCode !== undefined ? `Exit code: ${task.exitCode}` : ''].filter(Boolean).join('\n\n');
    const dialog = $('taskDialog'); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeDialog() { const dialog = $('taskDialog'); if (dialog.open && dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
  function bind() {
    document.querySelectorAll('.run-task').forEach(button => button.addEventListener('click', () => runTask(button.dataset.task, button)));
    $('refreshBtn').addEventListener('click', () => refresh());
    $('configBtn').addEventListener('click', () => { const el = $('capabilities'); el.hidden = !el.hidden; $('configBtn').textContent = el.hidden ? 'View enabled capabilities' : 'Hide enabled capabilities'; });
    $('clearFilterBtn').addEventListener('click', () => { state.filter = 'all'; renderTasks(state.tasks); });
    $('closeDialog').addEventListener('click', closeDialog); $('dialogDone').addEventListener('click', closeDialog);
    $('copyOutput').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('dialogOutput').textContent); toast('Task output copied.', 'success'); } catch { toast('Clipboard access is unavailable in this browser.', 'error'); } });
    $('taskDialog').addEventListener('click', event => { if (event.target === $('taskDialog')) closeDialog(); });
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); refresh(); window.setInterval(() => refresh(true), 4000); });
})();
