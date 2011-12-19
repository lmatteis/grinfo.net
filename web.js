var express = require('express'),
    fs = require("fs"),
    Mustache = require("mustache"),
    trello = require("node-trello"),
    md = require( "markdown" ).markdown;

var app = express.createServer();
app.use(express.static(__dirname + '/public'));

function render(filepath, ctx, callback) {
  // load header
  fs.readFile("./templates/header.html", "utf8", function(err, data) {
    if(err) throw err;
    var header = data;
    fs.readFile("./templates/footer.html", "utf8", function(err, data) {
      if(err) throw err;
      var footer = data;
      var partials = {header: header, footer: footer};
      fs.readFile(filepath, "utf8", function(err, data) {
        if(err) throw err;
        var html = Mustache.to_html(data, ctx, partials);
        callback(html);
      });
    });
  });
}

function db(key, callbackDisk, callbackMem, numreq) {
  if(!db.count[key]) db.count[key] = 0;
  db.count[key]++;
  db.callbackMem = callbackMem;
  if(db.count[key] === numreq || db.count[key] > numreq || !db.data[key]) {
    callbackDisk(key);
    db.count[key] = 0;
    console.log("from disk");
  } else { // load from cache WEEEE
    callbackMem(db.data[key]); 
    console.log("from memory");
  }
}
// THIS IS DATA OF THE ENTIRE SITE
db.data = {};
db.count = {};
db.save = function(key, val) {
  db.data[key] = val;
  db.callbackMem(val);
};


function summary(str, max) {
  var result = str;
  var resultArray = result.split(" ");
  if(resultArray.length > max){
    resultArray = resultArray.slice(0, max);
    result = resultArray.join(" ") + "…";
  }
  return result;
}

app.get('/', function(request, response) {
  db("home", function(key) {
    var ctx = {
      title: "grinfo.net",
    };
    trello.get("grinfo", function(boards) {
      boards.forEach(function(board) {
        board.desc_html = md.toHTML(summary(board.desc, 30));
      });
      ctx.boards = boards;
      render("./templates/index.html", ctx, function(html) {
        db.save(key, html);
      });
    });
  }, function(html){
    response.send(html); 
  }, 5);
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
