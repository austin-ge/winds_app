const path = require("path");
const express = require("express");

const app = express();

const PORT = Number(process.env.PORT || 8080);
const ADSB_PRIMARY_URL = process.env.ADSB_PRIMARY_URL ||
  "http://100.92.158.48/dump1090/data/aircraft.json";
const ADSB_FALLBACK_URL = process.env.ADSB_FALLBACK_URL ||
  "https://api.adsb.lol/v2/point/42.703153/-87.958641/30";
const ADSB_TIMEOUT_MS = Number(process.env.ADSB_TIMEOUT_MS || 2000);

function setAdsbHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

async function proxyJson(url, res) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADSB_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, { signal: controller.signal });
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: "upstream_error",
        status: upstream.status
      });
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    const isAbort = err && err.name === "AbortError";
    res.status(504).json({
      error: isAbort ? "upstream_timeout" : "upstream_fetch_failed"
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

app.use(express.static(path.join(__dirname), { index: "index.html" }));

app.options(["/adsb", "/adsb-fallback"], (req, res) => {
  setAdsbHeaders(res);
  res.status(204).end();
});

app.get("/adsb", async (req, res) => {
  setAdsbHeaders(res);
  await proxyJson(ADSB_PRIMARY_URL, res);
});

app.get("/adsb-fallback", async (req, res) => {
  setAdsbHeaders(res);
  await proxyJson(ADSB_FALLBACK_URL, res);
});

app.listen(PORT, () => {
  console.log(`winds_app server listening on ${PORT}`);
});
