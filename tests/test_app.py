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
    assert page_edit.status_code == 200


def test_admin_routes_require_auth() -> None:
    client = app.test_client()

    dashboard = client.get("/admin")
    save = client.post("/admin/save", data={"content_json": "{}"})

    assert dashboard.status_code == 401
    assert save.status_code == 401


def test_admin_save_updates_json_content(tmp_path, monkeypatch) -> None:
    content_file = tmp_path / "siteContent.json"
    initial_content = {
        "biography": {"title": "Biography", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    updated_content = {
        "biography": {"title": "Bio Updated", "sections": []},
        "portfolio": {"title": "Portfolio", "sections": []},
        "contact": {"title": "Contact", "sections": []},
    }
    content_file.write_text(json.dumps(initial_content), encoding="utf-8")
    monkeypatch.setattr(app_module, "_site_content_path",
                        lambda _: content_file)

    client = app.test_client()
    response = client.post(
        "/admin/save",
        data={"content_json": json.dumps(updated_content)},
        headers=_basic_auth_header(),
    )

    assert response.status_code == 200
    assert "Content saved." in response.get_data(as_text=True)
    assert json.loads(content_file.read_text(
        encoding="utf-8")) == updated_content


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
