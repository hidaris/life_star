/*global require, module*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// manifest files are used by web browsers for cacheing see
// http://appcachefacts.info/ and
// http://www.alistapart.com/articles/application-cache-is-a-douchebag/ for
// more info
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var exec = require('child_process').exec,
    manifestFileName = "lively.scriptscache",
    headers = {
      'Content-Type': 'text/cache-manifest',
      'Cache-Control': 'no-cache, private'
    },
    config;

// -=-=-=-
// helper
// -=-=-=-
function findJSFilesForManifest(rootDir, thenDo) {
  // find all js files
  // ignore .git and node_modules dirs
  exec('find . \\( -name node_modules -or -name .git \\) -type d -prune -o -iname "*.js" -print',
       {cwd: rootDir},
       function(code, out, err) { thenDo(code, out); });
}

function buildManifestFileContents(thenDo) {
  findJSFilesForManifest(config.fsNode, function(err, filesString) {
    if (err) { thenDo(err); return; }
    filesString = filesString.replace(/\.\//g, '/');
    thenDo(null, "CACHE MANIFEST\n# version\n\n" + filesString);
  });
}

// -=-=-=-=-=-
// the handler
// -=-=-=-=-=-
function ManifestHandler(cfg) {
  config = cfg;
}

ManifestHandler.prototype.registerWith = function(app) {
  // route for serving the manifest file
  if (!config.useManifestCaching) return;
  function handleRequest(req, res) {
    buildManifestFileContents(function(err, contents) {
      if (err) {
        res.status(500).send('');
      } else {
        res.set(headers);
        res.set('Content-Length', contents.length);
        if (req.method === 'head') res.end();
        else res.send(contents);
      }
    });
  }
  app.get('/' + manifestFileName, handleRequest);
  app.head('/' + manifestFileName, handleRequest);
}

ManifestHandler.prototype.addManifestRef = function(req, res) {
  // when serving html files this methods rewrites what is send so that the
  // html source includes a ref to the manifest file
  if (!config.useManifestCaching) return;

  // only when reading html files
  if (!(/\.html$/.test(req.url)) || req.method.toLowerCase() !== 'get') return;

  // that's a bit hacky....
  var interceptedHeaders, interceptedHeadersCode,
      writeFunc = res.write,
      writeHeadFunc = res.writeHead;

  res.writeHead = function(code, headers) {
    interceptedHeaders = headers;
    interceptedHeadersCode = code;
    if (code >= 400) {
      writeHeadFunc.call(this, code, headers);
    }
  }

  res.write = function(data) {
    if (interceptedHeadersCode >= 400) {
      return writeFunc.call(this, data);
    }
    var s = data.toString();
    s = s.replace(/<html>/, '<html manifest="' + manifestFileName + '">');
    interceptedHeaders['content-length'] = s.length;
    writeHeadFunc.call(this, interceptedHeadersCode, interceptedHeaders);
    return writeFunc.call(this, s);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

exports.ManifestHandler = ManifestHandler;
