// index.js
// @ts-check

import path from "path";
import request, { CoreOptions } from "request";
import dateformat from "dateformat";
import express from "express";
import bodyParser from "body-parser";
import expressHandlebars from "express-handlebars";
import ip from "ip";

const isPi = require(`detect-rpi`)

/**
 * Returns the address of the Stratux/ADS-B receiver.
 *
 * @returns {string}
 */
function getAddress(): string {
  return ip.address();
}

/**
 * Get the port that the StratuxHud is running on.
 *
 * @returns {number}
 */
function getWebServerPort(): number {
  if (isPi()) {
    return 80
  }

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

  if (value != undefined
    && value != null
    && !isNaN(value)) {
    hash[key] = value;
  }

  return hash;
}

const app = express();

function getStratuxRequest(
  requestDirectory: string,
): any {
  return `${getHudRestUri()}/${requestDirectory}`;
}

function getHudUrl(
  payload?: any
): any {
  return getStratuxRequest("settings");
}

function getHudElements(
  payload?: any
): any {
  return getStratuxRequest("view_elements");
}

function getHudViews(
  payload?: any
): any {
  return getStratuxRequest("views");
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
    layoutsDir: path.join(__dirname, "../views/layouts"),
    helpers: {
      ifeq: function (a: any, b: any, options: any) {
        if (a == b) { return options.fn(this); }
        return options.inverse(this);
      }
    }
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
        resolve(response);
      });
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
      .get(getHudUrl())
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
      .get(getHudElements())
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
      .get(getHudViews())
      .on("error", function (err) {
        console.log(err);
        reject(err.message);
      })
      .on("response", function (response) {
        handleJsonResponse(response, resolve, reject);
      });
  });
}

function putConfig(
  url: string,
  updateHash: any
) {
  return new Promise(function (resolve, reject) {
    request.put(
      url,
      { json: updateHash },
      function optionalCallback(
        err,
        httpResponse,
        body
      ) {
        if (err) {
          reject(err);
          return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
      }).on("end", () => {
        resolve();
      });
  });
}

function postHudConfig(
  updateHash: any
) {
  putConfig(getHudUrl(), updateHash);
}

function postViews(
  viewConfigs: any
) {
  putConfig(getHudViews(), viewConfigs);
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

function renderTextConfigPage(
  response: any,
  pagePath: string,
  jsonConfig: any,
  title: string,
  updateEnabled: boolean
) {
  console.log("Render");
  var jsonString: string = JSON.stringify(jsonConfig, null, 4);
  var rowCount: number = jsonString.split("\n").length;

  response.render("json_config", {
    path: pagePath,
    title: title,
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
    configJson: jsonString,
    rowCount: rowCount,
    disabled: updateEnabled ? "" : "disabled"
  });
}

app.get("/view_elements", (request, response) => {
  getViewElementsConfig()
    .then(function (jsonConfig) {
      renderTextConfigPage(
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
      renderTextConfigPage(response, "/views", jsonConfig, "Elements", true);
    })
    .catch(function (error) {
      renderRefused(response, error);
    });
});

app.get("/", (request, response) => {
  renderPage(response, null);
});

app.get("/config", (request, response) => {
  getHudConfig()
    .then(function (jsonConfig) {
      renderPage(response, jsonConfig, "config");
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
  renderTextConfigPage(
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
