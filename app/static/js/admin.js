/**
 * Admin Entry Point (Legacy)
 * Auto-detects page type and loads modular scripts.
 * New pages should use direct script includes.
 */
(function () {
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
  const isGalleryPage = !!document.getElementById("admin-gallery");

  const loadScript = (src) => {
    const s = document.createElement("script");
    s.src = "/static/js/" + src;
    document.head.appendChild(s);
  };

  if (isContentPage) {
    loadScript("admin/common.js");
    loadScript("admin/content.js");
  } else if (isMetaPage) {
    loadScript("admin/common.js");
    loadScript("admin/meta.js");
  } else if (isGalleryPage) {
    loadScript("admin/common.js");
    loadScript("admin/gallery.js");
  }
})();
