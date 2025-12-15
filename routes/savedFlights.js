const express = require("express");
const router = express.Router();
const SavedFlight = require("../models/SavedFlight");

router.get("/", async (req, res) => {
  try {
    const flights = await SavedFlight.find().sort({ savedAt: -1 });
    res.render("savedFlights", { flights, message: req.query.message });
  } catch (err) {
    console.error("Error fetching saved flights:", err);
    res.render("savedFlights", { flights: [], message: "Error loading flights" });
  }
});

router.get("/add", (req, res) => {
  res.render("addFlight", { prefill: {} });
});

router.post("/add", async (req, res) => {
  try {
    const {
      callsign,
      flightIata,
      airline,
      departureAirport,
      departureIata,
      arrivalAirport,
      arrivalIata,
      status,
      notes,
      priority,
    } = req.body;

    const newFlight = new SavedFlight({
      callsign: callsign || "Unknown",
      flightIata,
      airline,
      departureAirport,
      departureIata,
      arrivalAirport,
      arrivalIata,
      status,
      notes,
      priority: priority || "low",
    });

    await newFlight.save();
    res.redirect("/saved?message=Flight saved successfully!");
  } catch (err) {
    console.error("Error saving flight:", err);
    res.redirect("/saved?message=Error saving flight");
  }
});

router.post("/quick-add", async (req, res) => {
  try {
    const { callsign, notes, priority } = req.body;

    let flightData = {
      callsign: callsign || "Unknown",
      notes,
      priority: priority || "low",
    };

    if (callsign) {
      const clean = callsign.trim().toUpperCase();
      const url = `http://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATION_API_KEY}&flight_icao=${clean}&limit=1`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.data && data.data.length > 0) {
        const flight = data.data[0];
        flightData.flightIata = flight.flight?.iata || "";
        flightData.airline = flight.airline?.name || "";
        flightData.departureAirport = flight.departure?.airport || "";
        flightData.departureIata = flight.departure?.iata || "";
        flightData.arrivalAirport = flight.arrival?.airport || "";
        flightData.arrivalIata = flight.arrival?.iata || "";
        flightData.status = flight.flight_status || "";
      }
    }

    const newFlight = new SavedFlight(flightData);
    await newFlight.save();

    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({ success: true, message: "Flight saved!" });
    }

    res.redirect("/saved?message=Flight saved successfully!");
  } catch (err) {
    console.error("Error saving flight:", err);
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(500).json({ success: false, message: "Error saving flight" });
    }
    res.redirect("/saved?message=Error saving flight");
  }
});

router.post("/delete/:id", async (req, res) => {
  try {
    await SavedFlight.findByIdAndDelete(req.params.id);
    res.redirect("/saved?message=Flight deleted");
  } catch (err) {
    console.error("Error deleting flight:", err);
    res.redirect("/saved?message=Error deleting flight");
  }
});

module.exports = router;
