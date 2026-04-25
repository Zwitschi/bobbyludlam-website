# Bobby Website

This repository contains the initial Flask scaffold for Bobby's website.

## Current status

- Flask app factory created in `app/__init__.py`
- Root route `/` renders a starter template
- Static stylesheet is wired under `app/static/css/`
- Local virtual environment and base dependencies are set up
- `tests/` directory exists for future unit tests

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

## Project structure

```text
app/
	static/
	templates/
	__init__.py
run.py
requirements.txt
tests/
```
