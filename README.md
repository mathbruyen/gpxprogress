# Live GPS tracker

Served from a [CouchDB instance](http://couchdb.apache.org/).

## Deploy

Once the instance is set up (for example [through a docker container](https://github.com/klaemo/docker-couchdb)), set variables:

* `HOST` - the host and port of the CouchDB server: `export HOST="http://127.0.0.1:8080"`
* `PASSWORD` - the admin password to set: `export PASSWORD=testingftw`

and run `node index.js` which configures the database and uploads the app to it.

## Required tooling for deployment

* [jq](http://stedolan.github.io/jq/)
* [cURL](http://curl.haxx.se/)
