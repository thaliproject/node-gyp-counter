"use strict";

/*global emit */

var promise = require("bluebird");

var goodDocIndex = {
  _id: '_design/goodDocIndex',
  views: {
    'goodDocIndex': {
      map: function (doc) {
        if (!doc["dist-tags"] || !doc["dist-tags"].latest) {
          return;
        }

        var latestVersion = doc["dist-tags"].latest;

        if (!doc.versions || !doc.versions[latestVersion]) {
          return;
        }

        emit(doc._id, doc.versions[latestVersion]);
      }.toString()
    }
  }
};

/**
 * Generates an index called goodDocIndex just containing the latest
 * versions of NPM records that appear to be in good shape
 * @param db - A PouchDB instance that contains skimdb's contents
 * @returns {*} - A promise to indicate when finished
 */
function designDoc(db) {
  return db.get('_design/goodDocIndex').then(function (doc) {
    goodDocIndex._rev = doc._rev;
    return db.put(goodDocIndex);
  }).catch(function (err) {
    if (err.status !== 404) {
      console.log("Failing error: " + err);
      return promise.reject(err);
    }
    return db.put(goodDocIndex);
  });
}

exports.designDoc = designDoc;
