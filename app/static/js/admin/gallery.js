/**
 * Admin Gallery Page Logic
 * Image upload, grid display, captions, delete.
 */
(function () {
  // Only run on gallery page
  const galleryContainer = document.getElementById("admin-gallery-grid");
  if (!galleryContainer) return;

  // Elements
  const imageUploadInput = document.getElementById("image_upload_input");
  const imageGallery = document.getElementById("gallery_grid");
  const uploadStatus = document.getElementById("upload_status");

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
            // Reload gallery data from server
            location.reload();
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

  // --- Image Grid ---

  const initialGalleryJson = document.getElementById("initial_gallery_json");
  let galleryData = null;

  if (initialGalleryJson) {
    try {
      galleryData = JSON.parse(initialGalleryJson.textContent.trim());
    } catch (e) {
      galleryData = { images: [] };
    }
  } else {
    galleryData = { images: [] };
  }

  const refreshImageGallery = () => {
    if (!imageGallery) return;
    imageGallery.innerHTML = "";

    const images = galleryData?.images || [];
    images.forEach((item) => {
      const filename = item.filename;
      if (!filename) return;

      const div = document.createElement("div");
      div.className = "image-gallery-item";

      const img = document.createElement("img");
      img.src = "/static/images/" + filename;
      img.alt = item.caption || filename;
      div.appendChild(img);

      const caption = document.createElement("input");
      caption.type = "text";
      caption.className = "gallery-caption";
      caption.placeholder = "Add caption...";
      caption.value = item.caption || "";
      caption.dataset.filename = filename;
      caption.addEventListener("input", () => {
        const idx = images.findIndex((i) => i.filename === filename);
        if (idx >= 0) images[idx].caption = caption.value;
      });
      div.appendChild(caption);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "gallery-delete";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Delete image";
      deleteBtn.addEventListener("click", () => deleteImage(filename, div));
      div.appendChild(deleteBtn);

      imageGallery.appendChild(div);
    });
  };

  const deleteImage = (filename, item) => {
    if (!window.confirm(`Delete image "${filename}"?`)) return;
    // TODO: Implement DELETE endpoint
    item.remove();
  };

  // --- Init ---

  refreshImageGallery();
})();
