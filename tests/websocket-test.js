/*global exports, require, JSON, __dirname, console*/

// continously run with:
// nodemon nodeunit tests/websocket-test.js

var testHelper = require('./test-helper'),
    lifeStarTest = require("./life_star-test-support"),
    async = require('async'),
    testSuite = {},
    fs = require('fs'),
    WebSocketClient = require('websocket').client;

var simpleSubserverSource = "module.exports = function(baseRoute, app) {\n"
                          + "    app.get(baseRoute, function(req, res) {\n"
                          + "        res.send('hello');\n"
                          + "    });\n"
                          + "}\n";

function createSubserverFile(path, source) {
  source = source || simpleSubserverSource;
  return lifeStarTest.createTempFile(__dirname + '/../' + path, source);
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
    // register websocket handler and then send websocket request to it.
    // handler should establish connection and send something back
    lifeStarTest.withLifeStarDo(test, function(server) {
      // server part, register for /test ws requests
      server.websocketHandler.registerSubhandler({path: '/test', handler: function(req) {
        var connection = req.accept();
        connection.on('message', function(msg) {
          test.equal('utf8', msg.type);
          test.equal('request', msg.utf8Data);
          connection.send('response');
        });
        return true;
      }});

      // client part, kicks off connection + send
      var client = new WebSocketClient();
      client.on('connect', function(connection) {
        connection.on('message', function(msg) {
          test.equal('utf8', msg.type);
          test.equal('response', msg.utf8Data);
          connection.close();
          test.done();
        });
        connection.send('request');
      })
      client.connect('ws://localhost:9999/test');
    });
  }

}



exports.testSuite = testSuite;
