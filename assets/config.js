/* ================================
   CONFIGURATION
   Edit these values to customize for your dropzone
=================================== */

// Dropzone Information
const DZ_NAME = "Skydive Midwest";
const DZ_LAT = 42.703153;
const DZ_LON = -87.958641;

// Weather Data Source
const WIND_MODEL_URL = "https://api.open-meteo.com/v1/gfs";

// Altitude levels for wind display (in feet)
const desiredAltitudesFt = [
  0, 1000, 2000, 3000, 4000, 5000, 6000,
  7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000
];

// GFS pressure levels and their approximate altitudes
const pressureLevels = [1000, 925, 850, 700, 600];
const approxAltitudeFtByLevel = {
  1000: 361,
  925: 2625,
  850: 4921,
  700: 9843,
  600: 13780
};

// ADS-B Configuration
// Uses nginx proxy configured in nginx.conf to fetch from adsb.lol
const ADSB_ENDPOINT = "/adsb";

// Jump Plane Configuration
// Hex codes (ICAO 24-bit) for your jump planes (lowercase)
const JUMP_PLANE_HEXES = [
  "a93270", // N692DA
  "a939de", // N694DA
  "a93627", // N693DA
  "a948ba"  // N698DA
];

// Map hex -> tail number for sidebar display
const HEX_TO_TAIL = {
  "a93270": "N692DA",
  "a939de": "N694DA",
  "a93627": "N693DA",
  "a948ba": "N698DA"
};

// Skydiver & Canopy Parameters
// Adjust these based on your typical jump profile
const EXIT_ALTITUDE_FT = 13000;
const OPENING_ALTITUDE_FT = 3000;
const FREEFALL_TERMINAL_VELOCITY_MPH = 120;
const CANOPY_DESCENT_RATE_MPH = 15;
const CANOPY_FORWARD_SPEED_MPH = 25;

// Jump Run Geometry & Fudge Factors
// Adjust based on your aircraft type and DZ procedures
const JUMP_RUN_LENGTH_MILES = 0.8;      // total ground length of jump run
const JUMP_RUN_AIRSPEED_KNOTS = 90;     // target airspeed during jump run
const AIRPLANE_DRIFT_MILES   = 0.00;    // aircraft drift during climb to altitude (removed - not relevant to jump run calculation)
const LIGHT_TO_DOOR_MILES    = 0.10;    // distance from green light to door
const METERS_PER_MILE        = 1609.34; // conversion constant
