// index.js
//@ts-check
const path = require("path");
const https = require("http");
const request = require("request");
const dateformat = require("dateformat");
const express = require("express");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
const port = 3000;

/**
 * Updates the hash/dictionary that will be sent in a PUT to the HUD.
 *
 * @param {*} hash
 * @param {string} key
 * @param {*} value
 * @returns
 */
function mergeIntoHash(hash, key, value) {
  if (hash == undefined) {
    hash = {};
  }

  if (value != undefined) {
    hash[key] = value;
  }

  return hash;
}

const app = express();

var getConfigOptions = {
  hostname: "localhost",
  path: "/settings",
  method: "GET",
  port: 8080
};

function getPutConfigOptions(payload) {
  return {
    url: "http://localhost:8080/settings",
    //hostname: "localhost",
    //path: "/settings",
    //port: 8080,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload
  };
}

function getNumber(inputString) {
  try {
    return Number(inputString);
  } catch (error) {
    return 0;
  }
}

function getBoolean(inputString) {
  try {
    inputString = inputString.toLowerCase();

    return inputString == "true";
  } catch (error) {
    return false;
  }
}

app.engine(
  ".hbs",
  exphbs({
    defaultLayout: "main",
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "views/layouts")
  })
);
app.set("view engine", ".hbs");
app.set("views", path.join(__dirname, "views"));

var jsonResultText = "";

function handleSettingResponse(restRes, resolve, reject) {
  if (restRes.statusCode >= 200 && restRes.statusCode < 300) {
    restRes.on("data", function(jsonResult) {
      console.log("BODY: " + jsonResult);
      resolve(JSON.parse(JSON.parse(jsonResult)));
    });
  } else {
    reject({ error: restRes.statusCode });
  }
}

function getHudConfig() {
  return new Promise((resolve, reject) => {
    request
      .get(getPutConfigOptions()["url"])
      .on("error", function(err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function(response) {
        response.body;
        handleSettingResponse(response, resolve, reject);
      });
  });
}

function postHudConfig(updateHash) {
  var options = getPutConfigOptions(JSON.stringify(updateHash));

  request(options, function(error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
}

function renderRefused(response, error) {
  console.log("Render");

  response.render("refused", {
    error: error,
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT")
  });
}

function renderPage(response, jsonConfig) {
  console.log("Render");
  response.render("home", {
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
    configJson: jsonConfig
  });
}

app.get("/", (request, response) => {
  getHudConfig()
    .then(function(jsonConfig) {
      renderPage(response, jsonConfig);
    })
    .catch(function(error) {
      renderRefused(response, error);
    });
});

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/", function(request, response) {
  var updateHash = mergeIntoHash({}, "data_source", request.body.data_source);
  updateHash = mergeIntoHash(
    updateHash,
    "declination",
    getNumber(request.body.declination)
  );
  updateHash = mergeIntoHash(
    updateHash,
    "distance_units",
    request.body.distance_units
  );
  updateHash = mergeIntoHash(
    updateHash,
    "flip_horizontal",
    getBoolean(request.body.flip_horizontal)
  );
  updateHash = mergeIntoHash(
    updateHash,
    "flip_vertical",
    getBoolean(request.body.flip_vertical)
  );
  updateHash = mergeIntoHash(updateHash, "ownship", request.body.ownship);
  updateHash = mergeIntoHash(
    updateHash,
    "stratux_address",
    request.body.stratux_address
  );
  updateHash = mergeIntoHash(
    updateHash,
    "traffic_report_removal_minutes",
    getNumber(request.body.traffic_report_removal_minutes)
  );

  postHudConfig(updateHash);
  renderPage(response, updateHash);
});

app.use(function(request, response) {
  response.status(404);
  response.render("404");
});

app.listen(port);
