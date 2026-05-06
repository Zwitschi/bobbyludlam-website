(() => {
  const initialGalleryJson = document.getElementById("initial_gallery_json");
  const grid = document.getElementById("gallery_grid");
  const uploadInput = document.getElementById("gallery_upload_input");
  const uploadCaption = document.getElementById("gallery_upload_caption");
  const uploadStatus = document.getElementById("upload_status");
  const saveButton = document.getElementById("gallery_save");
  const saveStatus = document.getElementById("gallery_status");
  const unsavedBadge = document.getElementById("unsaved_badge");

  let gallery = { images: [] };
  let savedJson = "{}";
  let dragStartIndex = -1;
  const pickerMode = new URLSearchParams(window.location.search).has("picker");

  const setStatus = (message, isError = false) => {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.style.color = isError ? "#b91c1c" : "#166534";
  };

  const serializeGallery = () => JSON.stringify(gallery, null, 2);

  const markUnsaved = () => {
    const isDirty = serializeGallery() !== savedJson;
    if (unsavedBadge) unsavedBadge.classList.toggle("visible", isDirty);
    if (saveButton) saveButton.classList.toggle("unsaved", isDirty);
  };

  const imageUrl = (filename) =>
    `/static/images/${encodeURIComponent(filename).replaceAll("%2F", "/")}`;

  const renderGallery = () => {
    if (!grid) return;
    grid.innerHTML = "";
    for (const [index, image] of (gallery.images || []).entries()) {
      const item = document.createElement("article");
      item.className = "image-gallery-item gallery-editor-item";
      item.draggable = true;

      const img = document.createElement("img");
      img.src = imageUrl(image.filename);
      img.alt = image.caption || image.filename;
      img.addEventListener("click", () => {
        if (!pickerMode || !window.opener) return;
        window.opener.postMessage({ galleryImage: image }, window.location.origin);
        window.close();
      });

      const caption = document.createElement("textarea");
      caption.rows = 2;
      caption.value = image.caption || "";
      caption.placeholder = "Caption";
      caption.addEventListener("input", () => {
        image.caption = caption.value;
        markUnsaved();
      });

      const actions = document.createElement("div");
      actions.className = "gallery-item-actions";

      const filename = document.createElement("span");
      filename.textContent = image.filename;

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteImage(image.filename));

      actions.append(filename, del);
      item.append(img, caption, actions);

      item.addEventListener("dragstart", (event) => {
        dragStartIndex = index;
        event.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        if (dragStartIndex < 0 || dragStartIndex === index) return;
        const [moved] = gallery.images.splice(dragStartIndex, 1);
        gallery.images.splice(index, 0, moved);
        dragStartIndex = -1;
        renderGallery();
        markUnsaved();
      });

      grid.appendChild(item);
    }
  };

  const saveGallery = async () => {
    if (!saveButton) return;
    saveButton.disabled = true;
    setStatus("Saving...");
    try {
      const response = await fetch("/admin/gallery/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gallery),
      });
      if (!response.ok) {
        setStatus(`Save failed: ${response.status}`, true);
        return;
      }
      const data = await response.json();
      gallery = data.gallery || gallery;
      savedJson = serializeGallery();
      markUnsaved();
      renderGallery();
      setStatus("Gallery saved.");
    } catch (error) {
      setStatus(`Save failed: ${error.message}`, true);
    } finally {
      saveButton.disabled = false;
    }
  };

  const deleteImage = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      const response = await fetch(`/admin/gallery/delete/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setStatus(`Delete failed: ${response.status}`, true);
        return;
      }
      const data = await response.json();
      gallery = data.gallery || gallery;
      savedJson = serializeGallery();
      renderGallery();
      markUnsaved();
      setStatus("Image deleted.");
    } catch (error) {
      setStatus(`Delete failed: ${error.message}`, true);
    }
  };

  if (uploadInput) {
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", uploadCaption?.value || "");
      if (uploadStatus) uploadStatus.textContent = "Uploading...";

      try {
        const response = await fetch("/admin/gallery/upload", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          if (uploadStatus) uploadStatus.textContent = "Upload failed.";
          return;
        }
        const data = await response.json();
        gallery = data.gallery || gallery;
        savedJson = serializeGallery();
        renderGallery();
        markUnsaved();
        uploadInput.value = "";
        if (uploadCaption) uploadCaption.value = "";
        if (uploadStatus) uploadStatus.textContent = "Upload complete.";
      } catch (error) {
        if (uploadStatus) uploadStatus.textContent = `Upload failed: ${error.message}`;
      }
    });
  }

  if (saveButton) saveButton.addEventListener("click", saveGallery);

  try {
    gallery = JSON.parse(initialGalleryJson?.textContent.trim() || "{}");
    if (!Array.isArray(gallery.images)) gallery.images = [];
  } catch {
    gallery = { images: [] };
  }
  savedJson = serializeGallery();
  renderGallery();
  markUnsaved();

  if (pickerMode) {
    document.body.classList.add("gallery-picker-mode");
    setStatus("Click an image to insert it into the content editor.");
  }
})();
