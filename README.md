# Bobby Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/31419ef6-8bd0-4e94-b145-7c3a896e4394/deploy-status)](https://app.netlify.com/projects/bobbyludlam/deploys)

This repository contains the code for a Flask website, serving as an online portfolio and contact point for Bobby Ludlam, a comedian and creative individual. The website features sections for biography, portfolio, and contact information, with content sourced from markdown files. The project also includes a static site export script.

## Table of Contents

- [Bobby Website](#bobby-website)
  - [Table of Contents](#table-of-contents)
  - [Current status](#current-status)
  - [Requirements](#requirements)
  - [Install dependencies](#install-dependencies)
  - [Run the Flask app](#run-the-flask-app)
  - [Generate a static site](#generate-a-static-site)
  - [Project structure](#project-structure)
  - [Deployment](#deployment)
    - [Netlify build settings](#netlify-build-settings)

## Current status

- Flask app factory created in `app/__init__.py`
- Root route `/` renders a starter template
- Static stylesheet is wired under `app/static/css/`
- Website content lives in `app/content/`
- Local virtual environment and base dependencies are set up
- `tests/` directory exists for future unit tests
- A static site export script is available in `build_static_site.py`

## Requirements

- Python 3.13+

## Install dependencies

Create and activate a virtual environment if needed, then install from `requirements.txt`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run the Flask app

From the repository root:

```powershell
python run.py
```

Then open `http://127.0.0.1:5000/` in your browser.

## Generate a static site

To export the rendered site into `docs/`:

```powershell
python build_static_site.py
```

The script renders the homepage, `robots.txt`, and `sitemap.xml`, then copies the static assets into `docs/static/`.

To use a different base URL for the generated sitemap:

```powershell
python build_static_site.py --site-url https://example.com
```

Use `--no-clean` if you want to keep existing files in the output directory.

## Project structure

```text
app/
    content/
        siteContent.json      # Hero copy and page sections
        gallery.json          # Gallery image captions and ordering
        siteMeta.json         # Metadata (title, OG, Twitter, JSON-LD, footer)
    static/
        css/
            admin.css         # Admin dashboard styles
            site.css          # Public site styles
        js/
            admin.js          # Admin editor logic (content/meta handling)
        images/               # Uploaded images
    templates/
        _base.html            # Public site base template
        index.html            # Public site homepage
        admin/
            admin_base.html       # Shared admin shell (sidebar + preview)
            admin_navigation.html # Sidebar nav partial
            admin_content.html    # Content editor page (hero, sections)
            admin_gallery.html    # Image gallery manager
            admin_meta.html       # Metadata editor page (OG, Twitter, etc.)
            admin_preview.html    # Full-page live preview
            partials/             # Reusable metadata field panels
tests/
build_static_site.py
run.py
requirements.txt
```

## Admin Interface

The admin dashboard is split into three sections:

| Route            | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `/admin`         | Overview with links to each editor                               |
| `/admin/content` | Edit hero copy and page sections                                 |
| `/admin/gallery` | Upload images, edit captions, reorder, and delete gallery files  |
| `/admin/meta`    | Edit metadata (basic, Open Graph, Twitter Card, JSON-LD, footer) |

Both pages share a persistent live preview panel and sidebar navigation. Authentication uses HTTP Basic Auth (username/password from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars, default: `admin`/`admin`).

### Content vs Metadata Editing

- **Content page** — hero fields and rich text section editor. Changes stored in `siteContent.json`.
- **Gallery page** — image upload, caption editing, ordering, and deletion. Metadata is stored in `gallery.json`; files are stored in `app/static/images/`.
- **Meta page** — title, description, keywords, social media metadata, structured data, footer copy. Changes stored in `siteMeta.json`.

Each page has its own save button. Saving content does not affect metadata dirty state and vice versa. The save button highlights amber with a pulse animation when unsaved changes exist.

### JSON-Backed Content Management

All site content and metadata is stored in JSON files under `app/content/`. The admin UI provides a visual editor — no need to hand-edit source templates. Changes are held in-memory until explicitly saved via the save button. The live preview renders the current in-memory state without requiring a page reload.

## Deployment

The website is deployed on Netlify, which automatically builds and deploys the site whenever changes are pushed to the main branch. The build process runs the `build_static_site.py` script to generate the static files in the `docs/` directory, which are then served by Netlify.

### Netlify build settings

- Runtime: None (Python is installed via build image, and dependencies are installed via `build_static_site.py`)
- Base directory: `/`
- Build command: `python build_static_site.py`
- Publish directory: `docs`
- Functions directory: (not used)
- Deploy log visibility: Public logs
- Build status: Active builds
