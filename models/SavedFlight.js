const mongoose = require("mongoose");

const savedFlightSchema = new mongoose.Schema({
  callsign: {
    type: String,
    required: true,
    trim: true,
  },
  flightIata: {
    type: String,
    trim: true,
  },
  airline: {
    type: String,
    trim: true,
  },
  departureAirport: {
    type: String,
    trim: true,
  },
  departureIata: {
    type: String,
    trim: true,
  },
  arrivalAirport: {
    type: String,
    trim: true,
  },
  arrivalIata: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },
  savedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("SavedFlight", savedFlightSchema);
