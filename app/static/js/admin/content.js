/**
 * Admin Content Page Logic
 * Hero fields, sections editor, rich text, page selector, image gallery.
 */
(function () {
  // Only run on content page
  if (!window.adminCommon || !window.adminCommon.isContentPage) return;

  const common = window.adminCommon;

  // Elements
  const pageSelector = document.getElementById("page_selector");
  const sectionList = document.getElementById("section_list");
  const sectionHeading = document.getElementById("section_heading");
  const heroEyebrow = document.getElementById("hero_eyebrow");
  const heroTitle = document.getElementById("hero_title");
  const heroIntro = document.getElementById("hero_intro");
  const richEditor = document.getElementById("rich_editor");
  const status = document.getElementById("editor_status");
  const applyButton = document.getElementById("editor_apply");
  const reloadButton = document.getElementById("editor_reload");
  const linkButton = document.getElementById("editor_link");
  const imageButton = document.getElementById("editor_image");
  const sectionAddButton = document.getElementById("section_add");
  const sectionRenameButton = document.getElementById("section_rename");
  const toolbarButtons = document.querySelectorAll("[data-editor-cmd]");
  const imageUploadInput = document.getElementById("image_upload_input");
  const imageGallery = document.getElementById("image_gallery");
  const uploadStatus = document.getElementById("upload_status");

  let selectedSectionIndex = -1;
  let dragStartIndex = -1;
  let selectedImage = null;

  // --- Utilities ---

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
    if (node.nodeType !== Node.ELEMENT_NODE) return [];

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
    if (element.tagName === "BR") return [{ type: "text", text: "\n" }];

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
      if (segment.type === "text") return segment.text.length > 0;
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

  // --- Hero ---

  const getHeroData = () => {
    if (
      !common.contentData.hero ||
      typeof common.contentData.hero !== "object"
    ) {
      common.contentData.hero = {};
    }
    return common.contentData.hero;
  };

  const renderHeroFields = () => {
    if (!heroEyebrow || !heroTitle || !heroIntro) return;
    const hero = getHeroData();
    heroEyebrow.value = hero.eyebrow || "";
    heroTitle.value = hero.title || "";
    heroIntro.value = hero.intro || "";
  };

  const handleHeroInput = () => {
    if (!heroEyebrow || !heroTitle || !heroIntro) return;
    const hero = getHeroData();
    hero.eyebrow = heroEyebrow.value;
    hero.title = heroTitle.value;
    hero.intro = heroIntro.value;
    common.markUnsaved();
    common.refreshPreview();
  };

  if (heroEyebrow) heroEyebrow.addEventListener("input", handleHeroInput);
  if (heroTitle) heroTitle.addEventListener("input", handleHeroInput);
  if (heroIntro) heroIntro.addEventListener("input", handleHeroInput);

  // --- Page & Sections ---

  const getCurrentPageName = () => pageSelector?.value || "";

  const getCurrentSections = () => {
    const pageName = getCurrentPageName();
    return common.contentData?.[pageName]?.sections || [];
  };

  const getSelectedSection = () => {
    const pageName = getCurrentPageName();
    const sections = common.contentData?.[pageName]?.sections || [];
    if (selectedSectionIndex < 0 || selectedSectionIndex >= sections.length) {
      return null;
    }
    return sections[selectedSectionIndex];
  };

  const refreshPageSelector = () => {
    if (!pageSelector) return;
    const previous = pageSelector.value;
    pageSelector.innerHTML = "";

    Object.entries(common.contentData || {}).forEach(([pageName, pageData]) => {
      if (!pageData || !Array.isArray(pageData.sections)) return;
      const option = document.createElement("option");
      option.value = pageName;
      option.textContent = pageName;
      pageSelector.appendChild(option);
    });

    if (previous && common.contentData?.[previous]) {
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

    if (!sectionList) return;
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
      label.textContent = `${index + 1}. ${section.heading || "Untitled section"}`;

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
        if (sectionHeading)
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
      li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        if (dragStartIndex < 0 || dragStartIndex === index) return;
        const pageName = getCurrentPageName();
        const pageSections = common.contentData[pageName].sections;
        const [moved] = pageSections.splice(dragStartIndex, 1);
        pageSections.splice(index, 0, moved);
        selectedSectionIndex = index;
        dragStartIndex = -1;
        applySectionChanges("Section order updated.");
      });

      sectionList.appendChild(li);
    });

    if (sectionHeading) {
      sectionHeading.value =
        selectedSectionIndex >= 0
          ? sections[selectedSectionIndex]?.heading || ""
          : "";
    }
  };

  // --- Rich Editor ---

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
    if (!richEditor) return blocks;
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
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

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

  const renderSelectedSection = () => {
    const section = getSelectedSection();
    if (!section || !richEditor) {
      if (richEditor) richEditor.innerHTML = "";
      setStatus("Select a section to edit its full content.", true);
      return;
    }
    richEditor.innerHTML = sectionBlocksToHtml(section.blocks || []);
    setStatus(`Editing full section: ${section.heading || "Untitled section"}`);
  };

  const applySectionChanges = (message) => {
    common.markUnsaved();
    refreshSectionList();
    renderSelectedSection();
    setStatus(message);
    common.refreshPreview();
  };

  const applyEditorToJson = () => {
    const section = getSelectedSection();
    if (!section) {
      setStatus("Select a section first.", true);
      return;
    }
    section.blocks = parseSectionBlocksFromEditor();
    common.markUnsaved();
    setStatus("Applied full section changes to JSON payload.");
  };

  const addSection = () => {
    const pageName = getCurrentPageName();
    if (!pageName || !common.contentData?.[pageName]) {
      setStatus("Select page before adding section.", true);
      return;
    }
    const newHeading = sectionHeading?.value.trim() || "New Section";
    common.contentData[pageName].sections =
      common.contentData[pageName].sections || [];
    common.contentData[pageName].sections.push({
      heading: newHeading,
      blocks: [{ type: "paragraph", segments: [{ type: "text", text: "" }] }],
    });
    selectedSectionIndex = common.contentData[pageName].sections.length - 1;
    applySectionChanges(`Section '${newHeading}' added.`);
  };

  const renameSection = () => {
    const sections = getCurrentSections();
    const idx = selectedSectionIndex;
    if (idx < 0 || idx >= sections.length) {
      setStatus("Select section to rename.", true);
      return;
    }
    const heading = sectionHeading?.value.trim();
    if (!heading) {
      setStatus("Section heading cannot be empty.", true);
      return;
    }
    sections[idx].heading = heading;
    applySectionChanges(`Section renamed to '${heading}'.`);
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

  // --- Image Dialog ---

  const openImageDialog = () => {
    const dialog = document.createElement("div");
    dialog.className = "image-dialog active";
    dialog.innerHTML = `
      <div class="image-dialog-content">
        <div class="image-dialog-header">
          <h3>Insert Image</h3>
          <button type="button" class="image-dialog-close">Close</button>
        </div>
        <div class="image-dialog-grid" id="image_dialog_grid"></div>
      </div>
    `;
    document.body.appendChild(dialog);

    const closeButton = dialog.querySelector(".image-dialog-close");
    closeButton.addEventListener("click", () =>
      document.body.removeChild(dialog),
    );

    const grid = dialog.querySelector("#image_dialog_grid");
    fetch("/static/images/")
      .then((resp) => resp.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = doc.querySelectorAll("a");
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (
            href &&
            (href.endsWith(".jpg") ||
              href.endsWith(".png") ||
              href.endsWith(".gif"))
          ) {
            const img = document.createElement("img");
            img.src = "/static/images/" + href;
            img.alt = href;
            img.style.cursor = "pointer";
            img.addEventListener("click", () => {
              const alt = window.prompt("Image alt text:", "") || "";
              if (richEditor) {
                richEditor.focus();
                document.execCommand(
                  "insertHTML",
                  false,
                  `<p><img src="/static/images/${href}" alt="${escapeAttr(alt)}"></p>`,
                );
              }
              document.body.removeChild(dialog);
            });
            const item = document.createElement("div");
            item.className = "image-dialog-grid-item";
            item.appendChild(img);
            grid.appendChild(item);
          }
        });
      });
  };

  // --- Toolbar & Event Listeners ---

  if (toolbarButtons) {
    toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.getAttribute("data-editor-cmd");
        if (!command) return;
        if (richEditor) richEditor.focus();
        if (richEditor) document.execCommand(command, false);
      });
    });
  }

  if (linkButton) {
    linkButton.addEventListener("click", () => {
      const url = window.prompt("Link URL:", "https://");
      if (!url) return;
      if (richEditor) richEditor.focus();
      if (richEditor) document.execCommand("createLink", false, url);
    });
  }

  if (imageButton) {
    imageButton.addEventListener("click", openImageDialog);
  }

  if (reloadButton) {
    reloadButton.addEventListener("click", () => {
      renderSelectedSection();
      setStatus("Section reloaded from JSON.");
    });
  }

  if (applyButton) {
    applyButton.addEventListener("click", applyEditorToJson);
  }

  if (sectionAddButton) {
    sectionAddButton.addEventListener("click", addSection);
  }

  if (sectionRenameButton) {
    sectionRenameButton.addEventListener("click", renameSection);
  }

  if (pageSelector) {
    pageSelector.addEventListener("change", () => {
      selectedSectionIndex = -1;
      refreshSectionList();
      renderSelectedSection();
      setStatus(`Page switched to '${getCurrentPageName()}'.`);
    });
  }

  // --- Image Upload ---

  if (imageUploadInput) {
    imageUploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      if (uploadStatus) uploadStatus.textContent = "Uploading...";

      fetch("/admin/upload", {
        method: "POST",
        body: formData,
        headers: { Authorization: "Basic " + btoa("admin:admin") },
      })
        .then((resp) => {
          if (resp.ok) {
            if (uploadStatus) uploadStatus.textContent = "Upload successful!";
            setTimeout(() => {
              if (uploadStatus) uploadStatus.textContent = "";
            }, 2000);
            refreshImageGallery();
          } else {
            if (uploadStatus) uploadStatus.textContent = "Upload failed.";
          }
        })
        .catch((err) => {
          if (uploadStatus)
            uploadStatus.textContent = "Upload error: " + err.message;
        });
    });
  }

  const refreshImageGallery = () => {
    if (!imageGallery) return;
    fetch("/static/images/")
      .then((resp) => resp.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = doc.querySelectorAll("a");
        imageGallery.innerHTML = "";
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (
            href &&
            (href.endsWith(".jpg") ||
              href.endsWith(".png") ||
              href.endsWith(".gif"))
          ) {
            const img = document.createElement("img");
            img.src = "/static/images/" + href;
            img.alt = href;
            img.style.cursor = "pointer";
            img.addEventListener("click", () => {
              const alt = window.prompt("Image alt text:", "") || "";
              if (richEditor) {
                richEditor.focus();
                document.execCommand(
                  "insertHTML",
                  false,
                  `<p><img src="/static/images/${href}" alt="${escapeAttr(alt)}"></p>`,
                );
              }
            });
            const item = document.createElement("div");
            item.className = "image-gallery-item";
            item.appendChild(img);
            imageGallery.appendChild(item);
          }
        });
      });
  };

  // --- Init ---

  try {
    renderHeroFields();
    refreshPageSelector();
    selectedSectionIndex = -1;
    refreshSectionList();
    renderSelectedSection();
    refreshImageGallery();
  } catch (err) {
    console.error("content.js init error:", err);
  }
})();
