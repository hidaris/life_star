/*global exports, require, JSON, __dirname, console*/

// continously run with:
// nodemon nodeunit tests/manifest-test.js

var testHelper = require('./test-helper'),
    http = require('http'),
    lifeStarTest = require("./life_star-test"),
    testSuite = {},
    fs = require('fs');

function createSimpleHTML() {
  var source = "<!DOCTYPE html>\n"
             + "<html>\n"
             + "  <head><title>Foo</title></head>\n"
             + "  <body>Test</body>\n"
             + "</html>\n"
             + "\n";
  lifeStarTest.createTempFile(__dirname + '/simple.html', source);
}

testSuite.SubserverTest = {

  setUp: function(run) {
    run();
  },

  tearDown: function(run) {
    lifeStarTest.cleanupTempFiles();
    lifeStarTest.shutDownLifeStar(run);
  },

  "life star is embedding manifest ref in html": function(test) {
    createSimpleHTML();
    lifeStarTest.withLifeStarDo(test, function() {
      http.get('http://localhost:9999/simple.html', function(res) {
        test.equals(200, res.statusCode);
        var data = "";
        res.on('data', function(d) { data += d; })
        res.on('end', function(err) {
          test.ok(/<html manifest="lively.scriptscache">/.test(data),
                  'No manifest ref in ' + data);
          test.done();
        });
      });
    }, {fsNode: __dirname + '/'});
  },

  "life star is not embedding manifest ref if feature is disabled": function(test) {
    createSimpleHTML();
    lifeStarTest.withLifeStarDo(test, function() {
      http.get('http://localhost:9999/simple.html', function(res) {
        test.equals(200, res.statusCode);
        var data = "";
        res.on('data', function(d) { data += d; })
        res.on('end', function(err) {
          test.ok(/<html>/.test(data), 'Manifest unexpectedly in ' + data);
          test.done();
        });
      });
    }, {fsNode: __dirname + '/', useManifestCaching: false});
  },

  "don't crash on requests of non-existing files": function(test) {
    lifeStarTest.withLifeStarDo(test, function() {
      http.get('http://localhost:9999/does-not-exist.html', function(res) {
        test.equals(404, res.statusCode);
        test.done();
      });
    }, {fsNode: __dirname + '/'})
  }

}

exports.testSuite = testSuite;
