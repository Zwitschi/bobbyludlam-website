from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import re

from flask import Flask, Response, render_template, request


MARKDOWN_COMMENT_PATTERN = re.compile(r"<!--.*?-->", re.DOTALL)
MARKDOWN_INLINE_PATTERN = re.compile(r"(!?)\[([^\]]*)\]\(([^)]*)\)")


def _placeholder_image_src(label: str) -> str:
    safe_label = label or "Image coming soon"
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" '
        'viewBox="0 0 1200 675">'
        '<rect width="100%" height="100%" fill="#0c1020"/>'
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" '
        'fill="#1e1b18" font-size="42" '
        'font-family="Georgia, Times New Roman, serif">'
        f"{safe_label}"
        "</text></svg>"
    )
    return f"data:image/svg+xml;charset=UTF-8,{quote(svg)}"


def _is_valid_image_src(src: str) -> bool:
    if not src:
        return False

    parsed = urlparse(src)
    return bool(parsed.scheme in {"http", "https", "data"} or src.startswith("/"))


def _parse_inline_markdown(text: str) -> list[dict[str, str]]:
    segments: list[dict[str, str]] = []
    cursor = 0

    for match in MARKDOWN_INLINE_PATTERN.finditer(text):
        if match.start() > cursor:
            segments.append(
                {"type": "text", "text": text[cursor: match.start()]})

        is_image = match.group(1) == "!"
        label = match.group(2)
        target = match.group(3).strip()

        if is_image:
            resolved_src = target if _is_valid_image_src(
                target) else _placeholder_image_src(label)
            segments.append(
                {
                    "type": "image",
                    "alt": label or "Image coming soon",
                    "src": resolved_src,
                }
            )
        else:
            segments.append({"type": "link", "text": label, "url": target})

        cursor = match.end()

    if cursor < len(text):
        segments.append({"type": "text", "text": text[cursor:]})

    if not segments:
        segments.append({"type": "text", "text": text})

    return segments


def _parse_markdown_content(file_path: Path) -> dict[str, object]:
    title = ""
    sections: list[dict[str, Any]] = []
    current_section: dict[str, Any] | None = None
    paragraph_lines: list[str] = []
    list_items: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph_lines
        if paragraph_lines and current_section is not None:
            current_section["blocks"].append(
                {
                    "type": "paragraph",
                    "segments": _parse_inline_markdown(" ".join(paragraph_lines)),
                }
            )
            paragraph_lines = []

    def flush_list() -> None:
        nonlocal list_items
        if list_items and current_section is not None:
            current_section["blocks"].append(
                {
                    "type": "list",
                    "items": [
                        _parse_inline_markdown(item)
                        for item in list_items
                    ],
                }
            )
            list_items = []

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line:
            flush_paragraph()
            flush_list()
            continue

        line = MARKDOWN_COMMENT_PATTERN.sub("", line).strip()

        if not line:
            continue

        if line.startswith("# "):
            title = line.removeprefix("# ").strip()
            continue

        if line.startswith("## "):
            flush_paragraph()
            flush_list()
            current_section = {"heading": line.removeprefix(
                "## ").strip(), "blocks": []}
            sections.append(current_section)
            continue

        if line.startswith("- "):
            flush_paragraph()
            list_items.append(line.removeprefix("- ").strip())
            continue

        image_match = MARKDOWN_INLINE_PATTERN.fullmatch(line)
        if image_match and image_match.group(1) == "!":
            flush_paragraph()
            flush_list()
            if current_section is None:
                continue
            current_section["blocks"].append(
                {
                    "type": "image",
                    "alt": image_match.group(2) or "Image coming soon",
                    "src": (
                        image_match.group(3).strip()
                        if _is_valid_image_src(image_match.group(3).strip())
                        else _placeholder_image_src(image_match.group(2))
                    ),
                }
            )
            continue

        paragraph_lines.append(line)

    flush_paragraph()
    flush_list()

    return {"title": title, "sections": sections}


def _load_site_content(app: Flask) -> dict[str, dict[str, object]]:
    project_root = Path(app.root_path).parent
    return {
        "biography": _parse_markdown_content(project_root / "biography.md"),
        "portfolio": _parse_markdown_content(project_root / "portfolio.md"),
        "contact": _parse_markdown_content(project_root / "contact.md"),
    }


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index() -> str:
        return render_template("index.html", content=_load_site_content(app))

    @app.get("/robots.txt")
    def robots() -> Response:
        return Response("User-agent: *\nDisallow: /\n", mimetype="text/plain")

    @app.get("/sitemap.xml")
    def sitemap() -> Response:
        site_url = request.url_root.rstrip("/")
        sitemap_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{site_url}/</loc>
  </url>
</urlset>
'''
        return Response(sitemap_xml, mimetype="application/xml")

    return app
