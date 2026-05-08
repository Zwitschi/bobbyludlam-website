from flask import Blueprint, Response, render_template, request, jsonify, current_app
from .utils import (
    _admin_unauthorized,
    _is_admin_authenticated,
    _load_site_content_payload,
    _load_site_meta,
    _save_site_content,
    _save_site_meta,
    _load_gallery_data,
    _save_gallery_data,
    _gallery_images_path,
)
from werkzeug.utils import secure_filename
from datetime import datetime, timezone
import json

admin_bp = Blueprint('admin', __name__, template_folder='templates/admin')


@admin_bp.get("/admin/")
def admin_dashboard() -> Response | str:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()
    # redirect to content editor for now, may expand later
    return render_template(
        "admin_content.html",
        content=_load_site_content_payload(current_app),
        content_json=json.dumps(_load_site_content_payload(
            current_app), indent=2, ensure_ascii=False),
        meta_json=json.dumps(_load_site_meta(
            current_app), indent=2, ensure_ascii=False),
        save_message=None,
        save_error=False,
        active_section="content",
    )


@admin_bp.post("/admin/save")
def admin_save() -> Response | tuple[str, int]:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    content_json = request.form.get("content_json", "")
    meta_json_supplied = "meta_json" in request.form
    meta_json = request.form.get(
        "meta_json",
        json.dumps(_load_site_meta(current_app), indent=2, ensure_ascii=False),
    )

    try:
        parsed_content = json.loads(content_json)
    except json.JSONDecodeError as exc:
        return (
            render_template(
                "admin_content.html",
                content=_load_site_content_payload(current_app),
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
                "admin_content.html",
                content=_load_site_content_payload(current_app),
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
                "admin_content.html",
                content=_load_site_content_payload(current_app),
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
                "admin_content.html",
                content=_load_site_content_payload(current_app),
                content_json=content_json,
                meta_json=meta_json,
                save_message="Invalid metadata payload: root must be an object.",
                save_error=True,
            ),
            400,
        )

    _save_site_content(current_app, parsed_content)
    _save_site_meta(current_app, parsed_meta)
    return (
        render_template(
            "admin_content.html",
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


@admin_bp.post("/admin/preview")
def admin_preview() -> Response | tuple[str, int]:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    try:
        payload = request.get_json(force=True, silent=False)
        if not isinstance(payload, dict):
            raise ValueError("root must be an object")
    except Exception as exc:
        return Response(f"Invalid JSON: {exc}", status=400, mimetype="text/plain")

    from .utils import _prepare_site_content
    site_content = _prepare_site_content(payload)
    html = render_template(
        "index.html",
        content=site_content["pages"],
        hero=site_content["hero"],
    )
    return Response(html, mimetype="text/html")


@admin_bp.get("/admin/content")
def admin_content() -> Response | str:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    content = _load_site_content_payload(current_app)
    meta = _load_site_meta(current_app)
    return render_template(
        "admin_content.html",
        content=content,
        content_json=json.dumps(content, indent=2, ensure_ascii=False),
        meta_json=json.dumps(meta, indent=2, ensure_ascii=False),
        save_message=None,
        save_error=False,
        active_section="content",
    )


@admin_bp.get("/admin/gallery")
def admin_gallery() -> Response | str:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    return render_template(
        "admin_gallery.html",
        gallery=_load_gallery_data(current_app),
        active_section="gallery",
    )


@admin_bp.post("/admin/gallery/upload")
def admin_gallery_upload() -> Response:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    if "file" not in request.files:
        return Response("No file uploaded", status=400)

    file = request.files["file"]
    filename = secure_filename(file.filename or "")
    if not filename:
        return Response("No file selected", status=400)

    image_dir = _gallery_images_path(current_app)
    image_dir.mkdir(parents=True, exist_ok=True)
    file.save(image_dir / filename)

    gallery = _load_gallery_data(current_app)
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
    _save_gallery_data(current_app, gallery)
    return jsonify({"ok": True, "gallery": gallery})


@admin_bp.delete("/admin/gallery/delete/<filename>")
def admin_gallery_delete(filename: str) -> Response:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    safe_name = secure_filename(filename)
    if safe_name != filename:
        return Response("Invalid filename", status=400)

    image_path = _gallery_images_path(current_app) / safe_name
    if image_path.exists() and image_path.is_file():
        image_path.unlink()

    gallery = _load_gallery_data(current_app)
    gallery["images"] = [
        image
        for image in gallery.get("images", [])
        if isinstance(image, dict) and image.get("filename") != safe_name
    ]
    _save_gallery_data(current_app, gallery)
    return jsonify({"ok": True, "gallery": gallery})


@admin_bp.post("/admin/gallery/captions")
def admin_gallery_captions() -> Response:
    if not _is_admin_authenticated(request):
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
    _save_gallery_data(current_app, gallery)
    return jsonify({"ok": True, "gallery": gallery})


@admin_bp.get("/admin/meta")
def admin_meta() -> Response | str:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    content = _load_site_content_payload(current_app)
    meta = _load_site_meta(current_app)
    return render_template(
        "admin_meta.html",
        content=content,
        content_json=json.dumps(content, indent=2, ensure_ascii=False),
        meta_json=json.dumps(meta, indent=2, ensure_ascii=False),
        save_message=None,
        save_error=False,
        active_section="meta",
    )


@admin_bp.post("/admin/save/content")
def admin_save_content() -> Response | tuple[str, int]:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    content_json = request.form.get("content_json", "")

    try:
        parsed_content = json.loads(content_json)
    except json.JSONDecodeError as exc:
        return (
            render_template(
                "admin_content.html",
                content=_load_site_content_payload(current_app),
                content_json=content_json,
                meta_json=json.dumps(_load_site_meta(
                    current_app), indent=2, ensure_ascii=False),
                save_message=f"Invalid JSON: {exc.msg}",
                save_error=True,
                active_section="content",
            ),
            400,
        )

    if not isinstance(parsed_content, dict):
        return (
            render_template(
                "admin_content.html",
                content=_load_site_content_payload(current_app),
                content_json=content_json,
                meta_json=json.dumps(_load_site_meta(
                    current_app), indent=2, ensure_ascii=False),
                save_message="Invalid content payload: root must be an object.",
                save_error=True,
                active_section="content",
            ),
            400,
        )

    _save_site_content(current_app, parsed_content)
    return (
        render_template(
            "admin_content.html",
            content=parsed_content,
            content_json=json.dumps(
                parsed_content, indent=2, ensure_ascii=False),
            meta_json=json.dumps(_load_site_meta(
                current_app), indent=2, ensure_ascii=False),
            save_message="Content saved.",
            save_error=False,
            active_section="content",
        ),
        200,
    )


@admin_bp.post("/admin/save/meta")
def admin_save_meta() -> Response | tuple[str, int]:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    meta_json = request.form.get("meta_json", "")

    try:
        parsed_meta = json.loads(meta_json)
    except json.JSONDecodeError as exc:
        return (
            render_template(
                "admin_meta.html",
                content=_load_site_content_payload(current_app),
                content_json=json.dumps(_load_site_content_payload(
                    current_app), indent=2, ensure_ascii=False),
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
                "admin_meta.html",
                content=_load_site_content_payload(current_app),
                content_json=json.dumps(_load_site_content_payload(
                    current_app), indent=2, ensure_ascii=False),
                meta_json=meta_json,
                save_message="Invalid metadata payload: root must be an object.",
                save_error=True,
                active_section="meta",
            ),
            400,
        )

    _save_site_meta(current_app, parsed_meta)
    return (
        render_template(
            "admin_meta.html",
            content=_load_site_content_payload(current_app),
            content_json=json.dumps(_load_site_content_payload(
                current_app), indent=2, ensure_ascii=False),
            meta_json=json.dumps(
                parsed_meta, indent=2, ensure_ascii=False),
            save_message="Metadata saved.",
            save_error=False,
            active_section="meta",
        ),
        200,
    )


@admin_bp.get("/admin/<page_name>")
def admin_page(page_name: str) -> Response:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    content = _load_site_content_payload(current_app)
    if page_name not in content:
        return Response("Page not found", status=404)
    return Response(
        f"Editing '{page_name}' page not implemented yet.",
        mimetype="text/plain",
    )


@admin_bp.post("/admin/upload")
def admin_upload() -> Response:
    if not _is_admin_authenticated(request):
        return _admin_unauthorized()

    if "file" not in request.files:
        return Response("No file uploaded", status=400)

    file = request.files["file"]
    if file.filename == "":
        return Response("No file selected", status=400)

    if file:
        filename = file.filename
        from pathlib import Path
        static_dir = Path(current_app.root_path) / "static" / "images"
        static_dir.mkdir(parents=True, exist_ok=True)
        static_filename = Path(f"{static_dir}") / f"{filename}"
        file.save(static_filename)
        return Response(f"File {filename} uploaded successfully", status=200)

    return Response("File upload failed", status=500)
