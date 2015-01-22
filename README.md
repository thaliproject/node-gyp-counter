node-gyp-counter
================

An unscientific exploration of how node-gyp is being used in the node.js ecosystem.

## How to install

NPM is your friend:

```bash
$ npm install node-gyp-counter
```

Although generally one suspects package.json is preferable.

## How to use
Take a look at tests/tests.js for an example. There are really just two key functions and they are in index.js.

```javascript
var nodeGypCounter = require('node-gyp-counter');
var npmUtilities = require("../lib/npmUtilities");
downloadAndDisplayData("localNpmDBName", "npmStatCache", npmUtilities.skimDbUrl));
```

This will output to the console a few statistics about node-gyp usage in NPM. You can also call
downloadGenerateIndexAndAnalyze with the same arguments and get back a JSON object with the raw data.

## Q&A
### The code doesn't seem very friendly, it eats up the main thread!
This code was really written as a canned query not as anything that would be run on an actual production server. I just
load it up on my local node.js instance and run. So I have spent no time worrying about making it friendly to any code
it shares the node.js server with.

### How correct is the code?
You may have noticed that there is literally no testing, at all, anywhere. Who knows what horrific
programming errors I have committed?

But wait, it gets worse! You see I didn't have a fully reliable way to figure out which packages use node-gyp. So I
built a heuristic instead. The reason is that to be really sure which packages use node-gyp I would have to download
and install, well, all packages. That turns out to involve terabytes of downloads and um... no. So instead I look for
things like install scripts or gyp flags. Again, not terribly scientific.

### How correct is the analysis?
Oy... where to begin? I decided for no good reason to only look at the latest versions of projects. So if a project did
use node-gyp and doesn't anymore I'll miss it. I only use the previous month's data for download stats. So a project
that hasn't had a recent release and so doesn't have a lot of updates could easily be undercounted. I allow in projects
with broken dependencies for no good reason at all (presumably their downloads are low since they shouldn't work). Etc.

### How long should it take to download all the data?
A long, long time. PouchDB seems pretty glacial. It takes me up to two hours just to download
the NPM package database. By comparison CouchDB synch'd the same data in 20 minutes. I hope to eventually track down
and fix these problems (I have suspicions about what the problem is) but in the meantime, patience is a virtue.

### How do I run tests?
What tests? O.k. there is one test. I just use that because Mocha is easy to run in Intellij. But really, there are
no tests.

### Why do you use the skimdb.npmjs.com URL rather than skimdb.iriscouch.com?
In theory iriscouch is faster, especially because it doesn't use HTTPS. But in practice I've had endless problems with
node.js timing out trying to connect to iriscouch. Iriscouch does appear to be up and working but in examining
connection times it does take quite a while to establish a connection. I think this time exceeds node.js's patience
and I have not found a way to configure node.js's behavior. Note that the timeout option on things like request is
about how long to wait for data, not for the TCP handshake.