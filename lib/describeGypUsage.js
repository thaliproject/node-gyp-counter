"use strict";

var Immutable = require('immutable');
var npmUtilities = require("./npmUtilities");
var promise = require("bluebird");
var prettyjson = require("prettyjson");

var DependentsRecord = Immutable.Record({
  confirmed: false, // If false then we haven't seen the NPM entry for this
                    // dependency yet. In other words we found a project X
                    // with a dependency Y and so created an entry for Y
                    // but haven't actually found the Y NPM record yet.
  gypRoot: false, // If true this project directly uses node-gyp
  dependents: Immutable.Set() // Projects that are dependent on this project
});

function reduceToDependentsRecord(dependentsRecords, doc) {
  function reduceDependencies(dependentsRecords, dependencyName) {
    return dependentsRecords
      .update(dependencyName, function (dependentsRecord) {
        if (dependentsRecord) {
          if (dependentsRecord.dependents.has(doc.key)) {
            throw "This record has already been added as a dependent!";
          }
          return new DependentsRecord({
            confirmed: dependentsRecord.confirmed,
            gypRoot: dependentsRecord.gypRoot,
            dependents: dependentsRecord.dependents.add(doc.key)
          });
        }
        return new DependentsRecord({
          dependents: Immutable.Set().add(doc.key)
        });
      });
  }

  function updateIndexRecordEntry(existingValue) {
    if (existingValue && existingValue.confirmed) {
      throw "This record got created twice!!!";
    }

    var value = doc.value;

    return new DependentsRecord({
      confirmed: true,
      gypRoot: !!(value.gypfile || (value.scripts && value.scripts.install)),
      dependents: existingValue ? existingValue.dependents : Immutable.Set()
    });
  }

  var newDependentsRecords =
    dependentsRecords.update(doc.key, updateIndexRecordEntry);

  if (doc.value.dependencies) {
    return Object.keys(doc.value.dependencies)
      .reduce(reduceDependencies, newDependentsRecords);
  }

  return newDependentsRecords;
}

/**
 * Takes as input the NPM tree and returns a reverse tree tracing
 * from a dependency to its dependents
 * @param dbIndexRows - Rows from goodDocIndex (consists of a
 * project's name and its dependencies)
 * @returns {*} - A map of DependentsRecord where the key
 * is the project key and the value is DependentsRecord
 */
function reverseGypTree(dbIndexRows) {
  return dbIndexRows
    .reduce(reduceToDependentsRecord, Immutable.Map())
    .filter(function (dependentsRecord, packageName) {
      if (dependentsRecord.confirmed === false) {
        console.log("Broken dependency - key: " + packageName +
                    ", dependents:" +
                    JSON.stringify(dependentsRecord.dependents));
        return false;
      }
      return true;
    });
}

/**
 * Returns all projects with a node-gyp dependency and what that
 * dependency(ies) is.
 * @param dependentsRecords - A map whose key is a project
 * name and whose value is DependentsRecord
 * @returns {*} - A map of projects that have node-gyp dependencies,
 * each key is the name of one such project and its value is a
 * set of the node-gyp projects it is dependent on somewhere in its
 * tree. In other words if Project X depends on Project Y who depends
 * on Project Z and Z is an node-gyp project then there would be
 * an entry for X listing Z and an entry for Y listing Z.
 */
function calculateGypDependency(dependentsRecords) {
  function depthFirstSearch(gypTree, gypRootName, currentName) {
    // There are loops in the data so we detect them by seeing if we have
    // already processed this record.
    var currentRecord = gypTree.get(currentName);
    if (currentRecord && currentRecord.has(gypRootName)) {
      return gypTree;
    }

    // We record the current node before processing the dependents so the check
    // above can catch loops.
    var newGypTree = gypTree.update(currentName, function (currentSet) {
      return (currentSet || Immutable.Set()).add(gypRootName);
    });

    return dependentsRecords.get(currentName).dependents
      .reduce(function (gypTree, dependentName) {
        return depthFirstSearch(gypTree, gypRootName, dependentName);
      }, newGypTree);
  }

  return dependentsRecords.filter(function (dependentRecord) {
    return dependentRecord.gypRoot;
  }).reduce(function (gypTree, __, gypRootName) {
    return depthFirstSearch(gypTree, gypRootName, gypRootName);
  }, Immutable.Map());
}

/**
 * Takes a map whose keys are package names and returns a promise
 * that will return a map
 * whose keys are package names and whose values are the number
 * of downloads for that package last month
 * @param packageNameMap - Map whose keys are package names
 * @param getDownloadStats - A GetDownloadStats object from npmUtilities
 * to use to retrieve npm state information.
 * @returns {*} - A promise that when resolved will return a map
 * whose keys are package names and whose values are how many
 * times that package was download in the last month
 */
function lastMonthsDownloadNumbers(packageNameMap, getDownloadStats) {
  var downloadsArray = packageNameMap.map(function (__, packageName) {
    return getDownloadStats.getDownloadsForPackageLastMonth(packageName)
      .then(function (downloads) {
        return [ packageName, downloads ];
      });
  }).toArray();

  return promise.all(downloadsArray).then(function (completedDownloadsArray) {
    return Immutable.Map(completedDownloadsArray);
  });
}

/**
 * Calculates a bunch of stats based just on docs from goodDocIndex
 * and pulls down all the gyp package download information
 * @param docs - docs object returned by 'goodDocIndex'
 * @param getDownloadStats - a npmUtilities.GetDownloadStats object
 * @returns {*} - An immutable map with a bunch of useful values
 */
function docsAndDownloads(docs, getDownloadStats) {
  var theReverseGypTree = reverseGypTree(docs.rows);

  var projectGypDependencies =
    calculateGypDependency(theReverseGypTree);
  return lastMonthsDownloadNumbers(projectGypDependencies,
    getDownloadStats)
    .then(function (downloadMap) {
      return Immutable.Map({
        totalNumberOfPackages: docs.rows.length,
        theReverseGypTree: theReverseGypTree,
        onlyRootGypDependencies:
          theReverseGypTree.filter(function (dependentsRecord) {
            return dependentsRecord.gypRoot;
          }),
        totalNumberOfNodeGypPackagesAndDependents: downloadMap.size,
        projectGypDependencies: projectGypDependencies,
        downloadMap: downloadMap
      });
    });
}

/**
 * Uses the good doc index (generated by npmLatestIndex) to generate
 * data about node-gyp
 * @param dbWithGoodDocIndex - PouchDB instance that has downloaded
 * the skimdb content and had the goodDocIndex run on it.
 * @param {string} npmDownloadStatDBName - Name of PouchDB file to use
 * to cache npm download data.
 * @returns {*} - Returns an object with lots of data about
 * node-gyp usage.
 */
function gypUsageData(dbWithGoodDocIndex, npmDownloadStatDBName) {
  var getDownloadStats =
    new npmUtilities.GetDownloadStats(npmDownloadStatDBName);
  return dbWithGoodDocIndex.query('goodDocIndex')
    .then(function (docs) {
      return docsAndDownloads(docs, getDownloadStats);
    }).then(function (resultsMap) {
      return getDownloadStats.getAllDownloadsForLastMonth()
        .then(function (allDownloadsForLastMonth) {
          return resultsMap.set("allDownloadsForLastMonth",
            allDownloadsForLastMonth);
        });
    }).then(function (resultsMap) {
      var returnValue = resultsMap.toObject();

      returnValue.allDownloadsOfNodeGypPackagesAndDependents =
        returnValue.downloadMap.reduce(function (sum, packageDownloads) {
          return sum + packageDownloads;
        }, 0);

      returnValue.histogramNumberOfPackages = returnValue.projectGypDependencies
        .reduce(function (histogram, listOfGypProjects) {
          return histogram.update(listOfGypProjects.size,
            function (currentCountValue) {
              return (currentCountValue || 0) + 1;
            });
        }, Immutable.Map());

      returnValue.histogramNumberOfDownloads =
        returnValue.projectGypDependencies
          .reduce(function (histogram, listOfGypProjects, projectName) {
          return histogram.update(listOfGypProjects.size,
            function (currentDownloadValue) {
              return (currentDownloadValue || 0) +
                returnValue.downloadMap.get(projectName);
            });
        }, Immutable.Map());

      returnValue.sortedGypDependentsDownloadsHighToLow =
        returnValue.downloadMap.sort(function (valueA, valueB) {
          return valueA > valueB ? -1 :
              valueA < valueB ? 1 : 0;
        });

      returnValue.sortedOnlyGypDownloadsHighToLow =
        returnValue.sortedGypDependentsDownloadsHighToLow
          .filter(function (__, packageName) {
          return returnValue.onlyRootGypDependencies.has(packageName);
        });

      return returnValue;
    });
}

exports.gypUsageData = gypUsageData;

function displayGypUsageData(gypUsageDataObject) {
  var outputData = {
    "Total number of packages": gypUsageDataObject.totalNumberOfPackages,
    "Total number of node-gyp packages":
      gypUsageDataObject.onlyRootGypDependencies.size,
    "Total number of node-gyp packages and their dependents":
      gypUsageDataObject.totalNumberOfNodeGypPackagesAndDependents,
    "Percentage of packages that use node-gyp:":
      gypUsageDataObject.totalNumberOfNodeGypPackagesAndDependents /
      gypUsageDataObject.totalNumberOfPackages,
    "Total number of package downloads last month":
      gypUsageDataObject.allDownloadsForLastMonth,
    "Total number of node-gyp & dependents downloads last month":
      gypUsageDataObject.allDownloadsOfNodeGypPackagesAndDependents,
    "Percentage of downloads for node-gyp & dependents":
      gypUsageDataObject.allDownloadsOfNodeGypPackagesAndDependents /
      gypUsageDataObject.allDownloadsForLastMonth,
    "Histogram of number of packages with X node-gyp dependencies":
      gypUsageDataObject.histogramNumberOfPackages.toJS(),
    "Histogram of downloads of packages with X node-gyp":
      gypUsageDataObject.histogramNumberOfDownloads.toJS(),
    "List of top 20 node-gyp dependent packages by downloads":
      gypUsageDataObject.sortedGypDependentsDownloadsHighToLow.take(20).toJS(),
    "List of top 20 actual node-gyp packages by downloads":
      gypUsageDataObject.sortedOnlyGypDownloadsHighToLow.take(20).toJS()
  };
  console.log(prettyjson.render(outputData));
}

exports.displayGypUsageData = displayGypUsageData;