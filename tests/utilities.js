"use strict";

var http = require("http");
var PouchDB = require("pouchdb");
var Promise = require("bluebird");

// These functions were used for doing perf comparison testing with
// CouchDB
function seeIfLocalCouchDbIndexGenerationIsDone(startTime) {
  http.get("http://localhost:5984/registry/_design/goodDocIndex/_info", function(res) {
    var responseBody = "";
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      responseBody += chunk;
    });
    res.on('end', function() {
      var output = JSON.parse(responseBody);
      if (output.view_index.updater_running) {
        setTimeout(function () { seeIfLocalCouchDbIndexGenerationIsDone(startTime); }, 100);
      } else {
        console.log("Runtime: " + (new Date().getTime() - startTime));
      }
    });
  });

}

function couchDesignDoc() {
  var db = new PouchDB("http://localhost:5984/registry/");
  var startTime;
  db.get('_design/goodDocIndex').then(function(doc) {
    return Promise.reject("Go delete and clean up the bloody view!");
  }).catch(function(err) {
    if (err.status !== 404) {
      return Promise.reject("Huh? " + err);
    }
    return db.put(goodDocIndex);
  }).then(function() {
    startTime = new Date().getTime();
    return db.query('goodDocIndex', {limit: 10});
  }).catch(function(err) {
    if (err.status !== 400) {
      console.log("Failing error, we should have gotten a timeout: " + err);
      return;
    }
    seeIfLocalCouchDbIndexGenerationIsDone(startTime);
  }).then(function(results) {
    console.log("Runtime: " + (new Date().getTime() - startTime));
    console.log(results);
  }).catch(function(err) {
    console.log(err);
  });
}

exports.couchDesignDoc = couchDesignDoc;