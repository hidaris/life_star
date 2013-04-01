/*global exports, require, JSON, __dirname, console*/

// continously run with:
// nodemon nodeunit tests/manifest-test.js

var testHelper = require('./test-helper'),
    http = require('http'),
    lifeStarTest = require("./life_star-test-support"),
    testSuite = {},
    fs = require('fs');

function createSimpleHTML() {
  lifeStarTest.createDirStructure(__dirname, {
    "simple.html": "<!DOCTYPE html>\n"
                 + "<html>\n"
                 + "  <head><title>Foo</title></head>\n"
                 + "  <body>Test</body>\n"
                 + "</html>\n"
                 + "\n"
  });
}

function createDirectoryWithVariousFiles() {
  lifeStarTest.createDirStructure(__dirname, {
    testDir: {
      "file1.js": "//Some code in here\nalert('1');",
      "dont-cache.txt": "shouldn't be cached",
      "but.css": "body {\ncolor: red\n}",
      "favicon.ico": "also the icon",
      "foo": {
        "file2.js": "//Some code in here\nalert('2');",
        "someimage.png": "images are cached as well",
        "bar": {
          "file3.js": "//Some code in here\nalert('3');",
          "simple.html": "<!DOCTYPE html>\n"
                       + "<html>\n"
                       + "  <head><title>Foo</title></head>\n"
                       + "  <body>simple</body>\n"
                       + "</html>\n"
        }
      }
    }
  });
}

testSuite.ManifestTest = {

  setUp: function(run) {
    run();
  },

  tearDown: function(run) {
    lifeStarTest.cleanupTempFiles(function() {
      lifeStarTest.shutDownLifeStar(run);
    });
  },

  "life star is embedding manifest ref in html": function(test) {
    // patch html so that the html manifest attribute is added and points to
    // the manifest file
    createSimpleHTML();
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/simple.html', function(res) {
        test.equals(200, res.statusCode);
        test.ok(/<html manifest="\/lively.appcache">/.test(res.body),
                'No manifest ref in ' + res.body);
        test.done();
      });
    }, {fsNode: __dirname + '/'});
  },

  "life star is not embedding manifest ref if feature is disabled": function(test) {
    createSimpleHTML();
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/simple.html', function(res) {
        test.equals(200, res.statusCode);
        test.ok(/<html>/.test(res.body), 'Manifest unexpectedly in ' + res.body);
        test.done();
      });
    }, {fsNode: __dirname + '/', useManifestCaching: false});
  },

  "don't crash on requests of non-existing files": function(test) {
    test.done(); return;
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/does-not-exist.html', function(res) {
        test.equals(404, res.statusCode);
        test.done();
      });
    }, {fsNode: __dirname + '/'});
  },

  "serve manifest file with all js scripts in a dir": function(test) {
    createDirectoryWithVariousFiles();
    var creationTime = Math.floor(Date.now() / 1000);
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/lively.appcache', function(res) {
        test.equals(200, res.statusCode);
        test.equals('no-cache, private', res.headers['cache-control']);
        test.equals('text/cache-manifest', res.headers['content-type']);
        var expected = "CACHE MANIFEST\n"
                     + "# timestamp " + creationTime + "\n\n\n"
                     + "CACHE:\n"
                     + "/but.css\n"
                     + "/favicon.ico\n"
                     + "/file1.js\n"
                     + "/foo/bar/file3.js\n"
                     + "/foo/file2.js\n"
                     + "/foo/someimage.png\n\n\n"
                     + 'NETWORK:\n'
                     + '*\nhttp://*\nhttps://*\n';
        test.equals(expected, res.body, "\n>>>>\n" + expected + "\n=====\n" + res.body + '<<<<');
        test.done();

      });
    }, {fsNode: __dirname + '/testDir'});
  }

}

exports.testSuite = testSuite;