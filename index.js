// index.js
const path = require("path");
const https = require("http");
const dateformat = require("dateformat");
const express = require("express");
const exphbs = require("express-handlebars");
const port = 3000;

const app = express();

var getConfigOptions = {
  hostname: "localhost",
  path: "/settings",
  method: "GET",
  port: 8080
};

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

function getHudConfig() {
  return new Promise((resolve, reject) => {
    try {
      https
        .request(getConfigOptions, function(restRes) {
          console.log("STATUS: " + restRes.statusCode);
          restRes.on("data", function(jsonResult) {
            console.log("BODY: " + jsonResult);
            resolve(JSON.parse(JSON.parse(jsonResult)));
          });
        })
        .end();
    } catch (err) {
      resolve({ error: err });
    }
  });
}

app.get("/", (request, response) => {
  getHudConfig().then(function(jsonConfig) {
    console.log("Render");
    response.render("home", {
      time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
      configJson: jsonConfig
    }); // This code works.
  });
});

app.use(express.static(__dirname + "/public"));

app.use(function(request, response) {
  response.status(404);
  response.render("404");
});

app.listen(port);
