require("dotenv").config({ silent: true });
const express = require("express");
const { readFileSync } = require("fs");
const path = require("path");

// const fetch = require("node-fetch");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { name } = require("ejs");

const app = express();
const PORT = process.argv[2] || 4000;

app.listen(PORT);
process.stdout.write(`Server is running on port ${PORT}\n`);

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/** make the style sheet global */
app.get("/styles.css", (req, res) => {
  res.sendFile(path.resolve(__dirname, "templates", "styles.css"));
});

const uri = process.env.MONGODB_CONNECTION_STRING;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//Help3r for open sky api
function radiusToBoundingBox(lat, lon, radiusKm) {
  const R = 6371;
  const dLat = radiusKm / R;
  const dLon = radiusKm / (R * Math.cos((lat * Math.PI) / 180));

  return {
    lamin: lat - (dLat * 180) / Math.PI,
    lamax: lat + (dLat * 180) / Math.PI,
    lomin: lon - (dLon * 180) / Math.PI,
    lomax: lon + (dLon * 180) / Math.PI,
  };
}

app.get("/airport", async (req, res) => {
  const { icao } = req.query;
  if (!icao) {
    return res.status(400).json({ error: "icao required (ex: KJFK)" });
  }

  try {
    const response = await fetch(
      `https://airportdb.io/api/v1/airport/${icao.toUpperCase()}?apiToken=${
        process.env.AIRPORT_API_TOKEN
      }`
    );

    if (!response.ok) {
      return res.status(404).json({ error: "Airport not found" });
    }

    const data = await response.json();

    console.log("data", data);
    res.render("airportDetails", {
      name: data.name,
      icao_code: data.icao_code,
      iata_code: data.iata_code,
      latitude_deg: data.latitude_deg,
      longitude_deg: data.longitude_deg,
      elevation_ft: data.elevation_ft,
      flights: data.flights,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch airport data" });
  }
});

app.get("/opensky/airport", async (req, res) => {
  const { icao, radius = 80 } = req.query;
  if (!icao) {
    return res.status(400).json({ error: "icao required (ex: KJFK)" });
  }

  try {
    const airportRes = await fetch(
      `https://airportdb.io/api/v1/airport/${icao.toUpperCase()}?apiToken=${
        process.env.AIRPORT_API_TOKEN
      }`
    );

    if (!airportRes.ok) {
      return res.status(404).json({ error: "Airport not found" });
    }

    const airport = await airportRes.json();

    const box = radiusToBoundingBox(
      airport.latitude_deg,
      airport.longitude_deg,
      Number(radius)
    );

    const openSkyRes = await fetch(
      `https://opensky-network.org/api/states/all?lamin=${box.lamin}&lomin=${box.lomin}&lamax=${box.lamax}&lomax=${box.lomax}`
    );

    const openSkyData = await openSkyRes.json();

    res.render("airportFlights", {
      airport: {
        name: airport.name,
        icao: airport.icao_code,
        iata: airport.iata_code,
        lat: airport.latitude_deg,
        lon: airport.longitude_deg,
      },
      planes:
        openSkyData.states?.map((s) => ({
          icao24: s[0],
          callsign: s[1]?.trim() || "(unknown)",
          lat: s[6],
          lon: s[5],
          altitude_m: s[7],
          speed_mps: s[9],
          heading: s[10],
          on_ground: s[8],
        })).sort((a, b) => a.callsign.localeCompare(b.callsign)) || [],
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch live airport planes" });
  }
});

app.get("/opensky/location", async (req, res) => {
  const { lat, lon, radius = 50 } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon required" });
  }

  const box = radiusToBoundingBox(Number(lat), Number(lon), Number(radius));

  try {
    const response = await fetch(
      `https://opensky-network.org/api/states/all?lamin=${box.lamin}&lomin=${box.lomin}&lamax=${box.lamax}&lomax=${box.lomax}`
    );

    const data = await response.json();

    res.json(
      data.states?.map((s) => ({
        icao24: s[0],
        callsign: s[1]?.trim(),
        lat: s[6],
        lon: s[5],
        altitude_m: s[7],
        speed_mps: s[9],
        heading: s[10],
        on_ground: s[8],
      })) || []
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch OpenSky data" });
  }
});

app.get("/flight/details", async (req, res) => {
  const { callsign, flight_iata } = req.query;

  if (!callsign && !flight_iata) {
    return res.status(400).json({
      error: "Provide callsign (DAL230) or flight_iata (DL230)",
    });
  }

  try {
    let url;

    if (callsign) {
      const clean = callsign.trim().toUpperCase();
      url = `http://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATION_API_KEY}&flight_icao=${clean}&limit=1`;
    } else {
      url = `http://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATION_API_KEY}&flight_iata=${flight_iata}&limit=1`;
    }

    const response = await fetch(url);
    const data = await response.json();

    res.json({
      resolved_by: callsign ? "flight_icao" : "flight_iata",
      query: callsign || flight_iata,
      data,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch flight details" });
  }
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/airportQuery", async (req, res) => {
  res.render("airportQueryForm");
});