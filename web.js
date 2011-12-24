var express = require('express'),
    fs = require("fs"),
    Mustache = require("mustache"),
    trello = require("node-trello"),
    md = require( "markdown" ).markdown;

trello.key = "xxx";
trello.token = "xxx";

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
function metaDescription(str) {
  str = str.replace(/!\[.*\]\(.*\)/, "");
  str = summary(str, 20);
  return trim(str);
}
function replaceURLWithHTMLLinks(text) {
  var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(exp,"<$1>"); 
}

var TITLE = "grinfo.net",
    CACHE_TIMES = 5;

app.get('/', function(request, response) {
  db("boards", function(key) {
    trello.api("/1/organization/grinfo/boards/all", function(err, boards) {
      if(err) throw err;
      db.save(key, boards);
    });
  }, function(boards){
    var ctx = {
      title: TITLE
    };
    boards = boards.filter(function(board, idx) {
      if(!boards.desc) return false; 
      board.desc_html = md.toHTML(replaceURLWithHTMLLinks(summary(board.desc, 30)));
      board.slug_name = slugify(board.name);
      var remainder = (idx+1) % 3;
      if(remainder === 0) { 
        board.is_multiple_of_three = true;
      }
      return true;
    });
    ctx.boards = boards;
    render("./templates/index.html", ctx, function(html) {
      response.send(html); 
    });
  }, CACHE_TIMES);
});

app.get('/project/:id/:slug?', function(request, response) {
  var id = request.params.id;
  var slug = request.params.slug;
  db("boards", function(key) {
    trello.api("/1/organization/grinfo/boards/all", function(err, boards) {
      if(err) throw err;
      db.save(key, boards);
    });
  }, function(boards) {
    var ctx = {
      title: TITLE,
      slug: slug
    };
    boards.forEach(function(board) {
      if(board["id"] !== id) return;
      board.desc_html = md.toHTML(replaceURLWithHTMLLinks(board.desc));
      ctx.board = board;
      ctx.title = board.name + " - " + ctx.title;
      ctx.description = metaDescription(board.desc);
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
