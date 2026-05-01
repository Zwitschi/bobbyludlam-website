(() => {
  const initialContentJson = document.getElementById("initial_content_json");
  const pageSelector = document.getElementById("page_selector");
  const sectionList = document.getElementById("section_list");
  const sectionHeading = document.getElementById("section_heading");
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
  const imageUploadInput = document.getElementById("image_upload_input");
  const imageGallery = document.getElementById("image_gallery");
  const uploadStatus = document.getElementById("upload_status");

  let contentData = null;
  let savedJson = initialContentJson.textContent.trim();
  let selectedSectionIndex = -1;
  let dragStartIndex = -1;
  let selectedImage = null;

  const setStatus = (message, isError = false) => {
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

  const markUnsaved = () => {
    const isDirty = serializeContent() !== savedJson;
    unsavedBadge.classList.toggle("visible", isDirty);
  };

  const setSaveStatus = (message, isError = false) => {
    saveStatus.textContent = message;
    saveStatus.style.color = isError ? "#b91c1c" : "#166534";
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
    let jsonText = serializeContent();

    // client-side validation
    let parsed;
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

    saveBtn.disabled = true;
    setSaveStatus("Saving…");

    try {
      const body = new URLSearchParams({ content_json: jsonText });
      const resp = await fetch("/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (resp.ok) {
        savedJson = jsonText;
        markUnsaved();
        setSaveStatus("Content saved.");
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

    Object.keys(contentData || {}).forEach((pageName) => {
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
      setStatus("Cannot load editor: invalid JSON payload.", true);
      return;
    }

    refreshPageSelector();
    selectedSectionIndex = -1;
    refreshSectionList();
    renderSelectedSection();
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

  toolbarButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.getAttribute("data-editor-cmd");
      if (!command) {
        return;
      }
      richEditor.focus();
      document.execCommand(command, false);
    });
  });

  linkButton.addEventListener("click", () => {
    const url = window.prompt("Link URL:", "https://");
    if (!url) {
      return;
    }
    richEditor.focus();
    document.execCommand("createLink", false, url);
  });

  imageButton.addEventListener("click", () => {
    openImageDialog();
  });

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
    closeButton.addEventListener("click", () => {
      document.body.removeChild(dialog);
    });

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
              richEditor.focus();
              document.execCommand(
                "insertHTML",
                false,
                `<p><img src="/static/images/${href}" alt="${escapeAttr(alt)}"></p>`,
              );
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

  pageSelector.addEventListener("change", () => {
    selectedSectionIndex = -1;
    refreshSectionList();
    renderSelectedSection();
    setStatus(`Page switched to '${getCurrentPageName()}'.`);
  });
  reloadButton.addEventListener("click", loadFromJson);
  applyButton.addEventListener("click", applyEditorToJson);
  sectionAddButton.addEventListener("click", addSection);
  sectionRenameButton.addEventListener("click", renameSection);
  saveBtn.addEventListener("click", saveContent);

  imageUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    uploadStatus.textContent = "Uploading...";

    fetch("/admin/upload", {
      method: "POST",
      body: formData,
      headers: {
        Authorization: "Basic " + btoa("admin:admin"),
      },
    })
      .then((resp) => {
        if (resp.ok) {
          uploadStatus.textContent = "Upload successful!";
          setTimeout(() => {
            uploadStatus.textContent = "";
          }, 2000);
          refreshImageGallery();
        } else {
          uploadStatus.textContent = "Upload failed.";
        }
      })
      .catch((err) => {
        uploadStatus.textContent = "Upload error: " + err.message;
      });
  });

  window.addEventListener("beforeunload", (e) => {
    if (unsavedBadge.classList.contains("visible")) {
      e.preventDefault();
    }
  });

  const refreshImageGallery = () => {
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
              richEditor.focus();
              document.execCommand(
                "insertHTML",
                false,
                `<p><img src="/static/images/${href}" alt="${escapeAttr(alt)}"></p>`,
              );
            });
            const item = document.createElement("div");
            item.className = "image-gallery-item";
            item.appendChild(img);
            imageGallery.appendChild(item);
          }
        });
      });
  };

  loadFromJson();
  refreshImageGallery();
})();
