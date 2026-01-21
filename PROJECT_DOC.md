# Winds App Technical Reference

This document serves as the definitive technical reference for the Winds App, a single-page web application for skydive dropzones. It details the system architecture, core business logic (specifically jump run calculations), configuration, and deployment procedures.

## 1. System Architecture

The application is built as a lightweight, single-page application (SPA) backed by a minimal Node.js server.

### Components
- **Frontend**: Vanilla JavaScript, HTML5, CSS3. Uses [Leaflet](https://leafletjs.com/) for mapping.
- **Backend**: Node.js with [Express](https://expressjs.com/). Serves static files and proxies ADS-B requests to avoid CORS issues.
- **ADS-B Data**: Consumed from a local Dump1090 instance (primary) or [adsb.lol](https://adsb.lol) API (fallback).
- **Weather Data**: Consumed from [Open-Meteo](https://open-meteo.com/) (GFS model).

### Data Flow
1.  **Client Load**: Browser loads `index.html` -> `server.js` serves static assets.
2.  **Winds Fetch**: `app.js` fetches GFS data from Open-Meteo for the configured lat/lon.
3.  **Calculation**: Client computes the optimal jump run heading (if auto-mode) and the upwind/downwind offset.
4.  **ADS-B Polling**: Client polls `/adsb` endpoint on the Node server every few seconds.
5.  **Proxying**: `server.js` forwards the request to the configured upstream ADS-B source and returns the JSON to the client.

---

## 2. Core Logic Deep Dive

### 2.1 Winds Aloft Processing
The app fetches hourly GFS forecast data from Open-Meteo.
- **Selection**: It finds the time slice closest to the current wall-clock time.
- **Interpolation**: It maps the pressure-level data (1000hPa, 925hPa, etc.) to specific target altitudes (0ft to 14,000ft in 1,000ft increments) using a nearest-neighbor approach against standard atmosphere approximations.
- **Caching**: Data is cached in `localStorage` for 2 hours (`CACHE_MAX_AGE_MS`) to reduce API calls.

### 2.2 Jump Run & Offset Calculation
The core value proposition of the app is calculating the optimal "Green Light" offset (where to exit the plane) based on winds. This is performed in `computeOffsetMiles(jumpRunHeadingDeg)`.

#### The Algorithm
The calculation determines the optimal exit point so that a skydiver opening at 4,000ft can reach the holding area (2,500ft) with margin. It accounts for **Freefall Drift** and **Canopy Drift**.

**Step 1: Calculate Passive Canopy Drift**
We calculate how far a canopy under "brakes" (or holding) would drift while descending from Opening Altitude to Holding Altitude.
- **Input**: `OPENING_ALTITUDE_FT` (4000) to `HOLDING_AREA_ALTITUDE_FT` (2500).
- **Process**: We iterate through wind layers between these altitudes. For each layer:
    $$ \text{Time}_{\text{layer}} = \frac{\text{Layer Thickness}}{\text{Descent Rate}} $$
    $$ \text{Drift Vector} = \text{Wind Vector} \times \text{Time}_{\text{layer}} $$
- **Result**: A vector $(dx, dy)$ representing total drift under canopy.

**Step 2: Determine Opening Point**
We assume the skydiver wants to open UPWIND of the target and fly DOWNWIND/CROSSWIND to it.
- **Concept**: `flyable_dist = CANOPY_FORWARD_SPEED * time_under_canopy`.
- **Calculation**: We project the drift vector onto the jump run heading.
    $$ \text{Opening Offset} = -(\text{Drift}_{\text{along heading}} + \text{Flyable Distance}) $$
    *Note: Negative implies upwind (before the target).*

**Step 3: Calculate Freefall Drift**
We calculate how far the skydiver drifts in freefall from Exit to Opening.
- **Input**: `EXIT_ALTITUDE_FT` (14000) to `OPENING_ALTITUDE_FT` (4000).
- **Process**: Similar integration of wind layers as Step 1, but using `FREEFALL_TERMINAL_VELOCITY_MPH` (120mph).
- **Result**: `Freefall Drift Vector`.

**Step 4: Determine Exit Point (Green Light)**
The Exit Point is the Opening Point adjusted for freefall drift.
$$ \text{Exit Offset} = \text{Opening Offset} - \text{Freefall Drift}_{\text{along heading}} $$

**Step 5: Final Adjustments**
Two "fudge factors" are applied:
1.  **Airplane Drift**: (Currently 0.0) Accounts for the plane drifting while climbing on jump run.
2.  **Light-to-Door**: (`LIGHT_TO_DOOR_MILES`) Accounts for the physical distance between the pilot calling "Green Light" and the door.
$$ \text{Final Offset} = \text{Exit Offset} - (\text{Airplane Drift} + \text{Light to Door}) $$

### 2.3 Auto-Heading Calculation
If configured, the app calculates the optimal jump run heading based on winds between 5,000ft and 14,000ft.
- It averages the wind vectors in this layer.
- The Jump Run Heading is set directly INTO the computed average wind direction.

---

## 3. Configuration

All site-specific configuration is located in `assets/config.js`.

### Dropzone Settings
- `DZ_NAME`, `DZ_LAT`, `DZ_LON`: Location of the dropzone / target center.

### ADS-B Configuration
- `ADSB_ENDPOINT`: The relative path the frontend polls (default `/adsb`).
- `ADSB_DISPLAY_RADIUS_NM`: Traffic within this radius is shown on the map.
- `JUMP_PLANE_HEXES`: A list of ICAO 24-bit hex codes (lowercase string) for setting the "Green" active jump plane status.
- `HEX_TO_TAIL`: Map of hex codes to tail numbers (e.g., `N692DA`) for UI display.

### Jump Profile Parameters
These affect the offset math:
- `EXIT_ALTITUDE_FT`: Typical exit altitude (e.g., 14000).
- `OPENING_ALTITUDE_FT`: Typical deployment altitude (e.g., 4000).
- `HOLDING_AREA_ALTITUDE_FT`: Target altitude to arrive at the holding area (e.g., 2500).
- `FREEFALL_TERMINAL_VELOCITY_MPH`: (e.g., 120).
- `CANOPY_DESCENT_RATE_MPH`: (e.g., 15) - Conservative estimate for average canopy descent.
- `CANOPY_FORWARD_SPEED_MPH`: (e.g., 25) - Conservative estimate for forward penetration.

---

## 4. Development & Deployment

### Local Development
1.  **Prerequisites**: Node.js 18+, Python 3 (for proxy dev).
2.  **Run Main Server**:
    ```bash
    npm install
    npm start
    # Server runs on port 8080
    ```
3.  **Run Python Proxy** (Optional, for mocking ADS-B data):
    ```bash
    pip install flask requests
    python3 dev/adsb_proxy.py
    # Runs on port 5000
    ```

### Deployment (Docker)
The repo includes a `Dockerfile` for building a production-ready container.
1.  **Build**: `docker build -t winds-app .`
2.  **Run**:
    ```bash
    docker run -p 8080:8080 \
      -e ADSB_PRIMARY_URL="http://your-feeder-ip/dump1090/data/aircraft.json" \
      winds-app
    ```

### Environment Variables
- `PORT`: Server port (default 8080).
- `ADSB_PRIMARY_URL`: URL to the primary JSON feed (e.g., dump1090).
- `ADSB_FALLBACK_URL`: URL to fallback API (e.g., adsb.lol).
- `ADSB_FALLBACK_RADIUS_NM`: Radius for fallback query (default 20).

## 5. Contribution Guidelines
- Use 2-space indentation for HTML/CSS/JS.
- Prefer `const`/`let` over `var`.
- Run manual verification tests (map load, wind fetch, ADS-B markers) before committing.
