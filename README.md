# Bobby Website

This repository contains the code for a Flask website, serving as an online portfolio and contact point for Bobby Ludlam, a comedian and creative individual. The website features sections for biography, portfolio, and contact information, with content sourced from markdown files. The project also includes a static site export script.

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

To export the rendered site into `build/`:

```powershell
python build_static_site.py
```

The script renders the homepage, `robots.txt`, and `sitemap.xml`, then copies the static assets into `build/static/`.

To use a different base URL for the generated sitemap:

```powershell
python build_static_site.py --site-url https://example.com
```

Use `--no-clean` if you want to keep existing files in the output directory.

## Project structure

```text
app/
    content/
    static/
    templates/
    __init__.py
tests/
build_static_site.py
run.py
requirements.txt
```
