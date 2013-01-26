/*global module, console, setTimeout*/

var lifeStar = require("./../life_star"),
    fs = require('fs'),
    exec = require('child_process').exec,
    async = require('async'),
    path = require('path'),
    http = require('http'),
    server;

function withLifeStarDo(test, func, options) {
  if (server) test.assert(false, 'life_star already running!')
  options = options || {};
  options.host = options.host || 'localhost';
  options.port = options.port || 9999;
  server = lifeStar(options);
  server.on('error', function(e) {
    test.ifError(e);
    test.done();
  });
  setTimeout(function() { func(server) }, 500);
}

function shutDownLifeStar(thenDo) {
  if (!server) {
    thenDo();
  } else {
    server.close(function() { server = null; thenDo(); });
  }
}

var tempFiles = [], tempDirs = [];
function createTempFile(filename, content) {
  fs.writeFileSync(filename, content);
  tempFiles.push(filename);
  console.log('created ' + filename);
}

function createTempDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  tempDirs.unshift(dir);
}

function cleanupTempFiles(thenDo) {
  async.series(
    tempFiles.map(function(file) {
      return function(cb) { fs.unlinkSync(file); cb(); };
    }).concat(tempDirs.map(function(dir) {
      return function(cb) {
        exec('rm -rfd ' + dir, function(code, out, err) { cb(); });
      }
    })),
    function() {
      tempFiles = [];
      tempDirs = [];
      thenDo && thenDo();
    }
  )
}

function createDirStructure(basePath, spec) {
  // spec is an object like
  // {"foo": {"bar.js": "bla"}}
  // will create dir "foo/" and file foo/bar.js with "bla" as content
  for (var name in spec) {
    var p = path.join(basePath, name);
    if (typeof spec[name] === 'string') {
      createTempFile(p, spec[name]);
      continue;
    }
    if (typeof spec[name] === 'object') {
      createTempDir(p);
      createDirStructure(p, spec[name]);
      continue;
    }
  }
}

function withResponseBodyDo(res, callback) {
  var data = "";
  res.on('data', function(d) { data += d; })
  res.on('end', function(err) {
    callback(err, data);
  });
}

function get(path, callback) {
  return http.get('http://localhost:9999' + path, callback);
}

function request(method, path, data, callback) {
  var req = http.request({hostname: 'localhost', port: 9999, path: path, method: method}, callback);
  if (data) req.write(typeof data === 'object' ? JSON.stringify(data) : data);
  req.end();
  return req;
}


module.exports = {
  withLifeStarDo: withLifeStarDo,
  shutDownLifeStar: shutDownLifeStar,
  createTempFile: createTempFile,
  cleanupTempFiles: cleanupTempFiles,
  createDirStructure: createDirStructure,
  withResponseBodyDo: withResponseBodyDo,
  GET: get,
  PUT: request.bind(null, 'PUT'),
  POST: request.bind(null, 'POST')
}
