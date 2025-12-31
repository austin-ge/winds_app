/* ================================
   RUNTIME STATE
   (Configuration moved to config.js)
=================================== */

// Winds data fetched from API
let windsAloft = [];

// Dynamic upwind/downwind offset (miles) for first exit (green light)
let jumpRunOffsetMiles = 0;

// Current jump run heading (deg), maintained in JS
let currentHeadingDeg = 270;

// Track where the current heading came from: "manual" or "auto-winds"
let jumpRunSource = "auto-winds";

/* ================================
   Utility functions
=================================== */
function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
  const R = 6371000;
  const brng = bearingDeg * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / R) +
    Math.cos(latRad) * Math.sin(distanceMeters / R) * Math.cos(brng)
  );

  const newLon = lonRad + Math.atan2(
    Math.sin(brng) * Math.sin(distanceMeters / R) * Math.cos(latRad),
    Math.cos(distanceMeters / R) - Math.sin(latRad) * Math.sin(newLat)
  );

  return {
    lat: newLat * 180 / Math.PI,
    lon: newLon * 180 / Math.PI
  };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* Small helper: get wind closest to a given altitude */
function getWindAtAlt(altFt) {
  if (!windsAloft.length) return null;
  let best = windsAloft[0];
  let bestDiff = Math.abs(best.altFt - altFt);
  for (const w of windsAloft) {
    const d = Math.abs(w.altFt - altFt);
    if (d < bestDiff) {
      best = w;
      bestDiff = d;
    }
  }
  return best;
}

/* ================================
   Render Winds Table
=================================== */
function renderWindsTable() {
  const tbody = document.getElementById("winds-table-body");
  tbody.innerHTML = "";

  if (!windsAloft.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Loading…</td></tr>`;
    return;
  }

  windsAloft.forEach(w => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.altFt}</td>
      <td>${Math.round(w.dirDeg)}</td>
      <td>${Math.round(w.speedKt)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================================
   Dynamic offset calculation (New as of 2025-12-31)
=================================== */
function computeOffsetMiles(jumpRunHeadingDeg) {
    if (!windsAloft.length) return jumpRunOffsetMiles || 0;

    const knotsToMph = 1.15078;
    const ftPerMile = 5280;

    // Helper to calculate drift vector (in miles) for a given phase
    const calculateDriftVector = (startAltFt, endAltFt, descentRateMph) => {
        let dx = 0; // miles east
        let dy = 0; // miles north

        const relevantWinds = windsAloft
            .filter(w => w.altFt >= endAltFt && w.altFt <= startAltFt)
            .sort((a, b) => b - a); // Process from high to low

        if (relevantWinds.length === 0) {
            // If no wind data in range, use the closest single point
            const avgAlt = (startAltFt + endAltFt) / 2;
            const wind = getWindAtAlt(avgAlt);
            if (!wind) return { dx: 0, dy: 0 };

            const layerThicknessFt = startAltFt - endAltFt;
            if (layerThicknessFt <= 0) return { dx: 0, dy: 0 };
            
            const timeInLayerHours = (layerThicknessFt / ftPerMile) / descentRateMph;
            const windDirTo = (wind.dirDeg + 180) % 360;
            const windSpeedMph = wind.speedKt * knotsToMph;
            const driftDistanceMiles = windSpeedMph * timeInLayerHours;
            
            const theta = windDirTo * Math.PI / 180;
            dx = Math.sin(theta) * driftDistanceMiles;
            dy = Math.cos(theta) * driftDistanceMiles;
            return { dx, dy };
        }
        
        // Ensure start and end altitudes are part of the calculation
        const altitudes = [startAltFt, ...relevantWinds.map(w => w.altFt), endAltFt];
        const uniqueAlts = [...new Set(altitudes)].sort((a, b) => b - a);

        for (let i = 0; i < uniqueAlts.length - 1; i++) {
            const upperAltFt = uniqueAlts[i];
            const lowerAltFt = uniqueAlts[i+1];
            
            if (upperAltFt <= lowerAltFt) continue;

            const avgAlt = (upperAltFt + lowerAltFt) / 2;
            const wind = getWindAtAlt(avgAlt);
            if (!wind) continue;

            const layerThicknessFt = upperAltFt - lowerAltFt;
            const timeInLayerHours = (layerThicknessFt / ftPerMile) / descentRateMph;

            const windDirTo = (wind.dirDeg + 180) % 360;
            const windSpeedMph = wind.speedKt * knotsToMph;
            const driftDistanceMiles = windSpeedMph * timeInLayerHours;
            
            const theta = windDirTo * Math.PI / 180;
            dx += Math.sin(theta) * driftDistanceMiles;
            dy += Math.cos(theta) * driftDistanceMiles;
        }

        return { dx, dy };
    };

    // 1. Calculate canopy flight characteristics
    const timeUnderCanopyHours = (OPENING_ALTITUDE_FT - 0) / ftPerMile / CANOPY_DESCENT_RATE_MPH;
    const canopyPassiveDrift = calculateDriftVector(OPENING_ALTITUDE_FT, 0, CANOPY_DESCENT_RATE_MPH);

    // 2. Determine the required opening point relative to the DZ
    const H_rad = jumpRunHeadingDeg * Math.PI / 180;
    const headingUx = Math.sin(H_rad);
    const headingUy = Math.cos(H_rad);
    const canopyDriftAlongHeading = canopyPassiveDrift.dx * headingUx + canopyPassiveDrift.dy * headingUy;
    
    const flyableDistMiles = CANOPY_FORWARD_SPEED_MPH * timeUnderCanopyHours;

    const openingPointOffsetMiles = -(flyableDistMiles + canopyDriftAlongHeading);
    
    // 3. Calculate freefall drift
    const freefallDrift = calculateDriftVector(EXIT_ALTITUDE_FT, OPENING_ALTITUDE_FT, FREEFALL_TERMINAL_VELOCITY_MPH);
    const freefallDriftAlongHeading = freefallDrift.dx * headingUx + freefallDrift.dy * headingUy;

    // 4. The Exit Point is the Opening Point, adjusted for freefall drift.
    const exitPointOffsetMiles = openingPointOffsetMiles - freefallDriftAlongHeading;

    // 5. Final offset for the green light (start of jump run)
    const fudge = AIRPLANE_DRIFT_MILES + LIGHT_TO_DOOR_MILES;
    let offset = exitPointOffsetMiles - (JUMP_RUN_LENGTH_MILES / 2) - fudge;

    if (!Number.isFinite(offset)) offset = 0;

    const maxOffset = 4.0; // Increased max offset for potentially larger spots
    if (offset > maxOffset) offset = maxOffset;
    if (offset < -maxOffset) offset = -maxOffset;

    return offset;
}

/* Helper: a point at signed distance sMiles along the jump run axis */
function pointOnRun(sMiles, headingDeg) {
  const upwindBearing = (headingDeg + 180) % 360;
  const distMeters = Math.abs(sMiles) * METERS_PER_MILE;

  if (sMiles >= 0) {
    return destinationPoint(DZ_LAT, DZ_LON, headingDeg, distMeters);
  } else {
    return destinationPoint(DZ_LAT, DZ_LON, upwindBearing, distMeters);
  }
}

/* ================================
   Auto Heading From Winds (5k–14k)
=================================== */
function autoUpdateHeadingFromWinds() {
  const slice = windsAloft.filter(w => w.altFt >= 5000 && w.altFt <= 14000);
  if (!slice.length) {
    console.warn("Auto heading: no winds in 5k–14k range");
    return;
  }

  let sumX = 0, sumY = 0, sumSpeed = 0;

  slice.forEach(w => {
    const rad = w.dirDeg * Math.PI / 180;
    sumX += Math.sin(rad) * w.speedKt;
    sumY += Math.cos(rad) * w.speedKt;
    sumSpeed += w.speedKt;
  });

  const avgRad = Math.atan2(sumX, sumY);
  let avgDeg = avgRad * 180 / Math.PI;
  if (avgDeg < 0) avgDeg += 360;

  currentHeadingDeg = Math.round(avgDeg);

  jumpRunOffsetMiles = computeOffsetMiles(currentHeadingDeg);

  jumpRunSource = "auto-winds";
  updateJumpRun();
}

/* ================================
   Fetch live winds from GFS
=================================== */
async function fetchWinds() {
  try {
    const url =
      `${WIND_MODEL_URL}?latitude=${DZ_LAT}&longitude=${DZ_LON}` +
      `&hourly=` +
      `wind_speed_1000hPa,wind_direction_1000hPa,` +
      `wind_speed_925hPa,wind_direction_925hPa,` +
      `wind_speed_850hPa,wind_direction_850hPa,` +
      `wind_speed_700hPa,wind_direction_700hPa,` +
      `wind_speed_600hPa,wind_direction_600hPa` +
      `&wind_speed_unit=kn&timezone=auto`;

    const res = await fetch(url);
    const data = await res.json();
    const ws = data.hourly;

    if (!ws || !ws.time || !ws.time.length) {
      console.error("No hourly data from Open-Meteo:", data);
      return;
    }

    const now = new Date();
    let tIndex = 0;
    let bestDiff = Infinity;

    ws.time.forEach((tStr, i) => {
      const t = new Date(tStr);
      const diff = Math.abs(t.getTime() - now.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        tIndex = i;
      }
    });

    const windsByLevel = [];

    function pushLevel(level) {
      const speedArr = ws[`wind_speed_${level}hPa`];
      const dirArr = ws[`wind_direction_${level}hPa`];
      if (!speedArr || !dirArr) return;

      windsByLevel.push({
        level,
        altFt: approxAltitudeFtByLevel[level],
        dirDeg: dirArr[tIndex],
        speedKt: speedArr[tIndex]
      });
    }

    pressureLevels.forEach(pushLevel);

    if (!windsByLevel.length) {
      console.error("No windsByLevel from Open-Meteo:", ws);
      return;
    }

    windsAloft = desiredAltitudesFt.map(altFt => {
      let best = windsByLevel[0];
      let bestDiffAlt = Math.abs(altFt - best.altFt);

      windsByLevel.forEach(w => {
        const d = Math.abs(altFt - w.altFt);
        if (d < bestDiffAlt) {
          best = w;
          bestDiffAlt = d;
        }
      });

      return {
        altFt,
        dirDeg: best.dirDeg,
        speedKt: best.speedKt
      };
    });

    renderWindsTable();
    autoUpdateHeadingFromWinds();

    console.log("Open-Meteo time used:", ws.time[tIndex]);
    console.log("windsAloft (mapped to ft):", windsAloft);

  } catch (err) {
    console.error("Auto heading: error loading winds", err);
  }
}

/* ================================
   MAP + JUMP RUN
=================================== */
document.getElementById("dz-name").textContent = DZ_NAME;
document.getElementById("dz-lat").textContent = DZ_LAT.toFixed(5);
document.getElementById("dz-lon").textContent = DZ_LON.toFixed(5);

// Init map centered on DZ with zoom 15
const map = L.map("map").setView([DZ_LAT, DZ_LON], 15);

// SATELLITE TILES (Esri World Imagery)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"
  }
).addTo(map);

L.marker([DZ_LAT, DZ_LON]).addTo(map).bindPopup(DZ_NAME).openPopup();

let jumpRunGroup = null;

function updateJumpRun() {
  const heading = currentHeadingDeg || 270;

  const offset = jumpRunOffsetMiles || 0;
  const runMiles = JUMP_RUN_LENGTH_MILES;

  const sStart = offset;
  const sEnd   = offset + runMiles;

  const startPointObj = pointOnRun(sStart, heading);
  const endPointObj   = pointOnRun(sEnd, heading);

  const startLatLng = [startPointObj.lat, startPointObj.lon];
  const endLatLng   = [endPointObj.lat, endPointObj.lon];

  if (jumpRunGroup) {
    map.removeLayer(jumpRunGroup);
  }

  const mainLine = L.polyline([startLatLng, endLatLng], {
    weight: 5,
    color: "#ffeb3b",
    opacity: 0.9
  });

  const arrowLenMeters = runMiles * METERS_PER_MILE * 0.12;
  const tipLat = endPointObj.lat;
  const tipLon = endPointObj.lon;

  const left = destinationPoint(tipLat, tipLon, heading - 150, arrowLenMeters);
  const right = destinationPoint(tipLat, tipLon, heading + 150, arrowLenMeters);

  const arrowLeft = L.polyline(
    [[tipLat, tipLon], [left.lat, left.lon]],
    { weight: 5, color: "#ffeb3b", opacity: 0.9 }
  );
  const arrowRight = L.polyline(
    [[tipLat, tipLon], [right.lat, right.lon]],
    { weight: 5, color: "#ffeb3b", opacity: 0.9 }
  );

  jumpRunGroup = L.layerGroup([mainLine, arrowLeft, arrowRight]).addTo(map);

  // Map stays centered on DZ at zoom 15

  const summaryEl = document.getElementById("jump-run-summary");
  const updatedEl = document.getElementById("jump-run-updated");

  if (summaryEl) {
    const headingStr = Math.round(heading);
    const offMi = jumpRunOffsetMiles || 0;
    const sign = offMi >= 0 ? "+" : "";
    const offStr = `${sign}${Math.abs(offMi).toFixed(2)}`;
    summaryEl.textContent = `Jump Run ${headingStr}@${offStr}`;
  }

  if (updatedEl) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    updatedEl.textContent = `Updated ${timeStr}`;
  }
}

/* ================================
   ADS-B: All traffic + highlighted jump plane
=================================== */
let jumpPlaneMarker = null;
let jumpPlaneTrackLine = null;
let jumpPlaneTrackCoords = [];
let otherAircraftMarkers = {};

function clearJumpPlaneHighlight() {
  if (jumpPlaneMarker) {
    map.removeLayer(jumpPlaneMarker);
    jumpPlaneMarker = null;
  }
  if (jumpPlaneTrackLine) {
    map.removeLayer(jumpPlaneTrackLine);
    jumpPlaneTrackLine = null;
  }
  jumpPlaneTrackCoords = [];

  const statusEl = document.getElementById("aircraft-status");
  if (statusEl) {
    statusEl.textContent = "No jump aircraft currently tracked.";
  }
}

function updateJumpPlaneHighlight(lat, lon, trackDeg, planeMeta) {
  const latLng = [lat, lon];
  jumpPlaneTrackCoords.push(latLng);
  if (jumpPlaneTrackCoords.length > 200) {
    jumpPlaneTrackCoords.shift();
  }

  if (!jumpPlaneMarker) {
    const icon = L.divIcon({
      className: "aircraft-icon",
      html: "✈️",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    jumpPlaneMarker = L.marker(latLng, { icon }).addTo(map);
  } else {
    jumpPlaneMarker.setLatLng(latLng);
  }

  if (!jumpPlaneTrackLine) {
    jumpPlaneTrackLine = L.polyline(jumpPlaneTrackCoords, {
      weight: 2,
      dashArray: "4 4"
    }).addTo(map);
  } else {
    jumpPlaneTrackLine.setLatLngs(jumpPlaneTrackCoords);
  }

  // Sidebar info for jump ship
  const statusEl = document.getElementById("aircraft-status");

  if (statusEl && planeMeta) {
    const hex = (planeMeta.hex || planeMeta.icao || "").toLowerCase();
    const apiReg = planeMeta.r || planeMeta.registration;
    const tail = apiReg || HEX_TO_TAIL[hex] || hex.toUpperCase();

    const altRaw = planeMeta.alt_geom ?? planeMeta.alt_baro ?? 0;
    const alt = Math.round(altRaw);
    const gs = planeMeta.gs != null ? Math.round(planeMeta.gs) : null;

    let text = `Tracking: ${tail}`;
    if (hex) text += ` (${hex.toUpperCase()})`;
    text += ` at ${alt} ft`;
    if (gs !== null) {
      text += `, GS ${gs} kt`;
    }
    statusEl.textContent = text;
  }
}

// Brighter dots + tooltip for all traffic
function updateAllTrafficMarkers(planes, excludeHex) {
  const seenHex = new Set();

  planes.forEach(a => {
    const hex = (a.hex || a.icao || "").toLowerCase();
    if (!hex) return;
    if (hex === excludeHex) return;

    const lat = a.lat;
    const lon = a.lon;
    if (typeof lat !== "number" || typeof lon !== "number") return;

    seenHex.add(hex);

    const apiReg = a.r || a.registration || hex.toUpperCase();
    const alt = Math.round(a.alt_geom ?? a.alt_baro ?? 0);
    const gs  = a.gs != null ? Math.round(a.gs) : null;

    let tooltipText = `${apiReg}\n${alt} ft`;
    if (gs !== null) {
      tooltipText += `\nGS ${gs} kt`;
    }

    if (otherAircraftMarkers[hex]) {
      const marker = otherAircraftMarkers[hex];
      marker.setLatLng([lat, lon]);

      if (marker.setTooltipContent) {
        marker.setTooltipContent(tooltipText);
      } else {
        marker.bindTooltip(tooltipText, {
          direction: "top",
          offset: [0, -4]
        });
      }
    } else {
      const marker = L.circleMarker([lat, lon], {
        radius: 6,
        weight: 1.5,
        color: "#000000",
        fillColor: "#00ffff",
        fillOpacity: 0.9
      });

      marker.bindTooltip(tooltipText, {
        direction: "top",
        offset: [0, -4]
      });

      marker.addTo(map);
      otherAircraftMarkers[hex] = marker;
    }
  });

  Object.entries(otherAircraftMarkers).forEach(([hex, marker]) => {
    if (!seenHex.has(hex)) {
      map.removeLayer(marker);
      delete otherAircraftMarkers[hex];
    }
  });
}

async function fetchAircraftPosition() {
  try {
    const res = await fetch(ADSB_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error("ADS-B HTTP " + res.status);
    const data = await res.json();

    const planes = data.aircraft || data.ac || [];
    if (!planes.length) {
      clearJumpPlaneHighlight();
      Object.values(otherAircraftMarkers).forEach(m => map.removeLayer(m));
      otherAircraftMarkers = {};
      return;
    }

    const planesInRange = planes.filter(a => {
      const lat = a.lat;
      const lon = a.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return false;

      const alt = a.alt_geom ?? a.alt_baro ?? 0;
      if (alt < 0 || alt > 50000) return false;

      return true;
    });

    const jumpCandidates = planesInRange.filter(a => {
      const hex = (a.hex || a.icao || "").toLowerCase();
      return JUMP_PLANE_HEXES.includes(hex);
    });

    let chosenJump = null;

    if (jumpCandidates.length) {
      chosenJump = jumpCandidates[0];
      for (const a of jumpCandidates.slice(1)) {
        const altBest = chosenJump.alt_geom ?? chosenJump.alt_baro ?? 0;
        const altCur = a.alt_geom ?? a.alt_baro ?? 0;
        if (altCur > altBest) chosenJump = a;
      }

      const lat = chosenJump.lat;
      const lon = chosenJump.lon;
      updateJumpPlaneHighlight(lat, lon, chosenJump.track || chosenJump.heading || 0, chosenJump);
    } else {
      clearJumpPlaneHighlight();
    }

    const chosenHex = chosenJump ? (chosenJump.hex || chosenJump.icao || "").toLowerCase() : null;
    updateAllTrafficMarkers(planesInRange, chosenHex);

  } catch (err) {
    console.error("ADS-B error:", err);
  }
}

/* ================================
   AUTO-UPDATES
=================================== */

// Initial draw (before winds load)
updateJumpRun();
renderWindsTable();

// Load winds on page load
fetchWinds();
// Refresh winds every hour
setInterval(fetchWinds, 60 * 60 * 1000);

// Start ADS-B polling (every 10 seconds)
fetchAircraftPosition();
setInterval(fetchAircraftPosition, 10 * 1000);
