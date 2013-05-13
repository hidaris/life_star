/*global require, module*/

var i = require('util').inspect;
var WebSocketServer = require('websocket').server;

// -=-=-=-
// helper
// -=-=-=-
function originIsAllowed(origin) { return true }

// -=-=-=-=-=-=-
// handler class
// -=-=-=-=-=-=-

function WebsocketHandler(config) {
  this.wsHandler = {};
}

WebsocketHandler.prototype.registerSubhandler = function(options) {
  this.wsHandler[options.path] = options.handler;
}

WebsocketHandler.prototype.unregisterSubhandler = function(options) {
  if (options.path) {
    delete this.wsHandler[options.path];
  }
}

WebsocketHandler.prototype.originCheck = function(request) {
  // optionally test for request.origin
  if (originIsAllowed(request.origin)) return true;
  request.reject();
  console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
  return false;
}

WebsocketHandler.prototype.findHandler = function(request) {
  var path = request.resourceURL.path,
      handler = this.wsHandler[path];
    if (handler) return handler;
  request.reject();
  console.warn('Got websocket request to %s but found no handler for responding\n%s', path, i(request, null, 0));
  return null;
}

WebsocketHandler.prototype.registerWith = function(app, server) {
  server.websocketHandler = this; // for usage in subservers / tests

  // create a websocket server and listen
  var self = this,
      wsServer = new WebSocketServer({
        httpServer: server,
        autoAcceptConnections: false // origin check
      });

  server.on('close', function() {
    console.log('closing websocket handlers...');
    wsServer.shutDown();
  });

  wsServer.on('request', function(request) {
    if (!self.originCheck(request)) return;
    var handler = self.findHandler(request);
    try {
      handler && handler(request);
    } catch(e) {
      console.warn('Error handling websocket request: %s', e);
    }
  });
}

// -=-=-=-
// exports
// -=-=-=-

exports.WebsocketHandler = WebsocketHandler;
