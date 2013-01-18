/*global module, console, setTimeout*/

var lifeStar = require("./../life_star"),
    fs = require('fs'),
    server;

function withLifeStarDo(test, func, options) {
    if (server) test.assert(false, 'life_star already running!')
    options = options || {};
    options.host = options.host || 'localhost';
    options.port = options.port || 9999;
    server = lifeStar(options);
    server.on('error', function(e) {
        test.ifError(e);
        test.done();
    });
    setTimeout(function() { func(server) }, 500);
}

function shutDownLifeStar(thenDo) {
    if (!server) { thenDo(); return }
    server.close(function() {
        server = null;
        console.log("life_star shutdown");
        thenDo();
    });
}

var tempFiles = [], tempDirs = [];
function createTempFile(filename, content) {
    fs.writeFileSync(filename, content);
    tempFiles.push(filename);
    console.log('created ' + filename);
}

function cleanupTempFiles() {
    tempFiles.forEach(function(file) { fs.unlinkSync(file); });
    tempFiles = [];
}


module.exports = {
    withLifeStarDo: withLifeStarDo,
    shutDownLifeStar: shutDownLifeStar,
    createTempFile: createTempFile,
    cleanupTempFiles: cleanupTempFiles
}
