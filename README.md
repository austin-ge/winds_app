# Winds App

A single-page web app for skydive dropzones that visualizes winds aloft, computes jump run heading/offset, and shows nearby aircraft via ADS-B.

## What It Does
- Pulls upper-air winds from Open-Meteo (GFS) and computes jump run heading + offset.
- Renders a Leaflet map with the DZ marker and jump run line.
- Polls a local ADS-B proxy to show jump aircraft and nearby traffic.

## Project Files
- `index.html`: Deployed app (HTML markup; links to assets in `assets/`).
- `assets/styles.css`: App styling.
- `assets/app.js`: App logic (winds fetch, jump run, ADS-B polling).
- `server.js`: Node server that serves the app and proxies ADS-B endpoints.
- `dev/spot.html`: Experimental spot calculator (not deployed).
- `dev/adsb_proxy.py`: Local ADS-B proxy for development/testing.
- `AGENTS.md`: Contributor guide.

## Quick Start
Open `index.html` in a browser.

Optional: run the ADS-B proxy locally (requires `flask` and `requests`):

```bash
python3 dev/adsb_proxy.py
```

## Deployment Notes
- This app runs on a Raspberry Pi configured to open the app on boot.
- You can host locally on the Pi or serve it from a web server.
- Current public host: `https://spot.austin-ge.com`.
 - You must configure the DZ location and aircraft list for your own dropzone; defaults are set for Skydive Midwest and their aircraft.

## Configuration
Edit values in `assets/config.js`:
- `DZ_NAME`, `DZ_LAT`, `DZ_LON`
- `JUMP_PLANE_HEXES`
- `ADSB_ENDPOINT` (defaults to `/adsb`)

## Dokploy + Docker (recommended)
Builds a single Node container that serves static files and proxies ADS-B.

1) Deploy using the included `Dockerfile`.
2) Set environment variables in Dokploy:
   - `ADSB_PRIMARY_URL` = `http://100.92.158.48/dump1090/data/aircraft.json`
   - `ADSB_FALLBACK_URL` = `https://api.adsb.lol/v2/point/42.703153/-87.958641/30`
   - `PORT` = `8080` (or whatever Dokploy expects)

Local run:
```bash
npm install
npm start
```
