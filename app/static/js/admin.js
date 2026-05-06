(() => {
  const initialContentJson = document.getElementById("initial_content_json");
  const initialMetaJson = document.getElementById("initial_meta_json");
  const pageSelector = document.getElementById("page_selector");
  const sectionList = document.getElementById("section_list");
  const sectionHeading = document.getElementById("section_heading");
  const heroEyebrow = document.getElementById("hero_eyebrow");
  const heroTitle = document.getElementById("hero_title");
  const heroIntro = document.getElementById("hero_intro");
  const metaTitle = document.getElementById("meta_title");
  const metaDescription = document.getElementById("meta_description");
  const metaKeywords = document.getElementById("meta_keywords");
  const ogTitle = document.getElementById("og_title");
  const ogDescription = document.getElementById("og_description");
  const ogType = document.getElementById("og_type");
  const ogSiteName = document.getElementById("og_site_name");
  const ogImage = document.getElementById("og_image");
  const twitterCard = document.getElementById("twitter_card");
  const twitterTitle = document.getElementById("twitter_title");
  const twitterDescription = document.getElementById("twitter_description");
  const twitterImage = document.getElementById("twitter_image");
  const jsonldContext = document.getElementById("jsonld_context");
  const jsonldType = document.getElementById("jsonld_type");
  const jsonldName = document.getElementById("jsonld_name");
  const jsonldDescription = document.getElementById("jsonld_description");
  const jsonldImage = document.getElementById("jsonld_image");
  const jsonldSameAs = document.getElementById("jsonld_same_as");
  const footerSummary = document.getElementById("footer_summary");
  const footerLinks = document.getElementById("footer_links");
  const footerCopyrightYear = document.getElementById("footer_copyright_year");
  const footerCreditLabel = document.getElementById("footer_credit_label");
  const footerCreditUrl = document.getElementById("footer_credit_url");
  const footerCreditText = document.getElementById("footer_credit_text");
  const richEditor = document.getElementById("rich_editor");
  const status = document.getElementById("editor_status");
  const applyButton = document.getElementById("editor_apply");
  const reloadButton = document.getElementById("editor_reload");
  const linkButton = document.getElementById("editor_link");
  const imageButton = document.getElementById("editor_image");
  const sectionAddButton = document.getElementById("section_add");
  const sectionRenameButton = document.getElementById("section_rename");
  const toolbarButtons = document.querySelectorAll("[data-editor-cmd]");
  const previewRefreshButton = document.getElementById("preview_refresh");
  const previewFrame = document.getElementById("preview_frame");
  const previewStatus = document.getElementById("preview_status");
  const saveBtn = document.getElementById("save_btn");
  const unsavedBadge = document.getElementById("unsaved_badge");
  const saveStatus = document.getElementById("save_status");
  const sidebarNavLinks = Array.from(
    document.querySelectorAll(".admin-sidebar-nav a"),
  );

  const isContentPage = !!(
    heroEyebrow ||
    pageSelector ||
    sectionList ||
    richEditor
  );
  const isMetaPage = !!(
    metaTitle ||
    ogTitle ||
    twitterCard ||
    jsonldContext ||
    footerSummary
  );
  const currentPage = isContentPage
    ? "content"
    : isMetaPage
      ? "meta"
      : "unknown";

  let contentData = null;
  let metaData = null;
  let savedJson = initialContentJson?.textContent.trim() || "{}";
  let savedMetaJson = initialMetaJson?.textContent.trim() || "{}";
  let selectedSectionIndex = -1;
  let dragStartIndex = -1;
  let contentDirty = false;
  let metaDirty = false;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#b91c1c" : "#1e40af";
  };

  const mergeTextSegments = (segments) => {
    const merged = [];
    for (const segment of segments) {
      if (
        segment.type === "text" &&
        merged.length > 0 &&
        merged[merged.length - 1].type === "text"
      ) {
        merged[merged.length - 1].text += segment.text;
      } else {
        merged.push(segment);
      }
    }
    return merged;
  };

  const parseInlineFromNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [{ type: "text", text: node.nodeValue ?? "" }];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const element = node;
    if (element.tagName === "A") {
      return [
        {
          type: "link",
          text: element.textContent ?? "",
          url: element.getAttribute("href") ?? "",
        },
      ];
    }

    if (element.tagName === "BR") {
      return [{ type: "text", text: "\n" }];
    }

    const childSegments = [];
    for (const child of element.childNodes) {
      childSegments.push(...parseInlineFromNode(child));
    }
    return childSegments;
  };

  const parseInlineFromContainer = (container) => {
    const segments = [];
    for (const child of container.childNodes) {
      segments.push(...parseInlineFromNode(child));
    }

    const normalized = mergeTextSegments(segments).filter((segment) => {
      if (segment.type === "text") {
        return segment.text.length > 0;
      }
      return Boolean(segment.text || segment.url);
    });

    return normalized.length > 0 ? normalized : [{ type: "text", text: "" }];
  };

  const segmentsToHtml = (segments) => {
    const wrapper = document.createElement("div");
    for (const segment of segments || []) {
      if (segment.type === "link") {
        const anchor = document.createElement("a");
        anchor.href = segment.url || "";
        anchor.textContent = segment.text || segment.url || "link";
        wrapper.appendChild(anchor);
      } else {
        wrapper.appendChild(document.createTextNode(segment.text || ""));
      }
    }
    return wrapper.innerHTML;
  };

  const listItemsToHtml = (items) => {
    const list = document.createElement("ul");
    for (const item of items || []) {
      const li = document.createElement("li");
      li.innerHTML = segmentsToHtml(item);
      list.appendChild(li);
    }
    return list.outerHTML;
  };

  const escapeAttr = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const getSelectedSection = () => {
    const pageName = getCurrentPageName();
    const sections = contentData?.[pageName]?.sections || [];
    if (selectedSectionIndex < 0 || selectedSectionIndex >= sections.length) {
      return null;
    }
    return sections[selectedSectionIndex];
  };

  const sectionBlocksToHtml = (blocks) => {
    const htmlParts = [];
    for (const block of blocks || []) {
      if (block.type === "paragraph") {
        htmlParts.push(`<p>${segmentsToHtml(block.segments || [])}</p>`);
      } else if (block.type === "list") {
        htmlParts.push(listItemsToHtml(block.items || []));
      } else if (block.type === "image") {
        htmlParts.push(
          `<p><img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}"></p>`,
        );
      }
    }
    return htmlParts.join("\n") || "<p></p>";
  };

  const parseSectionBlocksFromEditor = () => {
    const blocks = [];
    const nodes = Array.from(richEditor.childNodes);

    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent && node.textContent.trim().length > 0) {
          blocks.push({
            type: "paragraph",
            segments: [{ type: "text", text: node.textContent }],
          });
        }
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const element = node;
      const tag = element.tagName;

      if (tag === "UL" || tag === "OL") {
        const listItems = Array.from(element.querySelectorAll(":scope > li"));
        blocks.push({
          type: "list",
          items:
            listItems.length > 0
              ? listItems.map((li) => parseInlineFromContainer(li))
              : [[{ type: "text", text: "" }]],
        });
        continue;
      }

      if (tag === "IMG") {
        blocks.push({
          type: "image",
          src: element.getAttribute("src") || "",
          alt: element.getAttribute("alt") || "",
        });
        continue;
      }

      if (tag === "P" || tag === "DIV") {
        const singleImage =
          element.childElementCount === 1 &&
          element.firstElementChild &&
          element.firstElementChild.tagName === "IMG" &&
          (element.textContent || "").trim().length === 0;

        if (singleImage) {
          const image = element.firstElementChild;
          blocks.push({
            type: "image",
            src: image.getAttribute("src") || "",
            alt: image.getAttribute("alt") || "",
          });
        } else {
          blocks.push({
            type: "paragraph",
            segments: parseInlineFromContainer(element),
          });
        }
      }
    }

    return blocks.length > 0
      ? blocks
      : [{ type: "paragraph", segments: [{ type: "text", text: "" }] }];
  };

  const serializeContent = () => JSON.stringify(contentData, null, 2);

  const normalizeLines = (value) =>
    String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const footerLinksToText = (links) =>
    (links || [])
      .map((link) => `${link.label || ""} | ${link.url || ""}`)
      .join("\n");

  const parseFooterLinks = (value) =>
    normalizeLines(value)
      .map((line) => {
        const [label, ...rest] = line.split("|");
        return {
          label: (label || "").trim(),
          url: rest.join("|").trim(),
        };
      })
      .filter((link) => link.label || link.url);

  const serializeMeta = () => JSON.stringify(metaData, null, 2);

  const getMetaData = () => {
    if (!metaData || typeof metaData !== "object") {
      metaData = {};
    }
    return metaData;
  };

  const ensureMetaSection = (key) => {
    const data = getMetaData();
    if (
      !data[key] ||
      typeof data[key] !== "object" ||
      Array.isArray(data[key])
    ) {
      data[key] = {};
    }
    return data[key];
  };

  const getHeroData = () => {
    if (!contentData.hero || typeof contentData.hero !== "object") {
      contentData.hero = {};
    }
    return contentData.hero;
  };

  const markUnsaved = () => {
    if (!unsavedBadge) return;
    const contentIsDirty = serializeContent() !== savedJson;
    const metaIsDirty = serializeMeta() !== savedMetaJson;
    const showUnsaved =
      currentPage === "content" ? contentIsDirty : metaIsDirty;
    unsavedBadge.classList.toggle("visible", showUnsaved);
    if (saveBtn) saveBtn.classList.toggle("unsaved", showUnsaved);
  };

  const setSaveStatus = (message, isError = false) => {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.style.color = isError ? "#b91c1c" : "#166534";
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
          rootMargin: "-15% 0px -55% 0px",
          threshold: [0.1, 0.25, 0.5, 0.75],
        },
      );

      sections.forEach((section) => observer.observe(section));
    }

    window.addEventListener("scroll", updateActiveSidebarFromScroll, {
      passive: true,
    });
    window.addEventListener("hashchange", updateActiveSidebarFromScroll);
    updateActiveSidebarFromScroll();
  };

  const refreshPreview = async () => {
    if (!contentData) return;
    previewStatus.textContent = "Loading preview…";
    try {
      const resp = await fetch("/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentData),
      });
      if (!resp.ok) {
        previewStatus.textContent = `Preview error: ${resp.status}`;
        return;
      }
      const html = await resp.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const oldUrl = previewFrame.src;
      previewFrame.src = url;
      if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
      previewStatus.textContent = "Preview updated.";
    } catch (err) {
      previewStatus.textContent = `Preview failed: ${err.message}`;
    }
  };

  const saveContent = async () => {
    const isContentPage = currentPage === "content";
    const jsonText = serializeContent();
    const metaJsonText = serializeMeta();

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

    saveBtn.disabled = true;
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
        // extract save_message from rendered HTML if possible
        const match = text.match(/class="message[^"]*">([^<]+)</);
        const msg = match ? match[1].trim() : `Server error ${resp.status}`;
        setSaveStatus(`Save failed: ${msg}`, true);
      }
    } catch (err) {
      setSaveStatus(`Save failed: ${err.message}`, true);
    } finally {
      saveBtn.disabled = false;
    }
  };

  const getCurrentPageName = () => pageSelector.value;

  const getCurrentSections = () => {
    const pageName = getCurrentPageName();
    return contentData?.[pageName]?.sections || [];
  };

  const getCurrentSectionIndex = () => selectedSectionIndex;

  const refreshPageSelector = () => {
    const previous = pageSelector.value;
    pageSelector.innerHTML = "";

    Object.entries(contentData || {}).forEach(([pageName, pageData]) => {
      if (!pageData || !Array.isArray(pageData.sections)) {
        return;
      }
      const option = document.createElement("option");
      option.value = pageName;
      option.textContent = pageName;
      pageSelector.appendChild(option);
    });

    if (previous && contentData?.[previous]) {
      pageSelector.value = previous;
    }
  };

  const refreshSectionList = () => {
    const sections = getCurrentSections();

    if (selectedSectionIndex < 0 && sections.length > 0) {
      selectedSectionIndex = 0;
    }
    if (selectedSectionIndex >= sections.length) {
      selectedSectionIndex = sections.length - 1;
    }

    sectionList.innerHTML = "";
    sections.forEach((section, index) => {
      const li = document.createElement("li");
      li.className =
        "section-item" + (index === selectedSectionIndex ? " selected" : "");
      li.draggable = true;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.setAttribute("aria-hidden", "true");
      handle.textContent = "⠿";

      const label = document.createElement("span");
      label.className = "section-item-label";
      label.textContent = `${index + 1}. ${
        section.heading || "Untitled section"
      }`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "section-item-delete";
      del.textContent = "✕";
      del.title = "Delete section";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSection(index);
      });

      li.appendChild(handle);
      li.appendChild(label);
      li.appendChild(del);

      li.addEventListener("click", () => {
        selectedSectionIndex = index;
        sectionHeading.value = sections[index]?.heading || "";
        sectionList.querySelectorAll(".section-item").forEach((el, i) => {
          el.classList.toggle("selected", i === index);
        });
        renderSelectedSection();
      });

      li.addEventListener("dragstart", (e) => {
        dragStartIndex = index;
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => li.classList.add("dragging"), 0);
      });
      li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        sectionList
          .querySelectorAll(".section-item.drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragStartIndex !== index) {
          sectionList
            .querySelectorAll(".section-item.drag-over")
            .forEach((el) => el.classList.remove("drag-over"));
          li.classList.add("drag-over");
        }
      });
      li.addEventListener("dragleave", () => {
        li.classList.remove("drag-over");
      });
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        if (dragStartIndex < 0 || dragStartIndex === index) return;
        const pageName = getCurrentPageName();
        const pageSections = contentData[pageName].sections;
        const [moved] = pageSections.splice(dragStartIndex, 1);
        pageSections.splice(index, 0, moved);
        selectedSectionIndex = index;
        dragStartIndex = -1;
        applySectionChanges("Section order updated.");
      });

      sectionList.appendChild(li);
    });

    sectionHeading.value =
      selectedSectionIndex >= 0
        ? sections[selectedSectionIndex]?.heading || ""
        : "";
  };

  const renderHeroFields = () => {
    if (!heroEyebrow || !heroTitle || !heroIntro) return;
    const hero = getHeroData();
    heroEyebrow.value = hero.eyebrow || "";
    heroTitle.value = hero.title || "";
    heroIntro.value = hero.intro || "";
  };

  const renderMetaFields = () => {
    if (!metaTitle) return;
    const data = getMetaData();
    const openGraph = ensureMetaSection("open_graph");
    const twitter = ensureMetaSection("twitter");
    const jsonld = ensureMetaSection("jsonld");
    const footer = ensureMetaSection("footer");
    const credit =
      typeof footer.credit === "object" && footer.credit !== null
        ? footer.credit
        : (footer.credit = {});

    metaTitle.value = data.title || "";
    if (metaDescription) metaDescription.value = data.description || "";
    if (metaKeywords) metaKeywords.value = (data.keywords || []).join("\n");

    if (ogTitle) ogTitle.value = openGraph.title || "";
    if (ogDescription) ogDescription.value = openGraph.description || "";
    if (ogType) ogType.value = openGraph.type || "";
    if (ogSiteName) ogSiteName.value = openGraph.site_name || "";
    if (ogImage) ogImage.value = openGraph.image || "";

    if (twitterCard) twitterCard.value = twitter.card || "";
    if (twitterTitle) twitterTitle.value = twitter.title || "";
    if (twitterDescription)
      twitterDescription.value = twitter.description || "";
    if (twitterImage) twitterImage.value = twitter.image || "";

    if (jsonldContext) jsonldContext.value = jsonld["@context"] || "";
    if (jsonldType) jsonldType.value = jsonld["@type"] || "";
    if (jsonldName) jsonldName.value = jsonld.name || "";
    if (jsonldDescription) jsonldDescription.value = jsonld.description || "";
    if (jsonldImage) jsonldImage.value = jsonld.image || "";
    if (jsonldSameAs) jsonldSameAs.value = (jsonld.sameAs || []).join("\n");

    if (footerSummary) footerSummary.value = footer.summary || "";
    if (footerLinks) footerLinks.value = footerLinksToText(footer.links || []);
    if (footerCopyrightYear)
      footerCopyrightYear.value = footer.copyright_year || "";
    if (footerCreditLabel) footerCreditLabel.value = credit.label || "";
    if (footerCreditUrl) footerCreditUrl.value = credit.url || "";
    if (footerCreditText) footerCreditText.value = credit.text || "";
  };

  const syncMetaFromFields = () => {
    if (!metaTitle) return;
    const data = getMetaData();
    const openGraph = ensureMetaSection("open_graph");
    const twitter = ensureMetaSection("twitter");
    const jsonld = ensureMetaSection("jsonld");
    const footer = ensureMetaSection("footer");
    const credit =
      typeof footer.credit === "object" && footer.credit !== null
        ? footer.credit
        : (footer.credit = {});

    data.title = metaTitle.value;
    if (metaDescription) data.description = metaDescription.value;
    if (metaKeywords) data.keywords = normalizeLines(metaKeywords.value);

    if (ogTitle) openGraph.title = ogTitle.value;
    if (ogDescription) openGraph.description = ogDescription.value;
    if (ogType) openGraph.type = ogType.value;
    if (ogSiteName) openGraph.site_name = ogSiteName.value;
    if (ogImage) openGraph.image = ogImage.value;

    if (twitterCard) twitter.card = twitterCard.value;
    if (twitterTitle) twitter.title = twitterTitle.value;
    if (twitterDescription) twitter.description = twitterDescription.value;
    if (twitterImage) twitter.image = twitterImage.value;

    if (jsonldContext) jsonld["@context"] = jsonldContext.value;
    if (jsonldType) jsonld["@type"] = jsonldType.value;
    if (jsonldName) jsonld.name = jsonldName.value;
    if (jsonldDescription) jsonld.description = jsonldDescription.value;
    if (jsonldImage) jsonld.image = jsonldImage.value;
    if (jsonldSameAs) jsonld.sameAs = normalizeLines(jsonldSameAs.value);

    if (footerSummary) footer.summary = footerSummary.value;
    if (footerLinks) footer.links = parseFooterLinks(footerLinks.value);
    if (footerCopyrightYear)
      footer.copyright_year = Number(footerCopyrightYear.value) || 0;
    if (footerCreditLabel) credit.label = footerCreditLabel.value;
    if (footerCreditUrl) credit.url = footerCreditUrl.value;
    if (footerCreditText) credit.text = footerCreditText.value;
  };

  const deleteSection = (index) => {
    const sections = getCurrentSections();
    const heading = sections[index]?.heading || "Untitled section";
    if (!window.confirm(`Delete section "${heading}"?`)) return;
    sections.splice(index, 1);
    if (selectedSectionIndex >= sections.length) {
      selectedSectionIndex = sections.length - 1;
    }
    applySectionChanges(`Section "${heading}" deleted.`);
  };

  const renderSelectedSection = () => {
    const section = getSelectedSection();
    if (!section) {
      richEditor.innerHTML = "";
      setStatus("Select a section to edit its full content.", true);
      return;
    }

    richEditor.innerHTML = sectionBlocksToHtml(section.blocks || []);
    setStatus(`Editing full section: ${section.heading || "Untitled section"}`);
  };

  const loadFromJson = () => {
    try {
      contentData = JSON.parse(savedJson);
    } catch (err) {
      if (isContentPage) {
        setStatus("Cannot load editor: invalid JSON payload.", true);
      }
      return;
    }

    try {
      metaData = JSON.parse(savedMetaJson);
    } catch (err) {
      if (isMetaPage) {
        setSaveStatus(
          "Cannot load metadata editor: invalid JSON payload.",
          true,
        );
      }
      return;
    }

    if (isContentPage) {
      renderHeroFields();
      refreshPageSelector();
      selectedSectionIndex = -1;
      refreshSectionList();
      renderSelectedSection();
    }

    if (isMetaPage) {
      renderMetaFields();
    }

    markUnsaved();
  };

  const applySectionChanges = (message) => {
    markUnsaved();
    refreshSectionList();
    renderSelectedSection();
    setStatus(message);
    refreshPreview();
  };

  const addSection = () => {
    const pageName = getCurrentPageName();
    if (!pageName || !contentData?.[pageName]) {
      setStatus("Select page before adding section.", true);
      return;
    }

    const newHeading = sectionHeading.value.trim() || "New Section";
    contentData[pageName].sections = contentData[pageName].sections || [];
    contentData[pageName].sections.push({
      heading: newHeading,
      blocks: [
        {
          type: "paragraph",
          segments: [{ type: "text", text: "" }],
        },
      ],
    });
    selectedSectionIndex = contentData[pageName].sections.length - 1;
    applySectionChanges(`Section '${newHeading}' added.`);
  };

  const renameSection = () => {
    const sections = getCurrentSections();
    const idx = getCurrentSectionIndex();
    if (idx < 0 || idx >= sections.length) {
      setStatus("Select section to rename.", true);
      return;
    }

    const heading = sectionHeading.value.trim();
    if (!heading) {
      setStatus("Section heading cannot be empty.", true);
      return;
    }

    sections[idx].heading = heading;
    applySectionChanges(`Section renamed to '${heading}'.`);
  };

  const applyEditorToJson = () => {
    const section = getSelectedSection();
    if (!section) {
      setStatus("Select a section first.", true);
      return;
    }

    section.blocks = parseSectionBlocksFromEditor();

    markUnsaved();
    setStatus("Applied full section changes to JSON payload.");
  };

  if (isContentPage) {
    toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.getAttribute("data-editor-cmd");
        if (!command) {
          return;
        }
        if (richEditor) richEditor.focus();
        if (richEditor) document.execCommand(command, false);
      });
    });

    if (linkButton) {
      linkButton.addEventListener("click", () => {
        const url = window.prompt("Link URL:", "https://");
        if (!url) {
          return;
        }
        if (richEditor) richEditor.focus();
        if (richEditor) document.execCommand("createLink", false, url);
      });
    }

    if (imageButton) {
      imageButton.addEventListener("click", () => {
        window.open(
          "/admin/gallery?picker=1",
          "galleryPicker",
          "width=980,height=720",
        );
      });
    }
  }

  const handleHeroInput = () => {
    if (!heroEyebrow || !heroTitle || !heroIntro) return;
    const hero = getHeroData();
    hero.eyebrow = heroEyebrow.value;
    hero.title = heroTitle.value;
    hero.intro = heroIntro.value;
    markUnsaved();
    refreshPreview();
  };

  if (pageSelector) {
    pageSelector.addEventListener("change", () => {
      selectedSectionIndex = -1;
      refreshSectionList();
      renderSelectedSection();
      setStatus(`Page switched to '${getCurrentPageName()}'.`);
    });
  }
  if (reloadButton) reloadButton.addEventListener("click", loadFromJson);
  if (applyButton) applyButton.addEventListener("click", applyEditorToJson);
  if (sectionAddButton) sectionAddButton.addEventListener("click", addSection);
  if (sectionRenameButton)
    sectionRenameButton.addEventListener("click", renameSection);
  if (previewRefreshButton)
    previewRefreshButton.addEventListener("click", refreshPreview);
  if (saveBtn) saveBtn.addEventListener("click", saveContent);

  if (heroEyebrow) heroEyebrow.addEventListener("input", handleHeroInput);
  if (heroTitle) heroTitle.addEventListener("input", handleHeroInput);
  if (heroIntro) heroIntro.addEventListener("input", handleHeroInput);

  const metaInputs = [
    metaTitle,
    metaDescription,
    metaKeywords,
    ogTitle,
    ogDescription,
    ogType,
    ogSiteName,
    ogImage,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
    jsonldContext,
    jsonldType,
    jsonldName,
    jsonldDescription,
    jsonldImage,
    jsonldSameAs,
    footerSummary,
    footerLinks,
    footerCopyrightYear,
    footerCreditLabel,
    footerCreditUrl,
    footerCreditText,
  ].filter(Boolean);

  const handleMetaInput = () => {
    syncMetaFromFields();
    markUnsaved();
  };

  metaInputs.forEach((input) => {
    input.addEventListener("input", handleMetaInput);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const image = event.data?.galleryImage;
    if (!image?.filename || !richEditor) return;
    const alt = image.caption || "";
    richEditor.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<p><img src="/static/images/${escapeAttr(image.filename)}" alt="${escapeAttr(alt)}"></p>`,
    );
  });

  window.addEventListener("beforeunload", (e) => {
    if (unsavedBadge && unsavedBadge.classList.contains("visible")) {
      e.preventDefault();
    }
  });

  loadFromJson();
  initializeSidebarTracking();
})();
