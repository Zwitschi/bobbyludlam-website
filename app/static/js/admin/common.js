/**
 * Admin Common Utilities
 * Shared functions for preview, save status, sidebar tracking, and serialization.
 */
(function () {
  // Elements
  const previewRefreshButton = document.getElementById("preview_refresh");
  const previewFrame = document.getElementById("preview_frame");
  const previewStatus = document.getElementById("preview_status");
  const saveBtn = document.getElementById("save_btn");
  const unsavedBadge = document.getElementById("unsaved_badge");
  const saveStatus = document.getElementById("save_status");
  const sidebarNavLinks = Array.from(
    document.querySelectorAll(".admin-sidebar-nav a"),
  );

  // State
  let contentData = null;
  let metaData = null;
  let savedJson = "{}";
  let savedMetaJson = "{}";
  let currentPage = "unknown";

  // Initialize from DOM
  const initialContentJson = document.getElementById("initial_content_json");
  const initialMetaJson = document.getElementById("initial_meta_json");
  if (initialContentJson) {
    savedJson = initialContentJson.textContent.trim();
  }
  if (initialMetaJson) {
    savedMetaJson = initialMetaJson.textContent.trim();
  }

  // Detect page type
  const isContentPage = !!(
    document.getElementById("hero_eyebrow") ||
    document.getElementById("page_selector") ||
    document.getElementById("section_list") ||
    document.getElementById("rich_editor")
  );
  const isMetaPage = !!(
    document.getElementById("meta_title") ||
    document.getElementById("common_title") ||
    document.getElementById("twitter_card") ||
    document.getElementById("jsonld_context") ||
    document.getElementById("footer_summary")
  );
  currentPage = isContentPage ? "content" : isMetaPage ? "meta" : "unknown";

  const setSaveStatus = (message, isError = false) => {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.style.color = isError ? "#b91c1c" : "#166534";
  };

  const markUnsaved = () => {
    if (!unsavedBadge) return;
    const contentIsDirty = JSON.stringify(contentData, null, 2) !== savedJson;
    const metaIsDirty = JSON.stringify(metaData, null, 2) !== savedMetaJson;
    const showUnsaved =
      currentPage === "content" ? contentIsDirty : metaIsDirty;
    unsavedBadge.classList.toggle("visible", showUnsaved);
    if (saveBtn) saveBtn.classList.toggle("unsaved", showUnsaved);
  };

  const refreshPreview = async () => {
    if (!previewFrame || !previewRefreshButton) return;
    previewStatus.textContent = "Loading preview…";
    try {
      const resp = await fetch("/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentData || {}),
      });
      if (!resp.ok) {
        previewStatus.textContent = `Preview error: ${resp.status}`;
        return;
      }
      const html = await resp.text();
      previewFrame.srcdoc = html;
      previewStatus.textContent = "Preview updated.";
    } catch (err) {
      previewStatus.textContent = `Preview failed: ${err.message}`;
    }
  };

  const saveContent = async () => {
    const isContentPage = currentPage === "content";
    const jsonText = JSON.stringify(contentData, null, 2);
    const metaJsonText = JSON.stringify(metaData, null, 2);

    // client-side validation
    let parsed;
    let parsedMeta;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setSaveStatus(`Cannot save: invalid JSON — ${err.message}`, true);
      return;
    }
    if (
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      parsed === null
    ) {
      setSaveStatus("Cannot save: JSON root must be an object.", true);
      return;
    }

    try {
      parsedMeta = JSON.parse(metaJsonText);
    } catch (err) {
      setSaveStatus(
        `Cannot save metadata: invalid JSON — ${err.message}`,
        true,
      );
      return;
    }
    if (
      typeof parsedMeta !== "object" ||
      Array.isArray(parsedMeta) ||
      parsedMeta === null
    ) {
      setSaveStatus("Cannot save metadata: JSON root must be an object.", true);
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    setSaveStatus("Saving…");

    try {
      const endpoint = isContentPage
        ? "/admin/save/content"
        : "/admin/save/meta";
      const body = new URLSearchParams({
        content_json: jsonText,
        meta_json: metaJsonText,
      });
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (resp.ok) {
        if (isContentPage) {
          savedJson = jsonText;
          setSaveStatus("Content saved.");
        } else {
          savedMetaJson = metaJsonText;
          setSaveStatus("Metadata saved.");
        }
        markUnsaved();
      } else {
        const text = await resp.text();
        const match = text.match(/class="message[^"]*">([^<]+)</);
        const msg = match ? match[1].trim() : `Server error ${resp.status}`;
        setSaveStatus(`Save failed: ${msg}`, true);
      }
    } catch (err) {
      setSaveStatus(`Save failed: ${err.message}`, true);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  const setActiveSidebarLink = (targetId) => {
    sidebarNavLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${targetId}`;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const getSidebarSections = () =>
    sidebarNavLinks
      .map((link) => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) {
          return null;
        }
        return document.querySelector(href);
      })
      .filter(Boolean);

  const initializeSidebarTracking = () => {
    const sections = getSidebarSections();
    if (sections.length === 0) {
      return;
    }

    const activeHash = window.location.hash.slice(1);
    if (activeHash && sections.some((section) => section.id === activeHash)) {
      setActiveSidebarLink(activeHash);
    } else {
      setActiveSidebarLink(sections[0].id);
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (left, right) =>
                right.intersectionRatio - left.intersectionRatio ||
                left.boundingClientRect.top - right.boundingClientRect.top,
            );

          if (visibleEntries.length > 0) {
            setActiveSidebarLink(visibleEntries[0].target.id);
          }
        },
        {
          rootMargin: "0px 0px -70% 0px",
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );

      sections.forEach((section) => observer.observe(section));
    }

    window.addEventListener("scroll", () => {
      requestAnimationFrame(updateActiveSidebarFromScroll);
    });
  };

  const updateActiveSidebarFromScroll = () => {
    const sections = getSidebarSections();
    if (sections.length === 0) {
      return;
    }

    const viewportOffset = window.innerHeight * 0.25;
    let activeSection = sections[0];

    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= viewportOffset) {
        activeSection = section;
      } else {
        break;
      }
    }

    setActiveSidebarLink(activeSection.id);
  };

  const loadFromJson = () => {
    try {
      contentData = JSON.parse(savedJson);
    } catch (err) {
      return;
    }

    try {
      metaData = JSON.parse(savedMetaJson);
    } catch (err) {
      return;
    }

    markUnsaved();
  };

  // Wire up global handlers
  if (previewRefreshButton) {
    previewRefreshButton.addEventListener("click", refreshPreview);
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", saveContent);
  }

  window.addEventListener("beforeunload", (e) => {
    if (unsavedBadge && unsavedBadge.classList.contains("visible")) {
      e.preventDefault();
    }
  });

  // Expose to window for other modules
  window.adminCommon = {
    get contentData() {
      return contentData;
    },
    set contentData(val) {
      contentData = val;
    },
    get metaData() {
      return metaData;
    },
    set metaData(val) {
      metaData = val;
    },
    get savedJson() {
      return savedJson;
    },
    set savedJson(val) {
      savedJson = val;
    },
    get savedMetaJson() {
      return savedMetaJson;
    },
    set savedMetaJson(val) {
      savedMetaJson = val;
    },
    get currentPage() {
      return currentPage;
    },
    get isContentPage() {
      return isContentPage;
    },
    get isMetaPage() {
      return isMetaPage;
    },
    markUnsaved,
    refreshPreview,
    setSaveStatus,
  };

  // Init
  loadFromJson();
  initializeSidebarTracking();
})();
