import json
import os
from pathlib import Path

from flask import Flask, Response, render_template, request, url_for
ALLOW_ROBOTS = True


def _site_content_path(app: Flask) -> Path:
    return Path(app.root_path) / "content" / "siteContent.json"


def _create_robots_txt() -> str:
    if ALLOW_ROBOTS:
        return "User-agent: *\nAllow: /\n"
    else:
        return "User-agent: *\nDisallow: /\n"


def _load_site_content(app: Flask) -> dict[str, dict[str, object]]:
    content_path = _site_content_path(app)
    raw_content = content_path.read_text(encoding="utf-8")

    data = json.loads(raw_content)
    return data


def _save_site_content(app: Flask, content: dict[str, object]) -> None:
    content_path = _site_content_path(app)
    content_path.write_text(
        json.dumps(content, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def get_static_file_url(filename: str) -> str:
    return url_for('static', filename=filename)


def static_files(app: Flask) -> list[str]:
    """Return a list of all static file URLs for sitemap"""
    static_dir = Path(app.root_path) / "static"
    urls = []
    for file_path in static_dir.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(static_dir).as_posix()
            urls.append(get_static_file_url(relative_path))
    return urls


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["ADMIN_USERNAME"] = os.getenv("ADMIN_USERNAME", "admin")
    app.config["ADMIN_PASSWORD"] = os.getenv("ADMIN_PASSWORD", "admin")

    def _admin_unauthorized() -> Response:
        return Response(
            "Authentication required.",
            status=401,
            headers={"WWW-Authenticate": 'Basic realm="Admin"'},
            mimetype="text/plain",
        )

    def _is_admin_authenticated() -> bool:
        auth = request.authorization
        return bool(
            auth
            and auth.type == "basic"
            and auth.username == app.config["ADMIN_USERNAME"]
            and auth.password == app.config["ADMIN_PASSWORD"]
        )

    @app.get("/")
    def index() -> str:
        return render_template("index.html", content=_load_site_content(app))

    @app.get("/robots.txt")
    def robots() -> Response:
        return Response(_create_robots_txt(), mimetype="text/plain")

    @app.get("/admin")
    def admin_dashboard() -> Response | str:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content = _load_site_content(app)
        return render_template(
            "admin/index.html",
            content=content,
            content_json=json.dumps(content, indent=2, ensure_ascii=False),
            save_message=None,
            save_error=False,
        )

    @app.post("/admin/save")
    def admin_save() -> Response | tuple[str, int]:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content_json = request.form.get("content_json", "")

        try:
            parsed_content = json.loads(content_json)
        except json.JSONDecodeError as exc:
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content(app),
                    content_json=content_json,
                    save_message=f"Invalid JSON: {exc.msg}",
                    save_error=True,
                ),
                400,
            )

        if not isinstance(parsed_content, dict):
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content(app),
                    content_json=content_json,
                    save_message="Invalid content payload: root must be an object.",
                    save_error=True,
                ),
                400,
            )

        _save_site_content(app, parsed_content)
        return (
            render_template(
                "admin/index.html",
                content=parsed_content,
                content_json=json.dumps(
                    parsed_content, indent=2, ensure_ascii=False),
                save_message="Content saved.",
                save_error=False,
            ),
            200,
        )

    @app.post("/admin/preview")
    def admin_preview() -> Response | tuple[str, int]:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        try:
            payload = request.get_json(force=True, silent=False)
            if not isinstance(payload, dict):
                raise ValueError("root must be an object")
        except Exception as exc:
            return Response(f"Invalid JSON: {exc}", status=400, mimetype="text/plain")

        html = render_template("index.html", content=payload)
        return Response(html, mimetype="text/html")

    @app.get("/admin/<page_name>")
    def admin_page(page_name: str) -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content = _load_site_content(app)
        if page_name not in content:
            return Response("Page not found", status=404)
        return Response(
            f"Editing '{page_name}' page not implemented yet.",
            mimetype="text/plain",
        )

    @app.post("/admin/upload")
    def admin_upload() -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        if "file" not in request.files:
            return Response("No file uploaded", status=400)

        file = request.files["file"]
        if file.filename == "":
            return Response("No file selected", status=400)

        if file:
            filename = file.filename
            static_dir = Path(app.root_path) / "static" / "images"
            static_dir.mkdir(parents=True, exist_ok=True)
            static_filename = Path(f"{static_dir}") / f"{filename}"
            file.save(static_filename)
            return Response(f"File {filename} uploaded successfully", status=200)

        return Response("File upload failed", status=500)

    @app.get("/sitemap.xml")
    def sitemap() -> Response:
        site_url = request.url_root.rstrip("/")
        sitemap_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{site_url}/</loc>
  </url>
  {''.join(f'  <url>\n    <loc>{site_url}{file_url}</loc>\n  </url>\n' for file_url in static_files(app))}
</urlset>
'''
        return Response(sitemap_xml, mimetype="application/xml")

    return app
