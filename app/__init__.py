import json
import os
from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, Response, jsonify, render_template, request, url_for
from werkzeug.utils import secure_filename
ALLOW_ROBOTS = True


def _site_content_path(app: Flask) -> Path:
    return Path(app.root_path) / "content" / "siteContent.json"


def _site_meta_path(app: Flask) -> Path:
    return Path(app.root_path) / "content" / "siteMeta.json"


def _gallery_data_path(app: Flask) -> Path:
    return Path(app.root_path) / "content" / "gallery.json"


def _gallery_images_path(app: Flask) -> Path:
    return Path(app.root_path) / "static" / "images"


def _create_robots_txt() -> str:
    if ALLOW_ROBOTS:
        return "User-agent: *\nAllow: /\n"
    else:
        return "User-agent: *\nDisallow: /\n"


def _load_site_content_payload(app: Flask) -> dict[str, object]:
    content_path = _site_content_path(app)
    raw_content = content_path.read_text(encoding="utf-8")

    data = json.loads(raw_content)
    return data


def _prepare_site_content(content: dict[str, object]) -> dict[str, object]:
    hero_defaults = {
        "eyebrow": "Story, work, and ways to connect",
        "title": "Bobby Ludlam",
        "intro": (
            "Austin comedian, writer, artist, and creator working across "
            "stand-up, film, and unusually sincere big ideas."
        ),
    }
    raw_hero = content.get("hero", {})
    hero = hero_defaults | raw_hero if isinstance(
        raw_hero, dict) else hero_defaults
    pages = {key: value for key, value in content.items() if key != "hero"}
    return {"hero": hero, "pages": pages}


def _load_site_content(app: Flask) -> dict[str, object]:
    return _prepare_site_content(_load_site_content_payload(app))


def _default_site_meta() -> dict[str, object]:
    return {
        "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
        "description": (
            "Bobby Ludlam is an Austin comedian, writer, artist, and creator "
            "working across stand-up, film, and creative projects."
        ),
        "keywords": [
            "Bobby Ludlam",
            "Bobby Something",
            "Mohawk comedian",
            "Irish accent mohawk comedian",
            "comedy",
            "stand-up",
            "Austin comedian",
            "open mic comedy",
            "comedy documentary",
        ],
        "open_graph": {
            "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
            "description": (
                "Bobby Ludlam is an Austin comedian, writer, artist, and "
                "creator working across stand-up, film, and creative projects."
            ),
            "type": "website",
            "site_name": "Bobby Ludlam",
            "image": "images/bobby-ludlam-austin-1.jpg",
        },
        "twitter": {
            "card": "summary_large_image",
            "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
            "description": (
                "Bobby Ludlam is an Austin comedian, writer, artist, and "
                "creator working across stand-up, film, and creative projects."
            ),
            "image": "images/bobby-ludlam-austin-1.jpg",
        },
        "jsonld": {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Bobby Ludlam",
            "description": (
                "Bobby Ludlam is an Austin comedian, writer, artist, and "
                "creator working across stand-up, film, and creative projects."
            ),
            "image": "images/bobby-ludlam-austin-1.jpg",
            "sameAs": [
                "https://www.instagram.com/thebobbyludlam/",
                "https://bobbyludlam.com/",
            ],
        },
        "footer": {
            "summary": "Bobby Ludlam - Austin comedian, writer, artist, and creator.",
            "links": [
                {
                    "label": "Instagram",
                    "url": "https://www.instagram.com/thebobbyludlam/",
                },
                {
                    "label": "bobbyludlam.com",
                    "url": "https://bobbyludlam.com/",
                },
            ],
            "copyright_year": 2026,
            "credit": {
                "label": "All You Can GET",
                "url": "https://allucanget.biz",
                "text": "for Bobby Ludlam. All rights reserved.",
            },
        },
    }


def _merge_nested_dict(defaults: dict[str, object], values: dict[str, object]) -> dict[str, object]:
    merged = defaults.copy()
    for key, default_value in defaults.items():
        value = values.get(key)
        if isinstance(default_value, dict):
            merged[key] = _merge_nested_dict(
                default_value,
                value if isinstance(value, dict) else {},
            )
        elif isinstance(default_value, list):
            merged[key] = value if isinstance(value, list) else default_value
        else:
            merged[key] = value if value is not None else default_value

    for key, value in values.items():
        if key not in merged:
            merged[key] = value

    return merged


def _prepare_site_meta(meta: dict[str, object]) -> dict[str, object]:
    return _merge_nested_dict(_default_site_meta(), meta)


def _load_site_meta(app: Flask) -> dict[str, object]:
    meta_path = _site_meta_path(app)
    raw_meta = meta_path.read_text(encoding="utf-8")

    data = json.loads(raw_meta)
    return _prepare_site_meta(data)


def _save_site_content(app: Flask, content: dict[str, object]) -> None:
    content_path = _site_content_path(app)
    content_path.write_text(
        json.dumps(content, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _save_site_meta(app: Flask, meta: dict[str, object]) -> None:
    meta_path = _site_meta_path(app)
    meta_path.write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _default_gallery_data() -> dict[str, object]:
    return {"images": []}


def _load_gallery_data(app: Flask) -> dict[str, object]:
    gallery_path = _gallery_data_path(app)
    if gallery_path.exists():
        try:
            data = json.loads(gallery_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = _default_gallery_data()
    else:
        data = _default_gallery_data()

    images = data.get("images") if isinstance(data, dict) else []
    if not isinstance(images, list):
        images = []

    known = {
        item.get("filename"): item
        for item in images
        if isinstance(item, dict) and isinstance(item.get("filename"), str)
    }
    image_dir = _gallery_images_path(app)
    image_paths = sorted(image_dir.glob("*")) if image_dir.exists() else []
    for path in image_paths:
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
            continue
        if path.name not in known:
            images.append(
                {
                    "filename": path.name,
                    "caption": "",
                    "upload_date": datetime.fromtimestamp(
                        path.stat().st_mtime,
                        timezone.utc,
                    ).isoformat(),
                }
            )

    return {"images": images}


def _save_gallery_data(app: Flask, data: dict[str, object]) -> None:
    gallery_path = _gallery_data_path(app)
    gallery_path.parent.mkdir(parents=True, exist_ok=True)
    gallery_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
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

    @app.context_processor
    def inject_site_meta() -> dict[str, object]:
        return {"site_meta": _load_site_meta(app)}

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
        site_content = _load_site_content(app)
        return render_template(
            "index.html",
            content=site_content["pages"],
            hero=site_content["hero"],
        )

    @app.get("/robots.txt")
    def robots() -> Response:
        return Response(_create_robots_txt(), mimetype="text/plain")

    @app.get("/admin")
    def admin_dashboard() -> Response | str:
        if not _is_admin_authenticated():
            return _admin_unauthorized()
        return render_template("admin/index.html", active_section="overview")

    @app.post("/admin/save")
    def admin_save() -> Response | tuple[str, int]:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content_json = request.form.get("content_json", "")
        meta_json_supplied = "meta_json" in request.form
        meta_json = request.form.get(
            "meta_json",
            json.dumps(_load_site_meta(app), indent=2, ensure_ascii=False),
        )

        try:
            parsed_content = json.loads(content_json)
        except json.JSONDecodeError as exc:
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=meta_json,
                    save_message=f"Invalid JSON: {exc.msg}",
                    save_error=True,
                ),
                400,
            )

        if not isinstance(parsed_content, dict):
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=meta_json,
                    save_message="Invalid content payload: root must be an object.",
                    save_error=True,
                ),
                400,
            )

        try:
            parsed_meta = json.loads(meta_json)
        except json.JSONDecodeError as exc:
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=meta_json,
                    save_message=f"Invalid metadata JSON: {exc.msg}",
                    save_error=True,
                ),
                400,
            )

        if not isinstance(parsed_meta, dict):
            return (
                render_template(
                    "admin/index.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=meta_json,
                    save_message="Invalid metadata payload: root must be an object.",
                    save_error=True,
                ),
                400,
            )

        _save_site_content(app, parsed_content)
        _save_site_meta(app, parsed_meta)
        return (
            render_template(
                "admin/index.html",
                content=parsed_content,
                content_json=json.dumps(
                    parsed_content, indent=2, ensure_ascii=False),
                meta_json=json.dumps(
                    parsed_meta, indent=2, ensure_ascii=False),
                save_message=(
                    "Content and metadata saved."
                    if meta_json_supplied
                    else "Content saved."
                ),
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

        site_content = _prepare_site_content(payload)
        html = render_template(
            "index.html",
            content=site_content["pages"],
            hero=site_content["hero"],
        )
        return Response(html, mimetype="text/html")

    @app.get("/admin/content")
    def admin_content() -> Response | str:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content = _load_site_content_payload(app)
        meta = _load_site_meta(app)
        return render_template(
            "admin/admin_content.html",
            content=content,
            content_json=json.dumps(content, indent=2, ensure_ascii=False),
            meta_json=json.dumps(meta, indent=2, ensure_ascii=False),
            save_message=None,
            save_error=False,
            active_section="content",
        )

    @app.get("/admin/gallery")
    def admin_gallery() -> Response | str:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        return render_template(
            "admin/admin_gallery.html",
            gallery=_load_gallery_data(app),
            active_section="gallery",
        )

    @app.post("/admin/gallery/upload")
    def admin_gallery_upload() -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        if "file" not in request.files:
            return Response("No file uploaded", status=400)

        file = request.files["file"]
        filename = secure_filename(file.filename or "")
        if not filename:
            return Response("No file selected", status=400)

        image_dir = _gallery_images_path(app)
        image_dir.mkdir(parents=True, exist_ok=True)
        file.save(image_dir / filename)

        gallery = _load_gallery_data(app)
        images = [
            image
            for image in gallery.get("images", [])
            if isinstance(image, dict) and image.get("filename") != filename
        ]
        images.insert(
            0,
            {
                "filename": filename,
                "caption": request.form.get("caption", ""),
                "upload_date": datetime.now(timezone.utc).isoformat(),
            },
        )
        gallery["images"] = images
        _save_gallery_data(app, gallery)
        return jsonify({"ok": True, "gallery": gallery})

    @app.delete("/admin/gallery/delete/<filename>")
    def admin_gallery_delete(filename: str) -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        safe_name = secure_filename(filename)
        if safe_name != filename:
            return Response("Invalid filename", status=400)

        image_path = _gallery_images_path(app) / safe_name
        if image_path.exists() and image_path.is_file():
            image_path.unlink()

        gallery = _load_gallery_data(app)
        gallery["images"] = [
            image
            for image in gallery.get("images", [])
            if isinstance(image, dict) and image.get("filename") != safe_name
        ]
        _save_gallery_data(app, gallery)
        return jsonify({"ok": True, "gallery": gallery})

    @app.post("/admin/gallery/captions")
    def admin_gallery_captions() -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        payload = request.get_json(force=True, silent=True)
        images = payload.get("images") if isinstance(payload, dict) else None
        if not isinstance(images, list):
            return Response("Invalid gallery payload", status=400)

        cleaned = []
        for item in images:
            if not isinstance(item, dict):
                continue
            filename = secure_filename(str(item.get("filename", "")))
            if not filename:
                continue
            cleaned.append(
                {
                    "filename": filename,
                    "caption": str(item.get("caption", "")),
                    "upload_date": str(item.get("upload_date", "")),
                }
            )

        gallery = {"images": cleaned}
        _save_gallery_data(app, gallery)
        return jsonify({"ok": True, "gallery": gallery})

    @app.get("/admin/meta")
    def admin_meta() -> Response | str:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content = _load_site_content_payload(app)
        meta = _load_site_meta(app)
        return render_template(
            "admin/admin_meta.html",
            content=content,
            content_json=json.dumps(content, indent=2, ensure_ascii=False),
            meta_json=json.dumps(meta, indent=2, ensure_ascii=False),
            save_message=None,
            save_error=False,
            active_section="meta",
        )

    @app.post("/admin/save/content")
    def admin_save_content() -> Response | tuple[str, int]:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content_json = request.form.get("content_json", "")

        try:
            parsed_content = json.loads(content_json)
        except json.JSONDecodeError as exc:
            return (
                render_template(
                    "admin/admin_content.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=json.dumps(_load_site_meta(
                        app), indent=2, ensure_ascii=False),
                    save_message=f"Invalid JSON: {exc.msg}",
                    save_error=True,
                    active_section="content",
                ),
                400,
            )

        if not isinstance(parsed_content, dict):
            return (
                render_template(
                    "admin/admin_content.html",
                    content=_load_site_content_payload(app),
                    content_json=content_json,
                    meta_json=json.dumps(_load_site_meta(
                        app), indent=2, ensure_ascii=False),
                    save_message="Invalid content payload: root must be an object.",
                    save_error=True,
                    active_section="content",
                ),
                400,
            )

        _save_site_content(app, parsed_content)
        return (
            render_template(
                "admin/admin_content.html",
                content=parsed_content,
                content_json=json.dumps(
                    parsed_content, indent=2, ensure_ascii=False),
                meta_json=json.dumps(_load_site_meta(
                    app), indent=2, ensure_ascii=False),
                save_message="Content saved.",
                save_error=False,
                active_section="content",
            ),
            200,
        )

    @app.post("/admin/save/meta")
    def admin_save_meta() -> Response | tuple[str, int]:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        meta_json = request.form.get("meta_json", "")

        try:
            parsed_meta = json.loads(meta_json)
        except json.JSONDecodeError as exc:
            return (
                render_template(
                    "admin/admin_meta.html",
                    content=_load_site_content_payload(app),
                    content_json=json.dumps(_load_site_content_payload(
                        app), indent=2, ensure_ascii=False),
                    meta_json=meta_json,
                    save_message=f"Invalid metadata JSON: {exc.msg}",
                    save_error=True,
                    active_section="meta",
                ),
                400,
            )

        if not isinstance(parsed_meta, dict):
            return (
                render_template(
                    "admin/admin_meta.html",
                    content=_load_site_content_payload(app),
                    content_json=json.dumps(_load_site_content_payload(
                        app), indent=2, ensure_ascii=False),
                    meta_json=meta_json,
                    save_message="Invalid metadata payload: root must be an object.",
                    save_error=True,
                    active_section="meta",
                ),
                400,
            )

        _save_site_meta(app, parsed_meta)
        return (
            render_template(
                "admin/admin_meta.html",
                content=_load_site_content_payload(app),
                content_json=json.dumps(_load_site_content_payload(
                    app), indent=2, ensure_ascii=False),
                meta_json=json.dumps(
                    parsed_meta, indent=2, ensure_ascii=False),
                save_message="Metadata saved.",
                save_error=False,
                active_section="meta",
            ),
            200,
        )

    @app.get("/admin/<page_name>")
    def admin_page(page_name: str) -> Response:
        if not _is_admin_authenticated():
            return _admin_unauthorized()

        content = _load_site_content_payload(app)
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
