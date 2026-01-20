# CLAUDE.md - Winds App

## Project Overview

Winds App is a single-page web application for skydiving dropzones that visualizes upper-air wind conditions and calculates optimal jump run parameters. It's designed for real-time display boards.

**Core Features:**
- Wind data visualization from GFS (Global Forecast System) via Open-Meteo API
- Automatic jump run heading calculation (based on winds 5k-14k ft)
- Offset, ground speed, and exit separation calculations
- ADS-B aircraft tracking with jump plane highlighting
- Interactive Leaflet satellite map with jump run line visualization

**Current Deployment:** `https://spotboard.xyz` (Skydive Midwest)

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (no build tools)
- **Backend:** Node.js + Express.js
- **Mapping:** Leaflet.js with Esri satellite tiles
- **External APIs:** Open-Meteo (weather), adsb.lol (aircraft tracking)
- **Deployment:** Dokploy (Docker, Alpine Linux base)

## Project Structure

```
winds_app/
├── index.html          # Main HTML shell
├── server.js           # Express server (static files + ADS-B proxy)
├── package.json        # Node dependencies
├── Dockerfile          # Docker build config
├── assets/
│   ├── app.js          # Main application logic (~1,300 lines)
│   ├── config.js       # DZ coordinates, aircraft hex codes, parameters
│   └── styles.css      # All styling (~650 lines)
└── dev/
    ├── adsb_proxy.py   # Flask-based local ADS-B proxy for development
    ├── nginx.conf      # Sample nginx reverse proxy config
    └── spot.html       # Experimental spot calculator
```

## Build & Run Commands

```bash
# Install dependencies
npm install

# Start the server (default port 8080)
npm start

# Or just open index.html in a browser for frontend-only testing

# Docker deployment
docker build -t winds-app:latest .
docker run -p 8080:8080 winds-app:latest
```

## Key Configuration

**assets/config.js** - Primary configuration:
- `DZ_LAT`, `DZ_LON` - Dropzone coordinates
- `JUMP_PLANE_HEXES` - ICAO hex codes for jump aircraft
- `EXIT_ALTITUDE_FT`, `OPENING_ALTITUDE_FT` - Altitude parameters
- `JUMP_RUN_AIRSPEED_KNOTS` - Aircraft speed

**server.js** - Environment variables:
- `PORT` - Server port (default: 8080)
- `ADSB_PRIMARY_URL` - Local dump1090 endpoint
- `ADSB_FALLBACK_URL` - adsb.lol API endpoint
- `ADSB_FALLBACK_RADIUS_NM` - Fallback search radius (default: 20)
- `ADSB_TIMEOUT_MS` - Request timeout (default: 2000)

## Code Patterns

**Naming Conventions:**
- `UPPER_SNAKE_CASE` for constants
- `camelCase` for functions and variables
- 2-space indentation

**Key Global State (app.js):**
- `windsAloft[]` - Array of {altFt, dirDeg, speedKt}
- `currentHeadingDeg` - Jump run heading
- `jumpRunOffsetMiles` - Upwind/downwind positioning
- `jumpPlaneActive` - Jump aircraft tracking status

**Core Function Groups:**
1. Winds fetching - `fetchWinds()`, `retryWithBackoff()`
2. Jump run calculations - `computeOffsetMiles()`, `computeGroundSpeedAndSeparation()`
3. ADS-B polling - `pollAdsb()`, `updateAircraftMarkers()`
4. UI rendering - `renderWindsTable()`, `updateJumpRun()`, `updateStatusStrip()`

**Caching:**
- localStorage key: `windsAloft_cache`
- TTL: 2 hours
- Automatic fallback on API failure

**Update Intervals:**
- Winds: Every 10-15 minutes
- ADS-B: Every 3-5 seconds

## Mathematical Conventions

- **Wind Direction:** Meteorological (where wind comes FROM, 0=North)
- **Bearings:** Clockwise from North
- **Distances:** Miles for offsets, meters for Leaflet
- **Velocities:** Knots for winds/aircraft, MPH for descent rates
- **Conversions:** 1 knot = 1.15078 MPH, 1 mile = 1609.34 meters

## Testing

No automated test suite. Manual verification:
- Map loads with DZ marker
- Winds table populates
- Jump run line updates
- ADS-B markers appear (when proxy running)
- Status strip shows correct states
- Error banner displays on failures
