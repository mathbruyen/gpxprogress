'use strict';

var Promise = require('es6-promise').Promise;
var fs = require('fs');
var traceur = require('traceur');
var browserify = require('browserify');

function http(host) {
  var axios = require('axios');
  function call(config) {
    config.url = host + config.url;
    return axios(config);
  }
  return call;
}

function authenticated(http, user, password) {
  return http({
    url : '/_session',
    method : 'post',
    data : { name : user, password : password }
  }).then(function (response) {
    var cookie = response.headers['set-cookie'][0];
    function call(config) {
      if (!config.headers) {
        config.headers = {};
      }
      config.headers.Cookie = cookie;
      return http(config);
    }
    return call;
  });
}

function clean(http, user, password) {
  return authenticated(http, user, password).then(function (auth) {
    return Promise.all([
      auth({ method : 'delete', url : '/trace' }).catch(console.log.bind(console, 'Cannot delete trace db')),
      auth({ method : 'delete', url : '/app' }).catch(console.log.bind(console, 'Cannot delete app db'))
    ]).then(function () {
      return auth({ method : 'delete', url : '/_config/admins/' + user }).catch(console.log.bind(console, 'Cannot delete admin'));
    });
  }).catch(console.log.bind(console, 'User not existing'));
}

function readFile(filename, binary) {
  return new Promise(function (resolve, reject) {
    fs.readFile(filename, function (err, data) {
      if (err) {
        reject(err);
      } else {
        if (binary) {
          resolve(new Uint8Array(data).buffer);
        } else {
          resolve(data.toString());
        }
      }
    });
  });
}

function writeFile(filename, content) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(filename, content, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function bundle(fn) {
  return new Promise(function (resolve, reject) {
    var b = browserify();
    fn(b);
    b.bundle(function (err, buf) {
      if (err) {
        reject(err);
      } else {
        resolve(buf.toString('utf-8'));
      }
    });
  });
}

function bundlePackage(name) {
  return bundle(function (b) {
    b.add('./src/' + name);
  });
}

function bundleMethod(name) {
  return bundle(function (b) {
    b.require('./src/' + name, { expose : 'method' });
  }).then(function (content) {
    return '(function () { ' + content + '; return require("method"); })()';
  });
}

function compile(scriptName) {
  return readFile('src/' + scriptName)
    .then(function (src) {
      return traceur.compile(src, { experimental : true });
    })
    .then(writeFile.bind(null, './src/traced-app.js'))
    .then(bundlePackage.bind(null, 'traced-app.js'));
}

function attachAppContent(auth, filename, mime, content) {
  return Promise.all([
    content,
    auth({ method : 'head', url : '/app/app' })
  ]).then(function (args) {
    return auth({
      method : 'put',
      url : '/app/app/' + filename,
      headers : { 'Content-Type' : mime, 'If-Match' : args[1].headers.etag },
      data : args[0]
    });
  });
}

function attachAppScript(auth, scriptName) {
  return attachAppContent(auth, scriptName, 'application/javascript', compile(scriptName));
}

function appDb(auth) {
  return auth({ method : 'put', url : '/app' })
    .then(auth.bind(null, { method : 'put', url : '/app/app', headers : { 'Content-Type' : 'application/json' }, data : {}}))
    .then(attachAppContent.bind(null, auth, 'index.html', 'text/html', readFile('app/index.html')))
    .then(attachAppContent.bind(null, auth, 'app.css', 'text/css', readFile('app/app.css')))
    .then(attachAppContent.bind(null, auth, 'leaflet.css', 'text/css', readFile('node_modules/leaflet/dist/leaflet.css')))
    .then(attachAppContent.bind(null, auth, 'document-register-element.js', 'application/javascript', readFile('node_modules/document-register-element/build/document-register-element.js')))
    .then(attachAppContent.bind(null, auth, 'favicon.png', 'image/png', readFile('app/favicon.png', true)))
    .then(attachAppContent.bind(null, auth, 'traceur-runtime.js', 'application/javascript', readFile('node_modules/traceur/bin/traceur-runtime.js')))
    .then(attachAppScript.bind(null, auth, 'app.js'));
}

function traceDb(auth) {
  return auth({ method : 'put', url : '/trace' })
    .then(function () {
      return auth({
        method : 'put',
        url : '/trace/_design/auth',
        headers : { 'Content-Type' : 'application/json' },
        data : { 'validate_doc_update' : 'function (newDoc, oldDoc, userCtx) { if ((!userCtx) || userCtx.name !== "mathieu") { throw({ unauthorized: "Cannot modify documents" }); }}' }
      });
    })
    .then(function () {
      return Promise.all([
        bundleMethod('map.js'),
        bundleMethod('reduce.js'),
        bundleMethod('fullcontent-map.js'),
        bundleMethod('fullcontent-list.js')
      ]).then(function (args) {
        return auth({
          method : 'put',
          url : '/trace/_design/sync',
          headers : { 'Content-Type' : 'application/json' },
          data : {
            views : {
              summary : { map : args[0], reduce : args[1] },
              fullcontent : { map : args[2] }
            },
            lists : {
              fullcontent : args[3]
            }
          }
        });
      });
    });
}

function configure(http, user, password) {
  return http({ method : 'put', url : '/_config/admins/' + user, data : '"' + password + '"' })
    .then(authenticated.bind(null, http, user, password))
    .then(function (auth) {
      return Promise.all([
        traceDb(auth),
        appDb(auth)
      ]);
    });
}

if (!process.env.HOST) {
  throw new Error('Requires HOST environment variable to be defined.');
}
if (!process.env.PASSWORD) {
  throw new Error('Requires PASSWORD environment variable to be defined.');
}

var db = http(process.env.HOST);
var user = 'mathieu';
var password = process.env.PASSWORD;
clean(db, user, password)
  .then(configure.bind(null, db, user, password))
  .then(console.log.bind(console, 'Done'))
  .catch(console.error.bind(console));
