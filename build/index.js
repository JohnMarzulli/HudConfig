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
function getAddress() {
    var hostAddress = ip_1.default.address();
    return hostAddress;
}
function getWebServerPort() {
    return 3000;
}
function getHudRestUri() {
    var hostScheme = "http";
    var hostUri = hostScheme + "://" + getAddress() + ":8080";
    return hostUri;
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
    if (value != undefined) {
        hash[key] = value;
    }
    return hash;
}
var app = express_1.default();
function getStratuxRequest(requestDirectory, payload) {
    if (payload === void 0) { payload = null; }
    return {
        url: getHudRestUri() + "/" + requestDirectory,
        //hostname: "localhost",
        //path: "/settings",
        //port: 8080,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload
    };
}
function getHudUrl(payload) {
    return getStratuxRequest("settings", payload);
}
function getHudElements(payload) {
    return getStratuxRequest("view_elements", payload);
}
function getHudViews(payload) {
    return getStratuxRequest("views", payload);
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
    layoutsDir: path_1.default.join(__dirname, "../views/layouts")
}));
app.set("view engine", ".hbs");
app.set("views", path_1.default.join(__dirname, "../views"));
function handleSettingResponse(restRes, resolve, reject) {
    if (restRes.statusCode >= 200 && restRes.statusCode < 300) {
        restRes.on("data", function (jsonResult) {
            console.log("BODY: " + jsonResult);
            resolve(JSON.parse(JSON.parse(jsonResult)));
        });
    }
    else {
        reject({ error: restRes.statusCode });
    }
}
function handleJsonResponse(restRes, resolve, reject) {
    if (restRes.statusCode >= 200 && restRes.statusCode < 300) {
        restRes.on("data", function (jsonResult) {
            console.log("BODY: " + jsonResult);
            resolve(JSON.parse(jsonResult));
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
            .get(getHudUrl(null)["url"])
            .on("error", function (err) {
            console.log(err);
            reject(err.message);
        })
            .on("response", function (response) {
            handleSettingResponse(response, resolve, reject);
        });
    });
}
function getViewElementsConfig() {
    return new Promise(function (resolve, reject) {
        request_1.default
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
    return new Promise(function (resolve, reject) {
        request_1.default
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
function postHudConfig(updateHash) {
    var options = getHudUrl(JSON.stringify(updateHash));
    request_1.default.put(getHudViews()["url"], options).on("error", function (error) {
        console.log(error);
    });
}
function postViews(viewConfigs) {
    var updateHash = {
        views: JSON.parse(viewConfigs)
    };
    var options = getHudViews(JSON.stringify(updateHash));
    request_1.default(options, function (error, response, body) {
        if (error)
            throw new Error(error);
        console.log(body);
    });
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
function renderViewPage(response, pagePath, jsonConfig, title, updateEnabled) {
    console.log("Render");
    var rowCount = jsonConfig.split("\n").length;
    if (rowCount < 10) {
        rowCount = 10;
    }
    response.render("json_config", {
        path: pagePath,
        title: title,
        time: dateformat_1.default(Date.now(), "dd-mm-yy hh:MM:ss TT"),
        configJson: jsonConfig,
        rowCount: rowCount,
        disabled: updateEnabled ? "" : "disabled"
    });
}
app.get("/view_elements", function (request, response) {
    getViewElementsConfig()
        .then(function (jsonConfig) {
        renderViewPage(response, "/view_elements", jsonConfig, "View Elements", false);
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
        renderViewPage(response, "/views", jsonConfig, "Elements", true);
    })
        .catch(function (error) {
        renderRefused(response, error);
    });
});
app.get("/", function (request, response) {
    getHudConfig()
        .then(function (jsonConfig) {
        renderPage(response, jsonConfig);
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
    renderViewPage(response, "/view_elements", request.body.configJson, "View Elements", false);
});
app.post("/", function (request, response) {
    var updateHash = mergeIntoHash({}, "data_source", request.body.data_source);
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