// index.js
const path = require('path');
const https = require('https');
const dateformat = require('dateformat');
const express = require('express');
const exphbs = require('express-handlebars');
const port = 3000;

const app = express();

var getConfigOptions = {
    hostname: 'localhost:8080',
    path: '/settings',
    method: 'GET'
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

app.get("/", (request, response) => {
  response.render("home", {
    time: dateformat(Date.now(), "dd-mm-yy hh:MM:ss TT"),
    configJson: ""
  })
});

app.use(express.static(__dirname + '/public')); 

app.use(function(request, response) {
  response.status(404);
  response.render("404");
});

app.listen(port);
