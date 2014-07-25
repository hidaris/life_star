/*global require, module*/
var express = require('express'),
    morgan = require('morgan'),
    LivelyFsHandler = require('lively-davfs/request-handler'),
    log4js = require('log4js'),
    proxy = require('./lib/proxy'),
    testing = require('./lib/testing'),
    auth = require('./lib/auth'),
    SubserverHandler = require('./lib/subservers').SubserverHandler,
    ManifestHandler = require('./lib/manifest').ManifestHandler,
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter,
    server, app;

var serverSetup = module.exports = function(config, thenDo) {

  config.host                = config.host || "localhost";
  config.port                = config.port || 9001;
  config.srvOptions          = config.srvOptions || {node: config.fsNode || "../LivelyKernel/"};
  config.logLevel            = config.logLevel || "debug";
  config.enableTesting       = config.enableTesting;
  config.sslServerKey        = config.sslServerKey;
  config.sslServerCert       = config.sslServerCert;
  config.sslCACert           = config.sslCACert;
  config.enableSSL           = config.enableSSL && config.sslServerKey && config.sslServerCert && config.sslCACert;
  config.enableSSLClientAuth = config.enableSSL && config.enableSSLClientAuth;
  config.behindProxy         = config.behindProxy || false;
  config.subservers          = config.subservers || {};
  config.subserverDirectory  = config.subserverDirectory || __dirname  + "/subservers/";
  config.useManifestCaching  = config.useManifestCaching || false;
  config.cors                = config.hasOwnProperty("cors") ? config.cors : true;

  app = express();

  (function createLivelyObject() {
    // some helpers, mainly for interactive usage
    if (typeof lively === "undefined") global.lively = {};
    global.lv = global.lively;
    util._extend(lively, {
      server: {
        dir: __dirname,
        get lifeStar() { return server; },
        get app() { return app; }
      }
     });
  })();

  if (config.enableSSL) {
    var https = require('https'),
        options = {
          // Specify the key and certificate file
          key: fs.readFileSync(config.sslServerKey),
          cert: fs.readFileSync(config.sslServerCert),
          // Specify the Certificate Authority certificate
          ca: fs.readFileSync(config.sslCACert),

          // This is where the magic happens in Node. All previous steps simply
          // setup SSL (except the CA). By requesting the client provide a
          // certificate, we are essentially authenticating the user.
          requestCert: config.enableSSLClientAuth,

          // If specified as "true", no unauthenticated traffic will make it to
          // the route specified.
          rejectUnauthorized: config.enableSSLClientAuth
        };
    server = require('https').createServer(options, app);
  } else {
    server = require('http').createServer(app);
  }

  // express specifically handles the case of sitting behind a proxy, see
  // http://expressjs.com/guide.html#proxies
  if (config.behindProxy) app.enable('trust proxy');

  if (config.cors) {
    console.log('Lively server started with cross origin resource sharing (CORS) enabled.');
    app.use(function cors(req, res, next) {
      var allowedHeaders = req.header("Access-Control-Request-Headers"), // allow all headers by default
          allowedMethods = "POST,OPTIONS,GET,HEAD,DELETE,PROPFIND,PUT,PROPPATCH,COPY,MOVE,REPORT";
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', allowedMethods);
      allowedHeaders && res.header('Access-Control-Expose-Headers', allowedHeaders);
      allowedHeaders && res.header('Access-Control-Allow-Headers', allowedHeaders);
      res.header('Access-Control-Allow-Credentials', 'true');
      next();
    });
  }

  app.use(express.bodyParser({limit: '150mb'}));
  app.use(express.cookieParser());

  // store auth information into a cookie
  app.use(express.cookieSession({
    key: 'livelykernel-sign-on',
    secret: 'foo',
    proxy: config.behindProxy,
    cookie: {path: '/', httpOnly: false, maxAge: null}
  }));

  // -=-=-=-=-=-=-=-=-=-=-=-=-
  // deal with authentication
  // -=-=-=-=-=-=-=-=-=-=-=-=-
  if (config.behindProxy) {
    app.use(auth.extractApacheClientCertHeadersIntoSession);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // set up logger, proxy and testing routes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  var logger = log4js.getLogger();
  logger.setLevel((config.logLevel || 'OFF').toUpperCase());
  // FIXME either use log4js or default express logger..
  morgan.token('user', function(req, res) { return (req.session && req.session.user) || 'unknown user'; });
  morgan.token('email', function(req, res) {return (req.session && req.session.email) || ''; });
  // default format:
  // ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
  morgan.lkFormat = morgan.combined.replace('":method', '":user <:email>" ":method');
  app.use(morgan('lkFormat'));

  // -=-=-=-=-=-=-
  // Proxy routes
  // -=-=-=-=-=-=-
  var proxyHandler = proxy(logger);
  function extractURLFromProxyRequest(req) {
    // example: /proxy/localhost:5984/test/_all_docs?limit=3
    //       => http://localhost:5984/test/_all_docs?limit=3
    return req.protocol + '://' + req.url.slice('/proxy/'.length);
  }
  app.all(/\/proxy\/(.*)/, function(req, res) {
    var url = extractURLFromProxyRequest(req);
    proxyHandler[req.method.toLowerCase()](url, req, res);
  });

  // -=-=-=-=-=-
  // test server
  // -=-=-=-=-=-
  if (config.enableTesting) testing(app, logger);

  // -=-=-=-=-=-=-=-
  // setup subserver
  // -=-=-=-=-=-=-=-
  new SubserverHandler({
    baseURL: '/nodejs/',
    subserverDirectory: config.subserverDirectory,
    additionalSubservers: config.subservers
  }).registerWith(app, server);

  // -=-=-=-=-=-=-=-=-=-=-
  // manifest file related
  // -=-=-=-=-=-=-=-=-=-=-
  if (config.useManifestCaching) {
    var manifestHandler = new ManifestHandler(config);
    manifestHandler.registerWith(app, server);
    app.all(/.*/, function fileHandler(req, res, next) {
      if (req.url.match(/\?\d+/)) {
        req.url = req.url.replace(/\?.*/, ''); // only the bare file name
      }
      manifestHandler.addManifestRef(req, res);
      next();
    });
  }

  // -=-=-=-=-=--=-=-=-=-=--=-=-=-
  // set up file system connection
  // -=-=-=-=-=--=-=-=-=-=--=-=-=-
  var dbConf = { // defaults
      enableVersioning: true,
      enableRewriting: true,
      enableRewriteOnStart: false,
      // Modules necessary modules for world load, the rest of the AST registry can be lazily be loaded from the server later
      bootstrapRewriteFiles: [ // 'core/lib/lively-libs-debug.js',
        'core/lively/Migration.js', 'core/lively/JSON.js', 'core/lively/lang/Object.js', 'core/lively/lang/Function.js', 'core/lively/lang/String.js',
        'core/lively/lang/Array.js', 'core/lively/lang/Number.js', 'core/lively/lang/Date.js', 'core/lively/lang/Worker.js', 'core/lively/lang/LocalStorage.js',
        'core/lively/defaultconfig.js', 'core/lively/Base.js', 'core/lively/ModuleSystem.js', 'core/lively/Traits.js', 'core/lively/DOMAbstraction.js',
        'core/lively/IPad.js', 'core/lively/LogHelper.js', 'core/lively/lang/Closure.js', // bootstrap.js
        'core/lively/bindings/Core.js', 'core/lively/persistence/Serializer.js', 'core/lively/Main.js', 'core/lively/net/WebSockets.js',
        'core/cop/Layers.js', 'core/lively/OldModel.js', 'core/lively/Data.js', 'core/lively/Network.js',
        // directly neccessary for debugging
        'core/lively/ast/Debugging.js', 'core/lively/ast/AcornInterpreter.js', 'core/lively/ast/Rewriting.js', 'core/lively/ast/AstHelper.js',
        'core/lively/ast/acorn.js',
        // neccessary to be able to load everything else dynamically
        'core/lively/store/Interface.js'
      ],
      fs: config.srvOptions.node,
      excludedDirectories: ['.svn', '.git', 'node_modules'],
      excludedFiles: [/.*\.sqlite/, /.*\.gz/, '.DS_Store', 'combined.js'],
      includedFiles: [/\.(cmd|conf|css|diff|el|html|ini|js|json|md|mdown|metainfo|patch|r|snippets|st|txt|xhtml|xml|yml)$/i],
      dbFile: path.join(config.fsNode || '', "objects.sqlite"),
      resetDatabase: false
  };
  if (config.dbConf) {
      if (typeof config.dbConf === 'string')
          config.dbConf = JSON.parse(config.dbConf);
      util._extend(dbConf, config.dbConf);
  }
  var fsHandler = new LivelyFsHandler(dbConf).registerWith(app, server);
  lively.server.repository = fsHandler.repository;
  app.all(/.*/, fsHandler.handleRequest.bind(fsHandler));

  // -=-=-=-=-
  // GO GO GO
  // -=-=-=-=-
  server.on('listening', function() {
      console.log("life_star running");
      serverSetup.emit('start', server);
      if (thenDo) thenDo(null, server);
  });
  server.on('close', function() { serverSetup.emit('close'); });

  server.listen(config.port);

  return server;
};

util._extend(serverSetup, EventEmitter.prototype);
EventEmitter.call(serverSetup);

serverSetup.getServer = function() { return server; };
serverSetup.getApp = function() { return app; };
