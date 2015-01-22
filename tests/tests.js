"use strict";

/* global describe, it */

var nodeGypCounter = require("../index.js");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var expect = chai.expect;
var npmUtilities = require("../lib/npmUtilities");

chai.use(chaiAsPromised);

describe("Run the whole thing", function() {
  it("should take a good 2 hours for the first download", function() {
    this.timeout(2 * 60 * 60 * 1000);

    return expect(nodeGypCounter
                  .downloadAndDisplayData("localNpmDBName",
                                           "npmStatCache",
                                           npmUtilities.skimDbUrl))
      .to.eventually.be.true;
  });
});