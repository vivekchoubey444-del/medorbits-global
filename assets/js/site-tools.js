
// File: /assets/js/site-tools.js
(() => {
  "use strict";

  if (!/^\/(education|career)(\/|$)/.test(location.pathname)) return;
  if (document.querySelector(".site-tools")) return;

  const career = /^\/career(\/|$)/.test(location.pathname);
  const $ = (selector) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const root = document.createElement("div");
  root.className = "site-tools";
  root.innerHTML = `
    <button type="button" data-toggle aria-expanded="false" aria-controls="siteToolsPanel">Tools</button>
    <section id="siteToolsPanel" class="site-tools__panel" hidden>
      <header>
        <div><small>MEDORBITS</small><h2>Study &amp; career tools</h2></div>
        <button type="button" data-close aria-label="Close tools">×</button>
      </header>

      <nav class="site-tools__tabs" role="tablist" aria-label="Tools">
        ${["Viewer", "Verify", "Estimate", "Calculator", "Compare"].map((name, i) =>
          `<button type="button" role="tab" id="toolTab${i}" aria-controls="toolPane${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${i}">${name}</button>`
        ).join("")}
      </nav>

      <a href="/assets/documents/checklists/general/official-notice-verification-checklist.pdf" target="_blank" rel="noopener noreferrer">Download notice verification checklist (PDF)</a>

      <section id="toolPane0" role="tabpanel" aria-labelledby="toolTab0" data-pane="0">
        <label>Preview a PDF or image
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-viewer>
        </label>
        <div data-preview aria-live="polite">Choose a file to preview. Files stay in your browser.</div>
      </section>

      <section id="toolPane1" role="tabpanel" aria-labelledby="toolTab1" data-pane="1" hidden>
        <label>Check file signature
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-file>
        </label>
        <button type="button" data-verify>Check file</button>
        <p data-verify-result role="status">Checks file format only, not authenticity.</p>
      </section>

      <section id="toolPane2" role="tabpanel" aria-labelledby="toolTab2" data-pane="2" hidden>
        <form data-estimate>
          <label data-education>Tuition per year (₹)<input name="tuition" type="number" min="0" max="100000000" value="500000" required></label>
          <label data-education>Living costs per year (₹)<input name="living" type="number" min="0" max="100000000" value="180000" required></label>
          <label data-education>Course duration (years)<input name="years" type="number" min="1" max="15" value="4" required></label>
          <label data-education>Total scholarship (₹)<input name="scholarship" type="number" min="0" max="1000000000" value="0" required></label>
          <label data-career>Training or transition cost (₹)<input name="training" type="number" min="0" max="1000000000" value="0" required></label>
          <label data-career>Annual income increase (₹)<input name="income" type="number" min="0" max="1000000000" value="0" required></label>
          <button type="submit">Calculate estimate</button>
        </form>
        <p data-estimate-result role="status">Planning estimate only. Confirm fees or salary independently.</p>
      </section>

      <section id="toolPane3" role="tabpanel" aria-labelledby="toolTab3" data-pane="3" hidden>
        <form data-calculator>
          <label>Monthly amount (₹)<input name="amount" type="number" min="0" max="100000000" value="10000" required></label>
          <label>Number of months<input name="months" type="number" min="1" max="600" value="12" required></label>
          <button type="submit">Calculate total</button>
        </form>
        <p data-calculator-result role="status">Simple budget calculator.</p>
      </section>

      <section id="toolPane4" role="tabpanel" aria-labelledby="toolTab4" data-pane="4" hidden>
        <form data-compare>
          <fieldset>
            <legend>Option A</legend>
            <label>Name<input name="nameA" maxlength="60" value="Option A" required></label>
            <label>Total cost (₹)<input name="costA" type="number" min="0" max="1000000000" required></label>
            <label>Duration (years)<input name="yearsA" type="number" min="0.25" max="30" step="0.25" required></label>
          </fieldset>
          <fieldset>
            <legend>Option B</legend>
            <label>Name<input name="nameB" maxlength="60" value="Option B" required></label>
            <label>Total cost (₹)<input name="costB" type="number" min="0" max="1000000000" required></label>
            <label>Duration (years)<input name="yearsB" type="number" min="0.25" max="30" step="0.25" required></label>
          </fieldset>
          <button type="submit">Compare options</button>
        </form>
        <div data-compare-result role="status" aria-live="polite">Compare your figures; this is not a recommendation.</div>
      </section>
    </section>`;

  document.body.appendChild(root);

  const panel = $(".site-tools__panel");
  const toggle = $("[data-toggle]");
  let previewUrl = null;

  $$("[data-education]").forEach((el) => { el.hidden = career; });
  $$("[data-career]").forEach((el) => { el.hidden = !career; });

  function $$(selector) {
    return root.querySelectorAll(selector);
  }

  function openTools(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) $("[data-tab='0']").focus();
    else toggle.focus();
  }

  toggle.addEventListener("click", () => openTools(panel.hidden));
  $("[data-close]").addEventListener("click", () => openTools(false));

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) openTools(false);

    const tab = event.target.closest("[data-tab]");
    if (!tab) return;

    const tabs = [...$$("[data-tab]")];
    const index = tabs.indexOf(tab);
    let next = index;

    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    selectTab(tabs[next]);
  });

  function selectTab(selected) {
    $$("[data-tab]").forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    $$("[data-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.pane !== selected.dataset.tab;
    });

    selected.focus();
  }

  $$("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });

  function acceptedFile(file) {
    if (!file || file.size > 20 * 1024 * 1024) return false;

    const extension = file.name.split(".").pop().toLowerCase();
    const allowed = {
      pdf: ["pdf", "application/pdf"],
      jpg: ["jpg", "jpeg", "image/jpeg"],
      jpeg: ["jpg", "jpeg", "image/jpeg"],
      png: ["png", "image/png"]
    };

    return Boolean(allowed[extension] &&
      (!file.type || allowed[extension].includes(file.type)));
  }

  $("[data-viewer]").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const output = $("[data-preview]");

    if (!file) return;

    if (!acceptedFile(file)) {
      output.textContent = "Choose a supported PDF or image smaller than 20 MB.";
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    const preview = document.createElement(
      file.name.toLowerCase().endsWith(".pdf") ? "iframe" : "img"
    );

    preview.className = "site-tools__preview";
    preview.src = previewUrl;
    preview.title = `Preview: ${file.name}`;

    if (preview instanceof HTMLImageElement) preview.alt = file.name;

    output.replaceChildren(preview);
  });

  $("[data-verify]").addEventListener("click", async () => {
    const file = $("[data-file]").files?.[0];
    const output = $("[data-verify-result]");

    if (!file) {
      output.textContent = "Choose a file first.";
      return;
    }

    if (!acceptedFile(file)) {
      output.textContent = "Unsupported file or file exceeds 20 MB.";
      return;
    }

    try {
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const extension = file.name.split(".").pop().toLowerCase();

      const valid =
        (extension === "pdf" &&
          String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") ||
        ((extension === "jpg" || extension === "jpeg") &&
          bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
        (extension === "png" &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n));

      output.textContent = valid
        ? "File signature matches its extension. Authenticity is not verified."
        : "File signature does not match a supported format.";
    } catch {
      output.textContent = "Unable to read this file.";
    }
  });

  $("[data-estimate]").addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const result = $("[data-estimate-result]");

    if (career) {
      const cost = Number(form.get("training"));
      const increase = Number(form.get("income"));

      result.textContent = increase > 0
        ? `Estimated payback period: ${(cost / increase).toFixed(1)} years.`
        : "Enter an annual income increase greater than zero.";
      return;
    }

    const total =
      (Number(form.get("tuition")) + Number(form.get("living"))) *
      Number(form.get("years")) -
      Number(form.get("scholarship"));

    result.textContent = `Estimated total cost: ${money(Math.max(0, total))}.`;
  });

  $("[data-calculator]").addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const total = Number(form.get("amount")) * Number(form.get("months"));

    $("[data-calculator-result]").textContent = `Total: ${money(total)}.`;
  });

  $("[data-compare]").addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const options = ["A", "B"].map((key) => ({
      name: String(form.get(`name${key}`)).trim(),
      cost: Number(form.get(`cost${key}`)),
      years: Number(form.get(`years${key}`))
    }));

    const table = document.createElement("table");
    const header = document.createElement("tr");

    ["Measure", ...options.map((option) => option.name)].forEach((value) => {
      const cell = document.createElement("th");
      cell.textContent = value;
      header.appendChild(cell);
    });

    table.appendChild(header);

    [
      ["Total cost", (option) => money(option.cost)],
      ["Duration", (option) => `${option.years} years`],
      ["Cost per year", (option) => money(option.cost / option.years)]
    ].forEach(([label, format]) => {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = label;
      row.appendChild(heading);

      options.forEach((option) => {
        const cell = document.createElement("td");
        cell.textContent = format(option);
        row.appendChild(cell);
      });

      table.appendChild(row);
    });

    $("[data-compare-result]").replaceChildren(table);
  });

  window.addEventListener("pagehide", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, { once: true });
})();
