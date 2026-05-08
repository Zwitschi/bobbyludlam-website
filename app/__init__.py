import os
from flask import Flask

from .utils import _load_site_meta
from .pages import pages_bp
from .admin import admin_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["ADMIN_USERNAME"] = os.getenv("ADMIN_USERNAME", "admin")
    app.config["ADMIN_PASSWORD"] = os.getenv("ADMIN_PASSWORD", "admin")

    @app.context_processor
    def inject_site_meta() -> dict[str, object]:
        return {"site_meta": _load_site_meta(app)}

    app.register_blueprint(pages_bp)
    app.register_blueprint(admin_bp)

    return app
