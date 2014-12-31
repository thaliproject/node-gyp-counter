"use strict";

/* global describe, it */

var nodeGypCounter = require("../index.js");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var expect = chai.expect;

chai.use(chaiAsPromised);

describe("Run the whole thing", function() {
  it("should take a good 20 minutes", function() {
    this.timeout(20 * 60 * 1000);
    return expect(nodeGypCounter
                  .downloadGenerateIndexAndAnalyze("localNpmDBName"))
      .to.eventually.be.true;
  });
});