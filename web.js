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

function slugify(s) {
  var _slugify_strip_re = /[^\w\s-]/g;
  var _slugify_hyphenate_re = /[-\s]+/g;
  s = s.replace(_slugify_strip_re, '').trim().toLowerCase();
  s = s.replace(_slugify_hyphenate_re, '-');
  return s;
}
function trim(string) {
  return string.replace(/^\s*|\s*$/g, '')
}
function removeMd(str) {
  str = str.replace(/!\[.*\]\(.*\)/, "");
  return trim(str);
}

var TITLE = "grinfo.net",
    CACHE_TIMES = 100;

app.get('/', function(request, response) {
  db("boards", function(key) {
    trello.get("grinfo", function(boards) {
      db.save(key, boards);
    });
  }, function(boards){
    var ctx = {
      title: TITLE,
    };
    boards.forEach(function(board) {
      board.desc_html = md.toHTML(summary(board.desc, 30));
      board.slug_name = slugify(board.name);
    });
    ctx.boards = boards;
    render("./templates/index.html", ctx, function(html) {
      response.send(html); 
    });
  }, CACHE_TIMES);
});

app.get('/project/:id/:slug?', function(request, response) {
  var id = request.params.id;
  db("boards", function(key) {
    trello.get("grinfo", function(boards) {
      db.save(key, boards);
    });
  }, function(boards) {
    var ctx = {
      title: TITLE,
    };
    boards.forEach(function(board) {
      if(board["_id"] !== id) return;
      board.desc_html = md.toHTML(board.desc);
      ctx.board = board;
      ctx.title = board.name + " - " + ctx.title;
      ctx.description = removeMd(board.desc);
      render("./templates/project.html", ctx, function(html) {
        response.send(html); 
      });
    });
  }, CACHE_TIMES);
});

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});
