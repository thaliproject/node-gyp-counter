"use strict";

var PouchDB = require("pouchdb");
var npmUtilities = require("./lib/npmUtilities");
var npmLatestIndex = require("./lib/npmLatestIndex");
var describeGypUsage = require("./lib/describeGypUsage");
var promise = require("bluebird");

var downloadGenerateIndexAndAnalyze =
  function (localNpmDBName, npmDownloadStatDBName, remoteDbUrl) {
    var localDb = new PouchDB(localNpmDBName);
    return new promise(function (resolve, reject) {
      var lastTime = new Date().getTime();
      console.log("Starting download at: " + new Date());
      npmUtilities.syncNpm(
        remoteDbUrl || npmUtilities.irisCouchDbUrl,
        localDb
      )
        .on("change", function (info) {
          var newTime = new Date().getTime();
          // info.docs contains a ton of data and so spams the console
          delete info.docs;
          console.log(newTime - lastTime +
                      " - Still working - " + JSON.stringify(info));
          lastTime = newTime;
        })
        .on('complete', function () {
          console.log("Download finished at: " + new Date());
          npmLatestIndex.designDoc(localDb)
            .then(function () {
              return describeGypUsage.gypUsageData(localDb,
                                    npmDownloadStatDBName);
            }).then(function (gypUsageDataObject) {
              return resolve(gypUsageDataObject);
            });
        }).on('error', function (err) {
          return reject(err);
        });
    });
  };

exports.downloadGenerateIndexAndAnalyze = downloadGenerateIndexAndAnalyze;

var downloadAndDisplayData =
  function (localNpmDBName, npmDownloadStatDBName, remoteDbUrl) {
    return downloadGenerateIndexAndAnalyze(localNpmDBName,
                        npmDownloadStatDBName, remoteDbUrl)
      .then(function (gypUsageDataObject) {
        describeGypUsage.displayGypUsageData(gypUsageDataObject);
        return true;
      });
  };

exports.downloadAndDisplayData = downloadAndDisplayData;