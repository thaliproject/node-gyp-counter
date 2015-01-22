"use strict";

var PouchDB = require("pouchdb");
var debug = require("debug")("node-gyp-counter:npmUtilities");
var rp = require('request-promise').defaults({
  pool: {
    maxSockets: 15
  }
});
var promise = require('bluebird');

/**
 * Runs a sync between the remote URL and the local DB
 * that will hold the skimdb records.
 * @param remoteNpmDbUrl - The URL to synch from, typically
 * one of the exports from this file
 * @param localNpmDB - PouchDB instance to record records in.
 * @returns {*} - A promise a promise to indicate when finished and
 * to set events on.
 */
function syncNpm(remoteNpmDbUrl, localNpmDB) {
  var remoteNpmDB = new PouchDB(remoteNpmDbUrl, {
    ajax: {
      pool: {
        maxSockets: 15
      },
      timeout: 5 * 60 * 1000
    }
  });

  return PouchDB.replicate(remoteNpmDB, localNpmDB, {
    live: false,
    batch_size: 400,
    retry: true,
    retries: 10000
  })
    .on('change', function(info) {
      debug("Change - " + JSON.stringify(info));
    })
    .on('complete', function(info) {
      debug("Complete - " + JSON.stringify(info) );
    })
    .on('uptodate', function(info) {
      debug("uptodate - " + JSON.stringify(info));
    })
    .on('error', function(err) {
      debug("error - " + JSON.stringify(err));
    });
}

exports.syncNpm = syncNpm;

/**
 * The official source of skimdb records. But in practice it's
 * slow and can have extremely long time outs.
 * @type {string}
 */
exports.skimDbUrl =  "https://skimdb.npmjs.com/registry";

/**
 * A copy of skimdb.npmjs.com managed by Nolan Lawson. When it
 * works it's fast but it can take up to a few minutes from
 * when first hitting the URL until the server manages to
 * start returning data.
 * @type {string}
 */
exports.irisCouchDbUrl =  "http://skimdb.iriscouch.com/registry";

var npmStatUrlBase = "https://api.npmjs.org/downloads/point/";

function zeroPrefixString(integer) {
  return (integer < 10 ? "0" : "") +
    integer.toString();
}

/**
 * Returns the year and month for the previous calendar month
 * @returns {string} - The format is YYYY-MM-
 */
function getYearMonth() {
  var date = new Date();
  // Remember, date months are 0 based
  var thisMonth = date.getMonth();
  var lastMonth = thisMonth === 0 ? 12 : thisMonth;
  var yearForLastMonth = date.getFullYear() - (date.getMonth() === 0 ? 1 : 0);
  return yearForLastMonth + "-" + zeroPrefixString(lastMonth) + "-";
}

/**
 * Generates URL to retrieve download statistics for the previous
 * calendar month from NPM
 * @returns {string}
 */
function getLastMonthUrlBase() {
  var date = new Date();

  // Nasty hack where day 0 is the last day of the previous month
  var lastDayOfLastMonth =
    new Date(date.getFullYear(), date.getMonth(), 0).getDate();

  // Format: YYYY-MM-01:YYYY-MM-DD where DD is the last day of the month
  var yearMonth = getYearMonth();
  return npmStatUrlBase +
    yearMonth + "01:" +
    yearMonth + lastDayOfLastMonth + "/";
}

/**
 * Handles getting download information from NPM state server
 * @param pouchCacheName - Name of local PouchDB to cache stat data so we
 * don't spam the NPM server out of existence
 * @constructor
 */
var GetDownloadStats = function(pouchCacheName) {
  this.pouchDbCache = new PouchDB(pouchCacheName);
};

/**
 * Returns all downloads of the named package from NPM in the last month
 * @param {string} [packageName] - A string containing the package name
 * @returns {*} - A promise whose value is a request-promise object
 */
GetDownloadStats.prototype.getDownloadsForPackageLastMonth =
  function(packageName) {
    var pouchDbCache = this.pouchDbCache;
    return pouchDbCache.get(packageName)
      .catch(function(err) {
        if (err.status === 404) {
          return null;
        }
        return promise.reject(err);
      })
      .then(function(doc) {
        var currentYearMonth = getYearMonth();
        if (doc && doc.yearMonth === currentYearMonth) {
          if (isNaN(doc.downloads)){
            throw "eeek! How did we get a non-number here?!?!?!";
          }
          return doc.downloads;
        }
        return rp(getLastMonthUrlBase() + (packageName ? packageName : ""))
          .then(function(responseBody) {
            if (Math.random() > 0.9) {
              console.log(Date.now() +
                " - download stats for - " + packageName);
            }
            var jsonResponseBody = JSON.parse(responseBody);
            // If there are no downloads for the requested period then
            // a JSON response is returned with an error, but we can
            // just check if downloads is present or not.
            var downloads = jsonResponseBody.downloads ?
              jsonResponseBody.downloads : 0;
            var updatedDoc = {
              yearMonth: currentYearMonth,
              downloads: downloads
            };
            return pouchDbCache
              .put(updatedDoc, packageName, doc ? doc._rev : null)
              .then(function() {
                return downloads;
              });
          });
      });
};

GetDownloadStats.prototype.getAllDownloadsForLastMonth =
  function() {
    return rp(getLastMonthUrlBase())
      .then(function(responseBody) {
        return JSON.parse(responseBody).downloads;
      });
};

exports.GetDownloadStats = GetDownloadStats;