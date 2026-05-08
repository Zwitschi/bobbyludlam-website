import json
import os
from pathlib import Path
from datetime import datetime, timezone

from flask import current_app, Flask, Response, url_for
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
        "common": {
            "title": "Bobby Ludlam | Austin Comedian, Writer & Artist",
            "description": (
                "Bobby Ludlam is an Austin comedian, writer, artist, and creator "
                "working across stand-up, film, and creative projects."
            ),
            "image": "images/bobby-ludlam-austin-1.jpg",
        },
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
            "type": "website",
            "site_name": "Bobby Ludlam",
        },
        "twitter": {
            "card": "summary_large_image",
        },
        "jsonld": {
            "@context": "https://schema.org",
            "@type": "Person",
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


def _admin_unauthorized() -> Response:
    return Response(
        "Authentication required.",
        status=401,
        headers={"WWW-Authenticate": 'Basic realm="Admin"'},
        mimetype="text/plain",
    )


def _is_admin_authenticated(request) -> bool:
    auth = request.authorization
    return bool(
        auth
        and auth.type == "basic"
        and auth.username == current_app.config["ADMIN_USERNAME"]
        and auth.password == current_app.config["ADMIN_PASSWORD"]
    )
