from flask import Blueprint, Response, render_template, request, current_app

from .utils import _load_site_content, _create_robots_txt, static_files

pages_bp = Blueprint('pages', __name__)


@pages_bp.get("/")
def index() -> str:
    site_content = _load_site_content(current_app)
    return render_template(
        "index.html",
        content=site_content["pages"],
        hero=site_content["hero"],
    )


@pages_bp.get("/robots.txt")
def robots() -> Response:
    return Response(_create_robots_txt(), mimetype="text/plain")


@pages_bp.get("/sitemap.xml")
def sitemap() -> Response:
    site_url = request.url_root.rstrip("/")
    sitemap_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{site_url}/</loc>
  </url>
  {''.join(f'  <url>\n    <loc>{site_url}{file_url}</loc>\n  </url>\n' for file_url in static_files(current_app))}
</urlset>
'''
    return Response(sitemap_xml, mimetype="application/xml")
