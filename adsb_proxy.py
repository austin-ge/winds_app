from flask import Flask, Response
import requests

app = Flask(__name__)

DZ_LAT = 42.703153
DZ_LON = -87.958641

# 10 NM radius (~11.5 statute miles) around the DZ
ADSB_LOL_URL = f"https://api.adsb.lol/v2/point/{DZ_LAT}/{DZ_LON}/20"

@app.route("/adsb")
def adsb():
    try:
        r = requests.get(ADSB_LOL_URL, timeout=5)

        resp = Response(
            r.content,
            status=r.status_code,
            mimetype="application/json"
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp

    except Exception as e:
        print("ADS-B proxy exception:", repr(e))
        resp = Response(
            '{"error":"ADS-B proxy exception","detail":"%s"}' % str(e),
            status=500,
            mimetype="application/json"
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)