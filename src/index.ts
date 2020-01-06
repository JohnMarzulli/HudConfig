// index.js
// @ts-check

import path from "path";
import request from "request";
import dateformat from "dateformat";
import express from "express";
import bodyParser from "body-parser";
import expressHandlebars from "express-handlebars";
import ip from "ip";

const isPi = require('detect-rpi');
const defaultStratuxAddress: string = "192.168.10.1";

/**
 * Returns the address of the Stratux/ADS-B receiver.
 * 
 * If the server *is NOT* running on a Pi, then it
 * returns the default address for a Stratux running on a Pi.
 * 
 * If it is a Pi, then returns the local address.
 *
 * @returns {string}
 */
function getAddress(): string {
  var hostAddress = isPi()
    ? ip.address()
    : defaultStratuxAddress;

  return hostAddress;
}

/**
 * Get the port that the StratuxHud is running on.
 *
 * @returns {number}
 */
function getWebServerPort(): number {
  return 3000;
}

function getHudRestUri(): string {
  return `http://${getAddress()}:8080`;
}

console.log(`Assuming HUD can be contacted at ${getHudRestUri()}`);
console.log(`Starting Web/NodeJs on ${getWebServerPort()}`);


/**
 * Updates the hash/dictionary that will be sent in a PUT to the HUD.
 *
 * @param {*} hash
 * @param {string} key
 * @param {*} value
 * @returns
 */
function mergeIntoHash(
  hash: any,
  key: string,
  value: any
): any {
  if (hash == undefined) {
    hash = {};
  }

  if (value != undefined) {
    hash[key] = value;
  }

  return hash;
}

const app = express();

function getStratuxRequest(
  requestDirectory: string,
  payload = null
): any {
  return {
    url: `${getHudRestUri()}/${requestDirectory}`,
    //hostname: "localhost",
    //path: "/settings",
    //port: 8080,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload
  }
}

function getHudUrl(
  payload?: any
): any {
  return getStratuxRequest("settings", payload);
}

function getHudElements(
  payload?: any
): any {
  return getStratuxRequest("view_elements", payload);
}

function getHudViews(
  payload?: any
): any {
  return getStratuxRequest("views", payload);
}

function getNumber(
  inputString: string
): number {
  try {
    return Number(inputString);
  } catch (error) {
    return 0;
  }
}

function getBoolean(
  inputString: string
): boolean {
  try {
    if (inputString == undefined) {
      return false;
    }

    inputString = inputString.toLowerCase();

    return inputString == "true" || inputString == "on";
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

function handleJsonResponse(
  restRes: request.Response,
  resolve: any,
  reject: any
) {
  let responseBody: string = '';
  if (restRes.statusCode >= 200 && restRes.statusCode < 300) {
    restRes.on("data", function (data) {
      responseBody += data;
    });
    restRes.on("end", () => {
      console.log(`BODY: ${responseBody}`);

      var firstLevelParse = JSON.parse(responseBody);

      if (typeof (firstLevelParse) === 'string') {
        resolve(JSON.parse(firstLevelParse));
      } else {
        resolve(firstLevelParse);
      }
    });
  } else {
    reject({ error: restRes.statusCode });
  }
}

function changeView(
  view: string
) {
  return new Promise((resolve, reject) => {
    request
      .get(`${getHudRestUri()}/view/${view}`)
      .on("error", function (err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function (response) {
        resolve(response)
      })
  });
}

/**
 * Signals the HUD to move to the next view
 *
 * @returns the JSON result from the call
 */
function nextView() {
  return changeView("next");
}

/**
 * Signals the HUD to move to the next view
 *
 * @returns the JSON result from the call
 */
function previousView() {
  return changeView("previous");
}

function getHudConfig() {
  return new Promise((resolve, reject) => {
    request
      .get(getHudUrl(null)["url"])
      .on("error", function (err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function (response) {
        handleJsonResponse(response, resolve, reject);
      });
  });
}

function getViewElementsConfig() {
  return new Promise((resolve, reject) => {
    request
      .get(getHudElements()["url"])
      .on("error", function (err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function (response) {
        handleJsonResponse(response, resolve, reject);
      });
  });
}

function getViewsConfig() {
  return new Promise((resolve, reject) => {
    request
      .get(getHudViews()["url"])
      .on("error", function (err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function (response) {
        handleJsonResponse(response, resolve, reject);
      });
  });
}

function postHudConfig(
  updateHash: any
) {
  var options = getHudUrl(JSON.stringify(updateHash));

  request.put(getHudViews()["url"], options).on("error", function (error) {
    console.log(error);
  });
}

function postViews(
  viewConfigs: any
) {
  var updateHash = {
    views: JSON.parse(viewConfigs)
  };
  var options = getHudViews(JSON.stringify(updateHash));

  request(options, function (error: string | undefined, response: any, body: any) {
    if (error) throw new Error(error);

    console.log(body);
  });
}

function renderRefused(
  response: any,
  error: string
) {
  console.log("Render");

  response.render("refused", {
    error: error,
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT")
  });
}

function renderPage(
  response: any,
  jsonConfig: any,
  page = "home"
) {
  console.log("Render");
  response.render(page, {
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
    configJson: jsonConfig
  });
}

function renderViewPage(
  response: any,
  pagePath: string,
  jsonConfig: any,
  title: string,
  updateEnabled: boolean
) {
  console.log("Render");
  var rowCount = jsonConfig.split("\n").length;
  if (rowCount < 10) {
    rowCount = 10;
  }

  response.render("json_config", {
    path: pagePath,
    title: title,
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
    configJson: jsonConfig,
    rowCount: rowCount,
    disabled: updateEnabled ? "" : "disabled"
  });
}

app.get("/view_elements", (request, response) => {
  getViewElementsConfig()
    .then(function (jsonConfig) {
      renderViewPage(
        response,
        "/view_elements",
        jsonConfig,
        "View Elements",
        false
      );
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.get("/view/previous", (request, response) => {
  previousView()
    .then(function (jsonConfig) {
      response.redirect('/');
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.get("/view/next", (request, response) => {
  nextView()
    .then(function (jsonConfig) {
      response.redirect('/');
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.get("/views", (request, response) => {
  getViewsConfig()
    .then(function (jsonConfig) {
      renderViewPage(response, "/views", jsonConfig, "Elements", true);
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.get("/", (request, response) => {
  getHudConfig()
    .then(function (jsonConfig) {
      renderPage(response, jsonConfig);
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/views", function (request, response) {
  postViews(request.body.configJson);
  renderViewPage(
    response,
    "/view_elements",
    request.body.configJson,
    "View Elements",
    false
  );
});

app.post("/", function (request, response) {
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
    "aithre",
    getBoolean(request.body.aithre)
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

app.use(function (request, response) {
  response.status(404);
  response.render("404");
});

app.listen(getWebServerPort());
