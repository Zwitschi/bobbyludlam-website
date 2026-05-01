import pytest
from run import app
import app as app_module
import json
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_editor_loads_json_into_memory(client):
    """Test that the admin page loads JSON content into memory."""
    headers = {"Authorization": "Basic YWRtaW46YWRtaW4="}
    response = client.get("/admin", headers=headers)
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "initial_content_json" in html
    assert "application/json" in html


def test_editor_displays_sections_list(client):
    """Test that the admin page displays sections list."""
    headers = {"Authorization": "Basic YWRtaW46YWRtaW4="}
    response = client.get("/admin", headers=headers)
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "section_list" in html


def test_editor_loads_section_into_editor(client):
    """Test that the admin page loads selected section into editor."""
    headers = {"Authorization": "Basic YWRtaW46YWRtaW4="}
    response = client.get("/admin", headers=headers)
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "rich_editor" in html


def test_editor_live_preview_updates(client):
    """Test that the admin page updates live preview."""
    headers = {"Authorization": "Basic YWRtaW46YWRtaW4="}
    response = client.get("/admin", headers=headers)
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "preview_frame" in html


def test_editor_save_writes_json(client, tmp_path, monkeypatch):
    """Test that the admin page saves updated JSON."""
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

    headers = {"Authorization": "Basic YWRtaW46YWRtaW4="}
    response = client.post(
        "/admin/save",
        data={"content_json": json.dumps(updated_content)},
        headers=headers,
    )

    assert response.status_code == 200
    assert "Content saved." in response.get_data(as_text=True)
    assert json.loads(content_file.read_text(
        encoding="utf-8")) == updated_content
