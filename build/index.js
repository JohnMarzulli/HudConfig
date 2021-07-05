"use strict";
// index.js
// @ts-check
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = __importDefault(require("path"));
var request_1 = __importDefault(require("request"));
var dateformat_1 = __importDefault(require("dateformat"));
var express_1 = __importDefault(require("express"));
var body_parser_1 = __importDefault(require("body-parser"));
var express_handlebars_1 = __importDefault(require("express-handlebars"));
var ip_1 = __importDefault(require("ip"));
var isPi = require("detect-rpi");
/**
 * Returns the address of the Stratux/ADS-B receiver.
 *
 * @returns {string}
 */
function getAddress() {
    return ip_1.default.address();
}
/**
 * Get the port that the StratuxHud is running on.
 *
 * @returns {number}
 */
function getWebServerPort() {
    if (isPi()) {
        return 80;
    }
    return 3000;
}
function getHudRestUri() {
    return "http://" + getAddress() + ":8080";
}
console.log("Assuming HUD can be contacted at " + getHudRestUri());
console.log("Starting Web/NodeJs on " + getWebServerPort());
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
    if (value != undefined
        && value != null
        && !isNaN(value)) {
        hash[key] = value;
    }
    return hash;
}
var app = express_1.default();
function getStratuxRequest(requestDirectory) {
    return getHudRestUri() + "/" + requestDirectory;
}
function getHudUrl(payload) {
    return getStratuxRequest("settings");
}
function getHudElements(payload) {
    return getStratuxRequest("view_elements");
}
function getHudViews(payload) {
    return getStratuxRequest("views");
}
function getNumber(inputString) {
    try {
        return Number(inputString);
    }
    catch (error) {
        return 0;
    }
}
function getBoolean(inputString) {
    try {
        if (inputString == undefined) {
            return false;
        }
        inputString = inputString.toLowerCase();
        return inputString == "true" || inputString == "on";
    }
    catch (error) {
        return false;
    }
}
app.engine(".hbs", express_handlebars_1.default({
    defaultLayout: "main",
    extname: ".hbs",
    layoutsDir: path_1.default.join(__dirname, "../views/layouts"),
    helpers: {
        ifeq: function (a, b, options) {
            if (a == b) {
                return options.fn(this);
            }
            return options.inverse(this);
        }
    }
}));
app.set("view engine", ".hbs");
app.set("views", path_1.default.join(__dirname, "../views"));
function handleJsonResponse(restRes, resolve, reject) {
    var responseBody = '';
    if (restRes.statusCode >= 200 && restRes.statusCode < 300) {
        restRes.on("data", function (data) {
            responseBody += data;
        });
        restRes.on("end", function () {
            console.log("BODY: " + responseBody);
            var firstLevelParse = JSON.parse(responseBody);
            if (typeof (firstLevelParse) === 'string') {
                resolve(JSON.parse(firstLevelParse));
            }
            else {
                resolve(firstLevelParse);
            }
        });
    }
    else {
        reject({ error: restRes.statusCode });
    }
}
function changeView(view) {
    return new Promise(function (resolve, reject) {
        request_1.default
            .get(getHudRestUri() + "/view/" + view)
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
    return new Promise(function (resolve, reject) {
        request_1.default
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
    return new Promise(function (resolve, reject) {
        request_1.default
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
    return new Promise(function (resolve, reject) {
        request_1.default
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
function putConfig(url, updateHash) {
    return new Promise(function (resolve, reject) {
        request_1.default.put(url, { json: updateHash }, function optionalCallback(err, httpResponse, body) {
            if (err) {
                reject(err);
                return console.error('upload failed:', err);
            }
            console.log('Upload successful!  Server responded with:', body);
        }).on("end", function () {
            resolve();
        });
    });
}
function postHudConfig(updateHash) {
    putConfig(getHudUrl(), updateHash);
}
function postViews(viewConfigs) {
    putConfig(getHudViews(), viewConfigs);
}
function renderRefused(response, error) {
    console.log("Render");
    response.render("refused", {
        error: error,
        time: dateformat_1.default(Date.now(), "dd-mm-yy hh:MM:ss TT")
    });
}
function renderPage(response, jsonConfig, page) {
    if (page === void 0) { page = "home"; }
    console.log("Render");
    response.render(page, {
        time: dateformat_1.default(Date.now(), "dd-mm-yy hh:MM:ss TT"),
        configJson: jsonConfig
    });
}
function renderTextConfigPage(response, pagePath, jsonConfig, title, updateEnabled) {
    console.log("Render");
    var jsonString = JSON.stringify(jsonConfig, null, 4);
    var rowCount = jsonString.split("\n").length;
    response.render("json_config", {
        path: pagePath,
        title: title,
        time: dateformat_1.default(Date.now(), "dd-mm-yy hh:MM:ss TT"),
        configJson: jsonString,
        rowCount: rowCount,
        disabled: updateEnabled ? "" : "disabled"
    });
}
app.get("/view_elements", function (request, response) {
    getViewElementsConfig()
        .then(function (jsonConfig) {
        renderTextConfigPage(response, "/view_elements", jsonConfig, "View Elements", false);
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.get("/view/previous", function (request, response) {
    previousView()
        .then(function (jsonConfig) {
        response.redirect('/');
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.get("/view/next", function (request, response) {
    nextView()
        .then(function (jsonConfig) {
        response.redirect('/');
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.get("/views", function (request, response) {
    getViewsConfig()
        .then(function (jsonConfig) {
        renderTextConfigPage(response, "/views", jsonConfig, "Elements", true);
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.get("/", function (request, response) {
    renderPage(response, null);
});
app.get("/config", function (request, response) {
    getHudConfig()
        .then(function (jsonConfig) {
        renderPage(response, jsonConfig, "config");
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.post("/views", function (request, response) {
    postViews(request.body.configJson);
    renderTextConfigPage(response, "/view_elements", request.body.configJson, "View Elements", false);
});
app.post("/", function (request, response) {
    var updateHash = mergeIntoHash({}, "data_source", request.body.data_source);
    updateHash = mergeIntoHash(updateHash, "enable_declination", getBoolean(request.body.enable_declination));
    updateHash = mergeIntoHash(updateHash, "declination", getNumber(request.body.declination));
    updateHash = mergeIntoHash(updateHash, "distance_units", request.body.distance_units);
    updateHash = mergeIntoHash(updateHash, "aithre", getBoolean(request.body.aithre));
    updateHash = mergeIntoHash(updateHash, "flip_horizontal", getBoolean(request.body.flip_horizontal));
    updateHash = mergeIntoHash(updateHash, "flip_vertical", getBoolean(request.body.flip_vertical));
    updateHash = mergeIntoHash(updateHash, "stratux_address", request.body.stratux_address);
    updateHash = mergeIntoHash(updateHash, "traffic_report_removal_minutes", getNumber(request.body.traffic_report_removal_minutes));
    postHudConfig(updateHash);
    renderPage(response, updateHash, "current_config");
});
app.use(function (request, response) {
    response.status(404);
    response.render("404");
});
app.listen(getWebServerPort());
//# sourceMappingURL=index.js.map