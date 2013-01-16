/*global require, module*/

var fs = require('fs'),
    path = require('path');

var subserverDir = './../subservers/',
    baseURL,
    additionalSubservers;

// -=-=-=-
// helper
// -=-=-=-

function getFSSubserverModules() {
    return fs.readdirSync(path.join(__dirname, subserverDir))
           .filter(function(file) { return (/\.js$/.test(file)) })
           .map(function(file) {
               var name = file.substr(0, file.lastIndexOf('.')),
                   path = subserverDir + name,
                   route = baseURL + name + '/';
               return {name: name, path: path, route: route};
           });
}

function getAdditionalSubservers() {
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
    config = config || {};
    baseURL = config.baseURL || '/nodejs/';
    additionalSubservers = config.additionalSubservers;
}

SubserverHandler.prototype.registerWith = function(app) {
    getFSSubserverModules().concat(getAdditionalSubservers()).forEach(function(serverSpec) {
        console.log('starting subserver %s on route %s', serverSpec.name, serverSpec.route);
        require(serverSpec.path)(serverSpec.route, app);
    })
}

// -=-=-=-
// exports
// -=-=-=-

exports.SubserverHandler = SubserverHandler;
