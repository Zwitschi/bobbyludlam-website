from run import app
import app as app_module
import base64
import json
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))


def _basic_auth_header(username: str = "admin", password: str = "admin") -> dict[str, str]:
    token = base64.b64encode(
        f"{username}:{password}".encode("utf-8")).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def test_homepage_renders_content() -> None:
    client = app.test_client()

    response = client.get("/")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Bobby Ludlam" in html
    assert "Open Mic Odyssey" in html
    assert "thebobbyludlam" in html
    assert '<a href="https://openmicodyssey.com/" target="_blank" rel="noopener noreferrer">Visit the official website</a>' in html
    assert '<a href="https://www.gofundme.com/f/support-bobby-ludlams-interdimensional-safe-space" target="_blank" rel="noopener noreferrer">Support the project</a>' in html
    assert "#biography" in html
    assert "#portfolio" in html
    assert "#contact" in html
    assert "/static/images/bobby-ludlam-austin-1.jpg" in html
    assert "bobby_ludlam_austin" not in html
    assert "/static/images/safe_space_concept_03.png" in html
    assert '<iframe width="560" height="315" src="https://www.youtube.com/embed/lcNPESVxiHs"' in html
    assert "&lt;iframe" not in html
    assert "<!--" not in html


def test_homepage_renders_hero_content_from_json(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    content_file.write_text(
        json.dumps(
            {
                "hero": {
                    "eyebrow": "Custom eyebrow",
                    "title": "Custom hero title",
                    "intro": "Custom intro copy.",
                },
                "biography": {"title": "Biography", "sections": []},
                "portfolio": {"title": "Portfolio", "sections": []},
                "contact": {"title": "Contact", "sections": []},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)

    client = app.test_client()
    response = client.get("/")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Custom eyebrow" in html
    assert "Custom hero title" in html
    assert "Custom intro copy." in html
    assert '#hero' not in html
    assert '>Hero<' not in html


def test_homepage_renders_footer_from_site_meta(tmp_path, monkeypatch) -> None:
    meta_file = tmp_path / "siteMeta.json"
    meta_file.write_text(
        json.dumps(
            {
                "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
                "description": "Meta description",
                "keywords": ["Bobby Ludlam"],
                "open_graph": {
                    "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
                    "description": "Meta description",
                    "type": "website",
                    "site_name": "Bobby Ludlam",
                    "image": "images/bobby-ludlam-austin-1.jpg"
                },
                "twitter": {
                    "card": "summary_large_image",
                    "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
                    "description": "Meta description",
                    "image": "images/bobby-ludlam-austin-1.jpg"
                },
                "jsonld": {
                    "@context": "https://schema.org",
                    "@type": "Person",
                    "name": "Bobby Ludlam",
                    "description": "Meta description",
                    "image": "images/bobby-ludlam-austin-1.jpg",
                    "sameAs": [
                        "https://www.instagram.com/thebobbyludlam/",
                        "https://bobbyludlam.com/"
                    ]
                },
                "footer": {
                    "summary": "Custom footer summary.",
                    "links": [
                        {
                            "label": "Custom Instagram",
                            "url": "https://example.com/instagram"
                        },
                        {
                            "label": "Custom Site",
                            "url": "https://example.com/site"
                        }
                    ],
                    "copyright_year": 2030,
                    "credit": {
                        "label": "Custom Credit",
                        "url": "https://example.com/credit",
                        "text": "custom credit text"
                    }
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(app_module, "_site_meta_path", lambda _: meta_file)

    client = app.test_client()
    response = client.get("/")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Custom footer summary." in html
    assert "Custom Instagram" in html
    assert "https://example.com/instagram" in html
    assert "Custom Site" in html
    assert "https://example.com/site" in html
    assert "&copy; 2030" in html
    assert "Custom Credit" in html
    assert "custom credit text" in html


def test_admin_preview_ignores_hero_as_page_section() -> None:
    client = app.test_client()
    payload = {
        "hero": {
            "eyebrow": "Preview eyebrow",
            "title": "Preview title",
            "intro": "Preview intro",
        },
        "biography": {"title": "Biography", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }

    response = client.post(
        "/admin/preview",
        data=json.dumps(payload),
        content_type="application/json",
        headers=_basic_auth_header(),
    )
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Preview eyebrow" in html
    assert "Preview title" in html
    assert "Preview intro" in html
    assert '#hero' not in html
    assert '>Hero<' not in html


def test_robots_txt_disallows_indexing() -> None:
    client = app.test_client()

    response = client.get("/robots.txt")

    assert response.status_code == 200
    assert response.mimetype == "text/plain"
    assert response.get_data(as_text=True) == "User-agent: *\nAllow: /\n"


def test_sitemap_lists_homepage() -> None:
    client = app.test_client()

    response = client.get("/sitemap.xml")
    xml = response.get_data(as_text=True)

    assert response.status_code == 200
    assert response.mimetype == "application/xml"
    assert "<loc>http://localhost/</loc>" in xml


def test_admin_routes_exist() -> None:
    client = app.test_client()

    headers = _basic_auth_header()
    dashboard = client.get("/admin", headers=headers)
    page_edit = client.get("/admin/biography", headers=headers)

    assert dashboard.status_code == 200
    assert "Admin Dashboard" in dashboard.get_data(as_text=True)
    assert "initial_meta_json" in dashboard.get_data(as_text=True)
    assert "site_meta_editor" in dashboard.get_data(as_text=True)
    assert page_edit.status_code == 200


def test_admin_routes_require_auth() -> None:
    client = app.test_client()

    dashboard = client.get("/admin")
    save = client.post("/admin/save", data={"content_json": "{}"})

    assert dashboard.status_code == 401
    assert save.status_code == 401


def test_admin_save_updates_json_content(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    meta_file = tmp_path / "siteMeta.json"
    initial_content = {
        "biography": {"title": "Biography", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    initial_meta = {"title": "Initial title"}
    updated_content = {
        "biography": {"title": "Bio Updated", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    updated_meta = {"title": "Updated title",
                    "footer": {"summary": "Updated footer"}}
    content_file.write_text(json.dumps(initial_content), encoding="utf-8")
    meta_file.write_text(json.dumps(initial_meta), encoding="utf-8")
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)
    monkeypatch.setattr(app_module, "_site_meta_path",
                        lambda _: meta_file)

    client = app.test_client()
    response = client.post(
        "/admin/save",
        data={
            "content_json": json.dumps(updated_content),
            "meta_json": json.dumps(updated_meta),
        },
        headers=_basic_auth_header(),
    )

    assert response.status_code == 200
    assert "Content and metadata saved." in response.get_data(as_text=True)
    assert json.loads(content_file.read_text(
        encoding="utf-8")) == updated_content
    assert json.loads(meta_file.read_text(
        encoding="utf-8")) == updated_meta


def test_admin_save_rejects_invalid_meta_json(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    meta_file = tmp_path / "siteMeta.json"
    initial_content = {
        "biography": {"title": "Biography", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    initial_meta = {"title": "Initial title"}
    content_file.write_text(json.dumps(initial_content), encoding="utf-8")
    meta_file.write_text(json.dumps(initial_meta), encoding="utf-8")
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)
    monkeypatch.setattr(app_module, "_site_meta_path",
                        lambda _: meta_file)

    client = app.test_client()
    response = client.post(
        "/admin/save",
        data={
            "content_json": json.dumps(initial_content),
            "meta_json": "{bad-json}",
        },
        headers=_basic_auth_header(),
    )

    assert response.status_code == 400
    assert "Invalid metadata JSON:" in response.get_data(as_text=True)
    assert json.loads(meta_file.read_text(encoding="utf-8")) == initial_meta


def test_admin_save_rejects_invalid_json(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    initial_content = {
        "biography": {"title": "Biography", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    content_file.write_text(json.dumps(initial_content), encoding="utf-8")
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)

    client = app.test_client()
    response = client.post(
        "/admin/save",
        data={"content_json": "{bad-json}"},
        headers=_basic_auth_header(),
    )

    assert response.status_code == 400
    assert "Invalid JSON:" in response.get_data(as_text=True)
    assert json.loads(content_file.read_text(
        encoding="utf-8")) == initial_content


def test_admin_preview_requires_auth() -> None:
    client = app.test_client()

    response = client.post(
        "/admin/preview",
        data=json.dumps({"biography": {"title": "Bio", "sections": []}}),
        content_type="application/json",
    )

    assert response.status_code == 401


def test_admin_preview_renders_html() -> None:
    client = app.test_client()
    payload = {
        "biography": {
            "title": "Biography",
            "sections": [
                {
                    "heading": "Preview Section",
                    "blocks": [
                        {
                            "type": "paragraph",
                            "segments": [{"type": "text", "text": "Preview text content."}],
                        }
                    ],
                }
            ],
        },
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }

    response = client.post(
        "/admin/preview",
        data=json.dumps(payload),
        content_type="application/json",
        headers=_basic_auth_header(),
    )
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert response.mimetype == "text/html"
    assert "Preview Section" in html
    assert "Preview text content." in html


def test_admin_preview_rejects_invalid_json() -> None:
    client = app.test_client()

    response = client.post(
        "/admin/preview",
        data="not-json-at-all",
        content_type="application/json",
        headers=_basic_auth_header(),
    )

    assert response.status_code == 400


def test_admin_preview_rejects_non_object_root() -> None:
    client = app.test_client()

    response = client.post(
        "/admin/preview",
        data=json.dumps([1, 2, 3]),
        content_type="application/json",
        headers=_basic_auth_header(),
    )

    assert response.status_code == 400


def test_admin_save_rejects_non_object_root(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    initial_content = {
        "biography": {"title": "Biography", "sections": []},
    }
    content_file.write_text(json.dumps(initial_content), encoding="utf-8")
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)

    client = app.test_client()
    response = client.post(
        "/admin/save",
        data={"content_json": json.dumps([1, 2, 3])},
        headers=_basic_auth_header(),
    )

    assert response.status_code == 400
    assert json.loads(content_file.read_text(
        encoding="utf-8")) == initial_content
