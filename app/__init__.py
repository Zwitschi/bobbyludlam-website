from pathlib import Path
from typing import Any

from flask import Flask, render_template


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
                {"type": "paragraph", "text": " ".join(paragraph_lines)}
            )
            paragraph_lines = []

    def flush_list() -> None:
        nonlocal list_items
        if list_items and current_section is not None:
            current_section["blocks"].append(
                {"type": "list", "items": list_items})
            list_items = []

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line:
            flush_paragraph()
            flush_list()
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

    return app
