/*global require, module*/

var fs = require('fs'),
    path = require('path'),
    subserverDir = './../subservers/';

// -=-=-=-
// helper
// -=-=-=-

function getFSSubserverModules(subserverHandler) {
    return fs.readdirSync(path.join(__dirname, subserverDir))
           .filter(function(file) { return (/\.js$/.test(file)) })
           .map(function(file) {
               var name = file.substr(0, file.lastIndexOf('.')),
                   path = subserverDir + name,
                   route = subserverHandler.baseURL + name + '/';
               return new Subserver({name: name, path: path, route: route});
           });
}

function getAdditionalSubservers(subserverHandler) {
  var additionalSubservers = subserverHandler.config.additionalSubservers || [],
      baseURL = subserverHandler.baseURL;
    return Object.keys(additionalSubservers).map(function(name) {
        var path = additionalSubservers[name],
            route = baseURL + name + '/';
        return new Subserver({name: name, path: path, route: route});
    });
}

function runFuncAndRecordNewExpressRoutes(app, func, context) {
  var method, oldRoutes = {};
  for (method in app.routes) { oldRoutes[method] = [].concat(app.routes[method]); }
  // 2) run the function
  func.call(context);
  // 3) find new routes and remember them has belonging to this subserver
  var newRoutes = [];
  for (method in app.routes) {
    app.routes[method].forEach(function(route) {
      if (oldRoutes[method].indexOf(route) === -1) newRoutes.push(route);
    });
  }
  return newRoutes;
}

function removeRouteFromExpressApp(app, route) {
  var routes = app.routes[route.method],
      idx = routes.indexOf(route);
  if (idx === -1) return false;
  routes.splice(idx, 1);
  return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-
// subserver abastraction
// -=-=-=-=-=-=-=-=-=-=-=-

function Subserver(spec) {
  this.name = spec.name;
  this.path = spec.path;
  this.route = spec.route;
  this.myRegisteredRoutes = {};
}

Subserver.prototype.start = function(app) {
  console.log('starting subserver %s on route %s', this.name, this.route);
  var newRoutes = runFuncAndRecordNewExpressRoutes(app, function() {
    require(this.path)(this.route, app); }, this);
  this.myRegisteredRoutes = newRoutes;
}


Subserver.prototype.unload = function(app) {
  this.myRegisteredRoutes.forEach(function(route) {
    removeRouteFromExpressApp(app, route);
  });
}

// -=-=-=-=-=-=-
// handler class
// -=-=-=-=-=-=-

function SubserverHandler(config) {
  this.config = config || {};
  this.baseURL = config.baseURL || '/nodejs/';
  this.registeredSubservers = {};
}

SubserverHandler.prototype.getSubserver = function(name) {
  return this.registeredSubservers[name];
}

SubserverHandler.prototype.listSubservers = function(req, res) {
  try {
    res.json(Object.keys(this.registeredSubservers));
    res.end();
  } catch(e) {
    res.status(500).end(String(e));
  }
}

SubserverHandler.prototype.unload = function(req, res) {
  var name = req.params.name,
      subserver = this.getSubserver(name);
  try {
    if (!subserver) { res.status(404).end({error: 'subserver not found'}); return }
    if (!this.app) { res.status(500).end({error: 'SubserverHandler has no app'}); return }
    subserver.unload(this.app);
    res.end();
  } catch(e) {
    console.error(e);
    res.status(500).end(String(e));
  }
}

SubserverHandler.prototype.registerWith = function(app) {
  this.app = app;

  // install a controlling interface
  var metaURL = this.baseURL + 'subservers';
  app.post(metaURL + '/:name/unload', this.unload.bind(this));
  app.get(metaURL, this.listSubservers.bind(this));

  // load and start the subservers
  getFSSubserverModules(this).concat(getAdditionalSubservers(this)).forEach(function(subserver) {
    subserver = this.registeredSubservers[subserver.name] || subserver;
    this.registeredSubservers[subserver.name] = subserver;
    subserver.start(app);
  }, this);
}

// -=-=-=-
// exports
// -=-=-=-

exports.SubserverHandler = SubserverHandler;
