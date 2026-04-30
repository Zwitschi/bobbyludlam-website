from pathlib import Path

from build_static_site import generate_static_site


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
    assert '<iframe width="560" height="315" src="https://www.youtube.com/embed/lcNPESVxiHs"' in index_html
    assert "&lt;iframe" not in index_html
    assert "User-agent: *" in robots_txt
    assert "<loc>https://bobbyludlam.com/</loc>" in sitemap_xml
