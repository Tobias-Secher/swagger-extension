(function () {
  "use strict";

  // ──────────────────────────────────────────────
  // 1. Detect Swagger UI — bail early if not found
  // ──────────────────────────────────────────────

  const SWAGGER_SELECTOR = ".swagger-ui .opblock-tag-section";
  const MAX_POLL_ATTEMPTS = 30;
  const POLL_INTERVAL_MS = 500;

  function waitForSwagger(callback) {
    let attempts = 0;
    const interval = setInterval(() => {
      if (document.querySelector(SWAGGER_SELECTOR)) {
        clearInterval(interval);
        callback();
      } else if (++attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);
  }

  // ──────────────────────────────────────────────
  // 2. Toggle logic — uses .click() to stay in
  //    sync with React's internal state
  // ──────────────────────────────────────────────

  const TAG_HEADER = "h3.opblock-tag, h4.opblock-tag";

  function collapseAllTags() {
    document
      .querySelectorAll(`.opblock-tag-section.is-open > ${TAG_HEADER}`)
      .forEach((el) => el.click());
  }

  function expandAllTags() {
    document
      .querySelectorAll(`.opblock-tag-section:not(.is-open) > ${TAG_HEADER}`)
      .forEach((el) => el.click());
  }

  // ──────────────────────────────────────────────
  // 3. Search / filter logic
  // ──────────────────────────────────────────────

  const DIMMED_OP_CLASS = "sce-dimmed";
  const DIMMED_TAG_CLASS = "sce-dimmed-tag";
  const MATCH_HIGHLIGHT_CLASS = "sce-match";

  function getOperationSearchText(opblock) {
    const parts = [];

    // HTTP method (GET, POST, etc.)
    const methodEl = opblock.querySelector(".opblock-summary-method");
    if (methodEl) parts.push(methodEl.textContent.trim());

    // Endpoint path
    const pathEl = opblock.querySelector(
      ".opblock-summary-path, .opblock-summary-path__deprecated"
    );
    if (pathEl) parts.push(pathEl.textContent.trim());

    // Description (shown in the summary line)
    const descEl = opblock.querySelector(".opblock-summary-description");
    if (descEl) parts.push(descEl.textContent.trim());

    return parts.join(" ").toLowerCase();
  }

  function getTagName(tagSection) {
    const header = tagSection.querySelector(TAG_HEADER);
    if (!header) return "";

    // The tag name lives in an <a> or span inside the header —
    // avoid grabbing button/arrow text
    const link = header.querySelector("a.nostyle span, a.nostyle");
    if (link) return link.textContent.trim().toLowerCase();

    // Fallback: clone header, strip buttons, read remaining text
    const clone = header.cloneNode(true);
    clone.querySelectorAll("button, svg").forEach((el) => el.remove());
    return clone.textContent.trim().toLowerCase();
  }

  let matchCount = 0;
  let totalCount = 0;

  function applyOperationFilter(operation, term, tagMatches) {
    totalCount++;
    const opText = getOperationSearchText(operation);
    const opMatches = term === "" || tagMatches || opText.includes(term);

    if (opMatches) {
      matchCount++;
      operation.classList.remove(DIMMED_OP_CLASS);
      operation.classList.toggle(MATCH_HIGHLIGHT_CLASS, term !== "");
      return true;
    } else {
      operation.classList.add(DIMMED_OP_CLASS);
      operation.classList.remove(MATCH_HIGHLIGHT_CLASS);
      return false;
    }
  }

  function applyTagSectionFilter(section, term) {
    const tagName = getTagName(section);
    const tagMatches = term === "" || tagName.includes(term);
    const operations = section.querySelectorAll(".opblock");
    
    let sectionHasMatch = false;
    operations.forEach((op) => {
      if (applyOperationFilter(op, term, tagMatches)) {
        sectionHasMatch = true;
      }
    });

    // Dim the entire tag section if nothing inside it matches
    if (term === "") {
      section.classList.remove(DIMMED_TAG_CLASS);
    } else if (tagMatches || sectionHasMatch) {
      section.classList.remove(DIMMED_TAG_CLASS);
    } else {
      section.classList.add(DIMMED_TAG_CLASS);
    }
  }

  function applyFilter(query) {
    const term = query.toLowerCase().trim();
    const tagSections = document.querySelectorAll(".opblock-tag-section");

    matchCount = 0;
    totalCount = 0;

    tagSections.forEach((section) => applyTagSectionFilter(section, term));
    updateResultCount(term);
  }

  function updateResultCount(term) {
    const counter = document.getElementById("sce-search-count");
    if (!counter) return;

    if (term === "") {
      counter.textContent = "";
      counter.classList.remove("sce-search-count--no-results");
    } else if (matchCount === 0) {
      counter.textContent = "0 results";
      counter.classList.add("sce-search-count--no-results");
    } else {
      counter.textContent = `${matchCount} / ${totalCount}`;
      counter.classList.remove("sce-search-count--no-results");
    }
  }

  function clearFilter() {
    const input = document.getElementById("sce-search-input");
    if (input) input.value = "";
    applyFilter("");
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const debouncedFilter = debounce((value) => applyFilter(value), 150);

  // ──────────────────────────────────────────────
  // 4. Inject the toolbar
  // ──────────────────────────────────────────────

  function createButton(label, emoji, className, onClick) {
    const btn = document.createElement("button");
    btn.textContent = `${emoji} ${label}`;
    btn.className = `sce-btn ${className}`;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createTagButtonGroup() {
    const tagGroup = document.createElement("div");
    tagGroup.className = "sce-group";

    const tagLabel = document.createElement("span");
    tagLabel.className = "sce-label";
    tagLabel.textContent = "Tags";
    
    tagGroup.appendChild(tagLabel);
    tagGroup.appendChild(
      createButton("Collapse", "−", "sce-btn--collapse", collapseAllTags)
    );
    tagGroup.appendChild(
      createButton("Expand", "+", "sce-btn--expand", expandAllTags)
    );

    return tagGroup;
  }

  function createSearchInput() {
    const searchInput = document.createElement("input");
    searchInput.id = "sce-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Filter by path, method, tag, or description\u2026";
    searchInput.className = "sce-search-input";
    
    searchInput.addEventListener("input", (e) => debouncedFilter(e.target.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        clearFilter();
        searchInput.blur();
      }
    });

    return searchInput;
  }

  function createSearchBar() {
    const searchWrapper = document.createElement("div");
    searchWrapper.className = "sce-search-wrapper";

    const searchIcon = document.createElement("span");
    searchIcon.className = "sce-search-icon";
    searchIcon.innerHTML = "&#x2315;";

    const searchInput = createSearchInput();

    const clearBtn = document.createElement("button");
    clearBtn.className = "sce-search-clear";
    clearBtn.innerHTML = "&#x2715;";
    clearBtn.title = "Clear filter (Esc)";
    clearBtn.addEventListener("click", () => {
      clearFilter();
      searchInput.focus();
    });

    const resultCount = document.createElement("span");
    resultCount.id = "sce-search-count";
    resultCount.className = "sce-search-count";

    const shortcutHint = document.createElement("span");
    shortcutHint.className = "sce-shortcut-hint";
    shortcutHint.textContent = "Ctrl+Shift+F";

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    searchWrapper.appendChild(resultCount);
    searchWrapper.appendChild(shortcutHint);
    searchWrapper.appendChild(clearBtn);

    return { searchWrapper, searchInput };
  }

  function setupKeyboardShortcuts(searchInput) {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  function injectToolbar() {
    if (document.getElementById("sce-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.id = "sce-toolbar";

    // ── Toggle button groups ──
    const toggleRow = document.createElement("div");
    toggleRow.className = "sce-row";
    toggleRow.appendChild(createTagButtonGroup());

    // ── Search bar ──
    const searchRow = document.createElement("div");
    searchRow.className = "sce-row";
    
    const { searchWrapper, searchInput } = createSearchBar();
    searchRow.appendChild(searchWrapper);

    // ── Assemble toolbar ──
    toolbar.appendChild(toggleRow);
    toolbar.appendChild(searchRow);

    const swaggerRoot = document.querySelector(".swagger-ui");
    if (swaggerRoot && swaggerRoot.parentNode) {
      swaggerRoot.parentNode.insertBefore(toolbar, swaggerRoot);
    }

    setupKeyboardShortcuts(searchInput);
  }

  // ──────────────────────────────────────────────
  // 5. Kick it off
  // ──────────────────────────────────────────────

  waitForSwagger(injectToolbar);
})();
