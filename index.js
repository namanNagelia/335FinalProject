require("dotenv").config({silent: true});
const express = require('express');
const { readFileSync } = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

/** set up the application */
const app = express();
const PORT = process.argv[2] || 3000;

/* Set up cli for the server*/
app.listen(PORT);
process.stdout.write(`Server is running on port ${PORT}\n`);

app.set('view engine', 'ejs');
app.set("views", path.resolve(__dirname, "templates"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/** make the style sheet global */
app.get('/styles.css', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'templates', 'styles.css'));
});

const uri = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.render('home');
});