"use strict";

var PouchDB = require("pouchdb");
var npmUtilities = require("./lib/npmUtilities");
var npmLatestIndex = require("./lib/npmLatestIndex");
var describeGypUsage = require("./lib/describeGypUsage");
var promise = require("bluebird");

var downloadGenerateIndexAndAnalyze = function (localNpmDBName, remoteDbUrl) {
  var localDb = new PouchDB(localNpmDBName);
  return new promise(function(resolve, reject) {
    npmUtilities.syncNpm(
      remoteDbUrl ? remoteDbUrl : npmUtilities.irisCouchDbUrl,
      localDb).on('complete', function() {
        npmLatestIndex.designDoc(localDb)
        .then(function() {
          return describeGypUsage.describeGypUsage(localDb);
        }).then(function() {
          return resolve(true);
        });
      }).on('error', function(err) {
        return reject(err);
      });
  });
};

exports.downloadGenerateIndexAndAnalyze = downloadGenerateIndexAndAnalyze;