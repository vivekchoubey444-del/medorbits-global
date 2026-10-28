(() => {
  "use strict";
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "CLOSE ×" : "☰ MENU";
    });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰ MENU";
    }));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰ MENU";
      }
    });
  }
  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });
  const search = document.querySelector("[data-filter-search]");
  const items = [...document.querySelectorAll("[data-search-item]")];
  if (search && items.length) {
    const update = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      items.forEach(item => {
        const match = !q || (item.dataset.searchItem + " " + item.textContent).toLowerCase().includes(q);
        item.classList.toggle("hidden", !match);
        if (match) shown++;
      });
      const status = document.querySelector("[data-search-status]");
      if (status) status.textContent = `${shown} resource${shown === 1 ? "" : "s"} shown.`;
    };
    search.addEventListener("input", update);
    update();
  }
})();
