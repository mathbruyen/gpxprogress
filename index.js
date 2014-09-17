'use strict';

var Promise = require('es6-promise').Promise;
var fs = require('fs');

function http(host) {
  var axios = require('axios');
  function call(config) {
    config.url = process.env.HOST + config.url;
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
      config.headers['Cookie'] = cookie;
      return http(config);
    }
    return call;
  });
}

function clean(http, user, password) {
  return authenticated(http, user, password).then(function (auth) {
    return Promise.all([
      auth({ method : 'delete', url : '/trace' }).catch(console.log.bind(console, 'Cannot delete trace db')),
      auth({ method : 'delete', url : '/plan' }).catch(console.log.bind(console, 'Cannot delete plan db')),
      auth({ method : 'delete', url : '/app' }).catch(console.log.bind(console, 'Cannot delete app db'))
    ]).then(function () {
      return auth({ method : 'delete', url : '/_config/admins/' + user }).catch(console.log.bind(console, 'Cannot delete user'));
    });
  }).catch(console.log.bind(console, 'User not existing'));
}

function appDb(auth) {
  return auth({ method : 'put', url : '/app' })
    .then(auth.bind(null, { method : 'put', url : '/app/app', headers : { 'Content-Type' : 'application/json' }, data : {}}))
    .then(function (response) {
      return auth({ method : 'put', url : '/app/app/index.html', headers : { 'Content-Type' : 'text/html', 'If-Match' : response.data.rev }, data : fs.readFileSync('index.html', { encoding : 'utf-8' }) });
    })
    .then(function (response) {
      // TODO binary return auth({ method : 'put', url : '/app/app/favicon.png', headers : { 'Content-Type' : 'image/png', 'If-Match' : response.data.rev }, data : fs.readFileSync('favicon.png', { encoding : 'utf-8' })});
    });
}

function configure(http, user, password) {
  return http({ method : 'put', url : '/_config/admins/' + user, data : '"' + password + '"' })
    .then(authenticated.bind(null, http, user, password))
    .then(function (auth) {
      return Promise.all([
        auth({ method : 'put', url : '/trace' }),
        auth({ method : 'put', url : '/plan' }),
        appDb(auth),
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
