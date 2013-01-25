/*global exports, require, JSON, __dirname, console*/

// continously run with:
// nodemon nodeunit tests/subservers-test.js

var testHelper = require('./test-helper'),
    lifeStarTest = require("./life_star-test"),
    testSuite = {},
    fs = require('fs');

function createSubserverFile(path) {
    var simpleServerSource = "module.exports = function(baseRoute, app) {\n"
                           + "    app.get(baseRoute, function(req, res) {\n"
                           + "        res.send('hello');\n"
                           + "    });\n"
                           + "}\n";
    lifeStarTest.createTempFile(path, simpleServerSource);
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
    createSubserverFile(__dirname + '/../subservers/foo.js');
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
    createSubserverFile(__dirname + '/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/nodejs/bar/', function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          test.equals('hello', data);
          test.done();
        });
      });
    }, {subservers: {bar: __dirname + '/foo.js'}});
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
    createSubserverFile(__dirname + '/../subservers/foo.js');
    lifeStarTest.withLifeStarDo(test, function() {
      lifeStarTest.GET('/nodejs/subservers', function(res) {
        lifeStarTest.withResponseBodyDo(res, function(err, data) {
          data = JSON.parse(data);
          test.deepEqual([{name: 'foo'}], data, "subserver list");
          test.done();
        });
      });
    })
  }
}

exports.testSuite = testSuite;
