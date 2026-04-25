from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from run import app


def _relativize_static_urls(html: str) -> str:
    return html.replace('"/static/', '"static/')


def generate_static_site(
    output_dir: Path | str = "build",
    *,
    site_url: str = "http://localhost",
    clean: bool = True,
) -> Path:
    output_path = Path(output_dir)

    if clean and output_path.exists():
        shutil.rmtree(output_path)

    output_path.mkdir(parents=True, exist_ok=True)

    client = app.test_client()
    pages = {
        "/": "index.html",
        "/robots.txt": "robots.txt",
        "/sitemap.xml": "sitemap.xml",
    }

    for route, filename in pages.items():
        response = client.get(route, base_url=site_url)
        page_html = response.get_data(as_text=True)
        if filename.endswith(".html"):
            page_html = _relativize_static_urls(page_html)

        (output_path / filename).write_text(page_html, encoding="utf-8")

    static_source = Path(app.root_path) / "static"
    static_target = output_path / "static"
    shutil.copytree(static_source, static_target, dirs_exist_ok=True)

    (output_path / ".nojekyll").write_text("", encoding="utf-8")

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a static export of the Bobby Ludlam website."
    )
    parser.add_argument(
        "--output",
        default="build",
        type=Path,
        help="Directory to write the static site into.",
    )
    parser.add_argument(
        "--site-url",
        default="http://localhost",
        help="Base URL used when rendering sitemap.xml.",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Keep existing files in the output directory.",
    )
    args = parser.parse_args()

    generate_static_site(
        args.output,
        site_url=args.site_url,
        clean=not args.no_clean,
    )


if __name__ == "__main__":
    main()
