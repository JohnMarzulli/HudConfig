// index.js
// @ts-check

const path = require("path");
const request = require("request");
const dateformat = require("dateformat");
const express = require("express");
const bodyParser = require("body-parser");
const expressHandlebars = require("express-handlebars");
const isPi = require("detect-rpi");

var port = 3000;

if (isPi()) {
  port = 80;
}

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

function getHudUrl(payload) {
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
  expressHandlebars({
    defaultLayout: "main",
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "../views/layouts")
  })
);
app.set("view engine", ".hbs");
app.set("views", path.join(__dirname, "../views"));

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
      .get(getHudUrl()["url"])
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
  var options = getHudUrl(JSON.stringify(updateHash));

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

function renderPage(response, jsonConfig, page = "home") {
  console.log("Render");
  response.render(page, {
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

app.use(express.static(path.join(__dirname, "../public")));
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
  renderPage(response, updateHash, "current_config");
});

app.use(function(request, response) {
  response.status(404);
  response.render("404");
});

app.listen(port);
