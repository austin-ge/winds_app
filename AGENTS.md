# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the full, deployed app (HTML/CSS/JS + Leaflet map, winds fetch, ADS-B polling).
- `spot.html` is a standalone spot calculator used for testing and is not deployed.
- `adsb_proxy.py` is a local Flask proxy for ADS-B data (used for dev/testing).
- `notes.txt` is currently unused.

## Build, Test, and Development Commands
- Open the app locally by serving or opening `index.html` in a browser (e.g., `open index.html`).
- Start the ADS-B proxy (optional, for local ADS-B data):
  - `python3 adsb_proxy.py`
  - Requires `flask` and `requests` (install with `python3 -m pip install flask requests`).

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML/CSS/JS to match existing style.
- Prefer `const`/`let`, camelCase for functions/variables, and UPPER_SNAKE_CASE for constants.
- Keep logic in `index.html` unless there is a clear reason to split files.
- Keep changes ASCII-only unless a file already uses non-ASCII content.

## Testing Guidelines
- No automated tests are present.
- Manually verify:
  - Map loads and DZ marker appears.
  - Winds table populates from Open-Meteo.
  - Jump run line updates after winds load.
  - ADS-B markers appear when proxy is running.

## Commit & Pull Request Guidelines
- No Git history is available in this repository; use clear, imperative commit messages (e.g., "Update wind fetch timing").
- PRs should include:
  - A short description of the change and rationale.
  - Screenshots of the map/sidebar if UI changed.
  - Notes on manual verification steps.

## Configuration Tips
- Update DZ settings in `index.html` (`DZ_NAME`, `DZ_LAT`, `DZ_LON`).
- Maintain jump-plane hex codes in `index.html` (`JUMP_PLANE_HEXES`).
- The ADS-B endpoint expects a local proxy at `http://localhost:5000/adsb`.
