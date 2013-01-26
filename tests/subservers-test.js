/*global exports, require, JSON, __dirname, console*/

// continously run with:
// nodemon nodeunit tests/subservers-test.js

var testHelper = require('./test-helper'),
    lifeStarTest = require("./life_star-test"),
    async = require('async'),
    testSuite = {},
    fs = require('fs');

var simpleSubserverSource = "module.exports = function(baseRoute, app) {\n"
                          + "    app.get(baseRoute, function(req, res) {\n"
                          + "        res.send('hello');\n"
                          + "    });\n"
                          + "}\n";

function createSubserverFile(path, source) {
  source = source || simpleSubserverSource;
  lifeStarTest.createTempFile(__dirname + '/../' + path, source);
}

testSuite.SubserverTest = {

  setUp: function(run) {
    run();
  },

  tearDown: function(run) {
    lifeStarTest.cleanupTempFiles(function() {
      lifeStarTest.shutDownLifeStar(run);
    });
  },

  "life star is running": function(test) {
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/', function(res) {
        test.equals(200, res.statusCode);
        test.done();
      });
    });
  },

  "server placed in subserver dir is started and accessible": function(test) {
    createSubserverFile('subservers/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET("/nodejs/foo/", function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          test.equals('hello', data);
          test.done();
        });
      });
    })
  },

  "subservers via options are started": function(test) {
    createSubserverFile('tests/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/nodejs/bar/', function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          test.equals('hello', data);
          test.done();
        });
      });
    }, {subservers: {bar: './../tests/foo.js'}});
  }

}

testSuite.SubserverMetaTest = {

  setUp: function(run) {
    run();
  },

  tearDown: function(run) {
    lifeStarTest.cleanupTempFiles(function() {
      lifeStarTest.shutDownLifeStar(run);
    });
  },

  "list subservers": function(test) {
    createSubserverFile('subservers/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/nodejs/subservers', function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          data = JSON.parse(data);
          test.deepEqual(['foo'], data, "subserver list");
          test.done();
        });
      });
    })
  },

  "unload subserver": function(test) {
    createSubserverFile('subservers/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.POST('/nodejs/subservers/foo/unload', null, function(res) {
        test.equals(200, res.statusCode);
        lifeStarTest.GET('/nodejs/foo/', function(res) {
          test.equals(404, res.statusCode);
          test.done();
        })
      });
    });
  },

  "get subserver source": function(test) {
    createSubserverFile('subservers/foo.js', simpleSubserverSource);
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/nodejs/subservers/foo/source', function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          test.equals(simpleSubserverSource, data);
          test.done();
        });
      });
    });
  },

  "set subserver source": function(test) {
    createSubserverFile('subservers/foo.js', simpleSubserverSource);
    var newSource = "module.exports = function(baseRoute, app) {\n"
                  + "    app.get(baseRoute, function(req, res) {\n"
                  + "        res.send('new source');\n"
                  + "    });\n"
                  + "}\n";
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.PUT('/nodejs/subservers/foo/source', newSource, function(res) {
        test.equals(200, res.statusCode);
        lifeStarTest.GET('/nodejs/foo/', function(res) {
          lifeStarTest.withResponseBodyDo(res, function(err, data) {
            test.equals('new source', data);
            test.done();
          });
        });
      });
    });
  }

}

exports.testSuite = testSuite;
