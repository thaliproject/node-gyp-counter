"use strict";

var PouchDB = require("pouchdb");
var debug = require("debug")("node-gyp-counter:npmUtilities");

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
      }
    }
  });

  return PouchDB.replicate(remoteNpmDB, localNpmDB, {
    live: false,
    batch_size: 1000,
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