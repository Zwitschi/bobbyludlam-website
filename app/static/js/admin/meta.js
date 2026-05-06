/**
 * Admin Meta Page Logic
 * Metadata fields (basic, OG, Twitter, JSON-LD, footer), sync, serialize.
 */
(function () {
  // Only run on meta page
  if (!window.adminCommon || !window.adminCommon.isMetaPage) return;

  const { contentData, metaData, markUnsaved, refreshPreview } =
    window.adminCommon;

  // Elements
  const commonTitle = document.getElementById("common_title");
  const commonDescription = document.getElementById("common_description");
  const commonImage = document.getElementById("common_image");
  const metaKeywords = document.getElementById("meta_keywords");
  const ogType = document.getElementById("og_type");
  const ogSiteName = document.getElementById("og_site_name");
  const twitterCard = document.getElementById("twitter_card");
  const jsonldContext = document.getElementById("jsonld_context");
  const jsonldType = document.getElementById("jsonld_type");
  const jsonldSameAs = document.getElementById("jsonld_same_as");
  const footerSummary = document.getElementById("footer_summary");
  const footerLinks = document.getElementById("footer_links");
  const footerCopyrightYear = document.getElementById("footer_copyright_year");
  const footerCreditLabel = document.getElementById("footer_credit_label");
  const footerCreditUrl = document.getElementById("footer_credit_url");
  const footerCreditText = document.getElementById("footer_credit_text");

  // --- Utilities ---

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

  const ensureMetaSection = (key) => {
    if (
      !metaData[key] ||
      typeof metaData[key] !== "object" ||
      Array.isArray(metaData[key])
    ) {
      metaData[key] = {};
    }
    return metaData[key];
  };

  // --- Render ---

  const renderMetaFields = () => {
    if (!commonTitle) return;
    const common = ensureMetaSection("common");
    const openGraph = ensureMetaSection("open_graph");
    const twitter = ensureMetaSection("twitter");
    const jsonld = ensureMetaSection("jsonld");
    const footer = ensureMetaSection("footer");
    const credit =
      typeof footer.credit === "object" && footer.credit !== null
        ? footer.credit
        : (footer.credit = {});

    if (commonTitle) commonTitle.value = common.title || "";
    if (commonDescription) commonDescription.value = common.description || "";
    if (commonImage) commonImage.value = common.image || "";
    if (metaKeywords) metaKeywords.value = (metaData.keywords || []).join("\n");

    if (ogType) ogType.value = openGraph.type || "";
    if (ogSiteName) ogSiteName.value = openGraph.site_name || "";

    if (twitterCard) twitterCard.value = twitter.card || "";

    if (jsonldContext) jsonldContext.value = jsonld["@context"] || "";
    if (jsonldType) jsonldType.value = jsonld["@type"] || "";
    if (jsonldSameAs) jsonldSameAs.value = (jsonld.sameAs || []).join("\n");

    if (footerSummary) footerSummary.value = footer.summary || "";
    if (footerLinks) footerLinks.value = footerLinksToText(footer.links || []);
    if (footerCopyrightYear)
      footerCopyrightYear.value = footer.copyright_year || "";
    if (footerCreditLabel) footerCreditLabel.value = credit.label || "";
    if (footerCreditUrl) footerCreditUrl.value = credit.url || "";
    if (footerCreditText) footerCreditText.value = credit.text || "";
  };

  // --- Sync ---

  const syncMetaFromFields = () => {
    if (!commonTitle) return;
    const common = ensureMetaSection("common");
    const openGraph = ensureMetaSection("open_graph");
    const twitter = ensureMetaSection("twitter");
    const jsonld = ensureMetaSection("jsonld");
    const footer = ensureMetaSection("footer");
    const credit =
      typeof footer.credit === "object" && footer.credit !== null
        ? footer.credit
        : (footer.credit = {});

    if (commonTitle) common.title = commonTitle.value;
    if (commonDescription) common.description = commonDescription.value;
    if (commonImage) common.image = commonImage.value;

    // Propagate common values to other sections
    const commonTitleVal = commonTitle?.value || "";
    const commonDescVal = commonDescription?.value || "";
    const commonImageVal = commonImage?.value || "";

    metaData.title = commonTitleVal;
    metaData.description = commonDescVal;
    metaData.image = commonImageVal;
    if (metaKeywords) metaData.keywords = normalizeLines(metaKeywords.value);

    openGraph.title = commonTitleVal;
    openGraph.description = commonDescVal;
    if (ogType) openGraph.type = ogType.value;
    if (ogSiteName) openGraph.site_name = ogSiteName.value;
    openGraph.image = commonImageVal;

    twitter.card = twitterCard.value;
    twitter.title = commonTitleVal;
    twitter.description = commonDescVal;
    twitter.image = commonImageVal;

    jsonld["@context"] = jsonldContext.value;
    jsonld["@type"] = jsonldType.value;
    jsonld.name = commonTitleVal;
    jsonld.description = commonDescVal;
    jsonld.image = commonImageVal;
    if (jsonldSameAs) jsonld.sameAs = normalizeLines(jsonldSameAs.value);

    if (footerSummary) footer.summary = footerSummary.value;
    if (footerLinks) footer.links = parseFooterLinks(footerLinks.value);
    if (footerCopyrightYear)
      footer.copyright_year = Number(footerCopyrightYear.value) || 0;
    if (footerCreditLabel) credit.label = footerCreditLabel.value;
    if (footerCreditUrl) credit.url = footerCreditUrl.value;
    if (footerCreditText) credit.text = footerCreditText.value;
  };

  // --- Event Listeners ---

  const handleMetaInput = () => {
    syncMetaFromFields();
    markUnsaved();
  };

  const metaInputs = [
    commonTitle,
    commonDescription,
    commonImage,
    metaKeywords,
    ogType,
    ogSiteName,
    twitterCard,
    jsonldContext,
    jsonldType,
    jsonldSameAs,
    footerSummary,
    footerLinks,
    footerCopyrightYear,
    footerCreditLabel,
    footerCreditUrl,
    footerCreditText,
  ].filter(Boolean);

  metaInputs.forEach((input) => {
    input.addEventListener("input", handleMetaInput);
  });

  // --- Init ---

  renderMetaFields();
})();
