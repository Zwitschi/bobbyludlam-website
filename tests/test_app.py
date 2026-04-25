from run import app


def test_homepage_renders_content() -> None:
    client = app.test_client()

    response = client.get("/")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Bobby Ludlam" in html
    assert "Open Mic Odyssey" in html
    assert "thebobbyludlam" in html
    assert "<a href=\"https://openmicodyssey.com/\">Visit the official website</a>" in html
    assert "<a href=\"https://www.gofundme.com/f/support-bobby-ludlams-interdimensional-safe-space\">Support the project</a>" in html
    assert "#biography" in html
    assert "#portfolio" in html
    assert "#contact" in html
    assert "/static/images/bobby-ludlam-austin.jpg" in html
    assert "/static/images/safe_space_concept_03.png" in html
    assert "<!--" not in html


def test_robots_txt_disallows_indexing() -> None:
    client = app.test_client()

    response = client.get("/robots.txt")

    assert response.status_code == 200
    assert response.mimetype == "text/plain"
    assert response.get_data(as_text=True) == "User-agent: *\nDisallow: /\n"


def test_sitemap_lists_homepage() -> None:
    client = app.test_client()

    response = client.get("/sitemap.xml")
    xml = response.get_data(as_text=True)

    assert response.status_code == 200
    assert response.mimetype == "application/xml"
    assert "<loc>http://localhost/</loc>" in xml
