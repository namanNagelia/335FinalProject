require("dotenv").config({ silent: true });
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const savedFlightsRouter = require("./routes/savedFlights");

const app = express();
const PORT = process.argv[2] || 4000;

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/styles.css", (req, res) => {
  res.sendFile(path.resolve(__dirname, "templates", "styles.css"));
});

const uri = process.env.MONGODB_CONNECTION_STRING;
mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to MongoDB with Mongoose");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

app.use("/saved", savedFlightsRouter);

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
        openSkyData.states
          ?.map((s) => ({
            icao24: s[0],
            callsign: s[1]?.trim() || "(unknown)",
            lat: s[6],
            lon: s[5],
            altitude_m: s[7],
            speed_mps: s[9],
            heading: s[10],
            on_ground: s[8],
          }))
          .sort((a, b) => a.callsign.localeCompare(b.callsign)) || [],
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

    let flights =
      data.states
        ?.map((s) => ({
          icao24: s[0],
          callsign: s[1]?.trim() || "(unknown)",
          lat: s[6],
          lon: s[5],
          altitude_m: s[7],
          speed_mps: s[9],
          heading: s[10],
          on_ground: s[8],
        }))
        .sort((a, b) => a.callsign.localeCompare(b.callsign))
        .sort((a, b) => a.on_ground - b.on_ground) || [];
    const airborneFlights = {
      flying: flights.filter((f) => f.on_ground === true),
      landed: flights.filter((f) => f.on_ground === false),
    };

    res.render("locationRadius", {
      location: {
        lat: lat,
        lon: lon,
      },
      radius: radius,
      airborneFlights: airborneFlights,
    });
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

    var flight =
      data && data.data && data.data.length > 0 ? data.data[0] : null;

    res.render("flightDetails", {
      flight: flight,
      meta: data && data.pagination ? data.pagination : null,
      saved: req.query.saved === "true",
      callsignParam: callsign || flight_iata,
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
