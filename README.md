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

### How accurate is this data?
Not terribly. You may have noticed that there is literally no testing, at all, anywhere. Who knows what horrific
programming errors I have committed?

But wait, it gets worse! You see I didn't have a fully reliable way to figure out which packages use node-gyp. So I
built a heuristic instead. The reason is that to be really sure which packages use node-gyp I would have to download
and install, well, all packages. That turns out to involve terabytes of downloads and um... no. So instead I look for
things like install scripts or gyp flags. Again, not terribly scientific.

### How long should it take to download all the data?
A long, long time. PouchDB seems pretty glacial. It takes me up to two hours just to download
the NPM package database. By comparison CouchDB synch'd the same data in 20 minutes. I hope to eventually track down
and fix these problems (I have suspicions about what the problem is) but in the meantime, patience is a virtue.

### How do I run tests?
What tests? O.k. there is one test. I just use that because Mocha is easy to run in Intellij. But really, there are
no tests.