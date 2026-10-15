from build_static_site import generate_static_site
import app.utils as app_utils
import json
from pathlib import Path
import sys

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_generate_static_site_writes_rendered_pages(tmp_path: Path) -> None:
    output_dir = tmp_path / "build"

    result = generate_static_site(output_dir)

    index_html = (result / "index.html").read_text(encoding="utf-8")
    robots_txt = (result / "robots.txt").read_text(encoding="utf-8")
    sitemap_xml = (result / "sitemap.xml").read_text(encoding="utf-8")

    assert result == output_dir
    assert (result / "static" / "css" / "site.css").exists()
    assert (result / "static" / "images" /
            "safe_space_concept_03.png").exists()
    assert not any((result / "static" / "images").glob("*_ludlam_austin.jpg"))
    assert (result / ".nojekyll").exists()
    assert "Bobby Ludlam" in index_html
    assert "Open Mic Odyssey" in index_html
    assert 'href="static/css/site.css"' in index_html
    assert 'static/images/bobby-ludlam-austin-1.jpg' in index_html
    assert '<iframe width="560" height="315" src="https://www.youtube.com/embed/KZcnEGG-WDw?si=HKPK1q2r4E3xFmyZ"' in index_html
    assert "&lt;iframe" not in index_html
    assert "User-agent: *" in robots_txt
    assert "<loc>https://bobbyludlam.com/</loc>" in sitemap_xml


def test_static_site_renders_markdown_from_current_json(
    tmp_path: Path,
    monkeypatch,
) -> None:
    content_file = tmp_path / "siteContent.json"
    content_file.write_text(
        json.dumps(
            {
                "hero": {"title": "Updated from JSON"},
                "biography": {
                    "title": "Biography",
                    "sections": [
                        {
                            "heading": "Generated Markdown",
                            "blocks": [
                                {
                                    "type": "paragraph",
                                    "segments": [
                                        {
                                            "type": "text",
                                            "text": "**Fresh content**",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        app_utils,
        "_site_content_path",
        lambda _: content_file,
    )

    result = generate_static_site(tmp_path / "build")
    index_html = (result / "index.html").read_text(encoding="utf-8")

    assert "Updated from JSON" in index_html
    assert "<strong>Fresh content</strong>" in index_html
