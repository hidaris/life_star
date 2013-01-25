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
               return {name: name, path: path, route: route};
           });
}

function getAdditionalSubservers(subserverHandler) {
  var additionalSubservers = subserverHandler.config.additionalSubservers || [],
      baseURL = subserverHandler.baseURL;
    return Object.keys(additionalSubservers).map(function(name) {
        var path = additionalSubservers[name],
            route = baseURL + name + '/';
        return {name: name, path: path, route: route};
    });
}

// -=-=-=-=-=-=-
// handler class
// -=-=-=-=-=-=-

function SubserverHandler(config) {
  this.config = config || {};
  this.baseURL = config.baseURL || '/nodejs/';
  this.registeredSubservers = [];
}

SubserverHandler.prototype.listSubservers = function listSubservers(req, res) {
  try {
    res.json(this.registeredSubservers);
    res.end();
  } catch(e) {
    res.status(500).end(e);
  }
}

SubserverHandler.prototype.registerWith = function(app) {
  app.get(this.baseURL + 'subservers', this.listSubservers.bind(this));
  getFSSubserverModules(this).concat(getAdditionalSubservers(this)).forEach(function(serverSpec) {
    console.log('starting subserver %s on route %s', serverSpec.name, serverSpec.route);
    require(serverSpec.path)(serverSpec.route, app);
    this.registeredSubservers.push({name: serverSpec.name});
  }, this);
}

// -=-=-=-
// exports
// -=-=-=-

exports.SubserverHandler = SubserverHandler;
