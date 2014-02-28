//
// app.js - blackhighlighter main Node.JS server-side application code 
// Copyright (C) 2012-2014 HostileFork.com
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//   See http://hostilefork.com/blackhighlighter for documentation.
//


// Initially cloud foundry supported node.js 0.4 which required you
// to include the following line at the top of your files:
//
//    require.paths.unshift('./node_modules');
//
// See my notes in this StackOverflow answer for how to get cloud
// foundry to use node 0.6 via "vmc push" or manifest.yml
//
//     http://stackoverflow.com/a/10229138/211160



// 
// CONFIGURE REQUIREJS
//
// One of the biggest "meta" issues in programming is how modules are 
// organized and included.  To use a JavaScript file in a web page you
// use a <script> tag and all of the scripts are loaded asynchronously.
// While you don't really need to put any structure on those files and
// can just make global functions, there are informal best-practices to do 
// information-hiding and some codified standards like jQuery plugins.
//
// Node.js comes with a loading function called "require" which
// synchronously loads script code from the local disk.  It has some
// amount of convention so you don't have to necessarily specify the
// full path to a module, and you also omit the ".js" extension.  If one
// is to take advantage of the ability to share code between client and
// server code with node.js, you need some kind of adapter.  The most
// thoroughly-considered adapter introduces an inclusive standard that
// meansa you write your modules in a way that isn't compatible with
// either require or the <script> method:
//
//     http://requirejs.org/docs/node.html#3
//
// It's all pretty much a train wreck, and evokes this xkcd:
//
//     http://xkcd.com/927/
//
// But I'm going to use this for now because at least it's documented, 
// and if it turns out to be a bust there are enough people using it
// that someone will presumably write the "how to change your code
// from requirejs to the real answer".  :-/
//
// You can use require ordinarily in the node modules, unless that
// module is intended to be shared between the browser and server.
// If you want to include one of those shared modules, then use the
// the keyword requirejs to import it.
//

var requirejs = require('requirejs');

requirejs.config({
    //Pass the top-level main.js/index.js require
    //function to requirejs so that node modules
    //are loaded relative to the top-level JS file.
    nodeRequire: require,
	
	// Note: do not include the '.js' at the end of these paths!
	paths: {
		'use': 'public/js/use',
		'sha256': "public/js/sha256"
	},
	
	// https://github.com/tbranyen/use.js
	// Similar to: https://github.com/gartz/RequireJS-Wrapper-Plugin
	use: {
		'underscore': {
			attach: '_'
		},
		'sha256': {
			attach: 'sha256export'
		}
	}
});


//
// UTILITY LIBRARIES
//

// Underscore contains common JavaScript helpers like you might find in a
// library like jQuery (forEach, isString, etc)...but without being tied
// into the presumption that you are running in a browser with a DOM, etc.
//
// http://documentcloud.github.com/underscore/
var _ = require('underscore')._;

// The default way of coding in node.js with asynchronous callbacks
// produces a new level of nesting and indentation each time you add a
// step to your process.  Using the Step library you can cleanly
// express sequential asynchronous operations, and it has support for
// spawning several parallel operations and waiting until all of them
// have returned to move on to the next step.  It also catches
// exceptions for you to keep the node server from going down.
//
//  https://github.com/creationix/step
var Step = require('step');



// 
// BASIC HTTP SETUP
//
// The Virtual Cloud tells us our port and host, but if we are running
// locally we default to localhost and port 8080 (used by nodejitsu).
//

// JavaScriptOR (||) variable assignment:
// http://stackoverflow.com/questions/2100758/
var port = (process.env.PORT || 3000);
var host = (process.env.HOST || 'localhost');
var http = require('http');



// 
// MONGODB DATABASE CONFIGURATION
//
// Mongodb interface from 
// http://blog.mongodb.org/post/6587009156/cloudfoundry-mongodb-and-nodejs
//
// Best reference for Node.js driver
// http://mongodb.github.com/node-mongodb-native/
//

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var mongoConnectURI = (
    process.env.MONGO_CONNECT_URI
    // http://docs.mongodb.org/manual/reference/default-mongodb-port/
    || "mongodb://localhost:27017"
);



//
// ERROR HANDLING
//
// Node is unusual because if its single-threaded server crashes in any given handler,
// it will take down the whole server process.  A general error handling strategy is
// needed.  How do we deal with internally-generated exceptions and errors, as 
// well as exceptions thrown by library code?
//
// http://stackoverflow.com/questions/5816436/error-handling-in-asynchroneous-node-js-calls
//
function SuppressableError() {
	// http://www.nczonline.net/blog/2009/03/10/the-art-of-throwing-javascript-errors-part-2/
	this.message = "This Error Should Be Suppressed, see SuppressableError() in app.js";
}
SuppressableError.prototype = new Error();

// We call this in each step of a Step() besides the first.  Should I tweak or derive
// from Step() so that this is done automatically?  If so, what if a step wanted to
// do at least some of its own exception handling? 
function handleResErr(res, err) {
	if (err) {
		if (!(err instanceof SuppressableError)) {
			console.log("Caught error: " + JSON.stringify(err));			
			res.json({error_handler: 'handleError() in app.js', error_data: err});
		}
		throw new SuppressableError;
	}
}


//
// EXPRESS AND SWIG SETUP
//
// Express is a layer which provides things like URL redirects and content 
// negotiation for the web ( http://expressjs.com/ ).  It does not prescribe any
// particular "templating engine", which lets you author web content as a hybrid
// of boilerplate with dynamic portions weaved in from code.  For that
// I use Swig ( http://paularmstrong.github.com/swig/ ).
//
// I chose Express because it seemed like the de facto standard.  I chose Swig
// because I do not care to edit the HTML portions of my templates as any kind of
// shorthand (plain HTML is fine, thanks).  Also because of my previous
// familiarity with Django--which Swig was designed to be compatible with--due
// to shared philosophy:
//
//     https://docs.djangoproject.com/en/dev/topics/templates/
//
// Swig also fares well in terms of metrics when compared with the competition
// (but do note this table was made by Swig's author):
//
//     http://paularmstrong.github.com/node-templates/
//
// To get Express integrated with Cloud Foundry I referred to slide 99 of
// "Becoming a Node.js ninja on CloudFoundry":
//
//     http://www.slideshare.net/chanezon/cloud-foundry-open-tour-beijing-becoming-a-nodejs-ninja-on-cloud-foundry
//
// To get Swig integrated with Express I referred to this sample code:
//
//     https://github.com/paularmstrong/swig/blob/master/examples/express/server.js
//

var express = require('express');
var app = express();
var swig = require('swig');

// Register the template engine
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Initialize Swig default options, for full list of options see:
//     http://paularmstrong.github.io/swig/docs/api/#SwigOpts
swig.setDefaults({
	loader: swig.loaders.fs(__dirname + '/views')
});

// Load custom template tags
//     http://paularmstrong.github.io/swig/docs/api/#setTag
//     http://paularmstrong.github.io/swig/docs/extending/#tags
var mytags = require('./mytags');
swig.setTag('url', mytags.url.parse, mytags.url.compile, mytags.url.ends);
swig.setTag('comment', mytags.comment.parse, mytags.comment.compile, mytags.comment.ends);

/*
	// Make sure you aren't using Express's built-in "layout extending".
	// This was commented out in the GitHub for Swig's Express example,
	// but it seems to be necessary to get the {% block %} inheritance
	// to work at all!
	layout: false,
*/

app.locals({
	// These are provided to every template context by default
	LIBS_URL: '/public/js/',
	BLACKHIGHLIGHTER_MEDIA_URL: '/public/',
	PROJECT_MEDIA_URL: '/public/',
	NODE_VERSION: process.version

	// optionals, set in your environment somewhere...
	/* HOSTING_SERVICE: string */
});

app.configure('development', function() {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
	app.use(express.errorHandler());
	
	// Express is already set to cache templates in production, apparently
	// https://github.com/kof/node-jqtpl/pull/34
	// app.set('view cache', true);
});

// We need the "bodyParser" middleware to get the various fields out of form
// data passed to us in HTTP post requests
//    http://stackoverflow.com/a/5710916/211160
app.use(express.bodyParser());



//
// COMMON ROUTINES BETWEEN CLIENT AND SERVER
//
// Writing a JavaScript library so that it can be included properly via
// a <script> tag in a browser as well as work with the "require"
// statement is a bit of a puzzle that I haven't figured out yet.
// Just throwing things against a wall and seeing what sticks for the
// moment, but hopefully someone will show me the "right" way.
//

var common = requirejs('public/client-server-common');


//
// HTTP GET/POST ROUTING HANDLERS
//
// This is where we map URL requests to functions that will be serving those
// requests.  Like in other systems, the URL string is matched against regular
// expressions.  Then through "routing" you can have Express parse out
// fragments of the URL, do some handling for a part, and then crunch on the
// rest of the path:
//
//     http://expressjs.com/guide.html#routing
//
// Handler functions take a req object ("REQuest") and a res object
// ("RESponse").  Although the function signature is very similar to view
// dispatch in something like Django, the asynchronous nature of Node.js means
// that the function may pass off the res object to some other subsystem
// and then return.  This delegation will continue until someone finally calls
// res.end() and it is important to ensure that happens only once.
//

// Serve out all files in the public directory statically
// http://stackoverflow.com/questions/5924072/express-js-cant-get-my-static-files-why
app.use("/public", express.static(__dirname + '/public'));

// No homepage for now
app.get('/', function (req, res) {
	res.send('Blackhighlighter app currently in private demo, no public URLs...yet!');
});

// No online documentation for now
app.get('/docs/*', function(req, res) {
	res.send('User documentation links have not been written yet, if you want to ' +
		'learn more about this project, please visit ' +
		'<a href="http://hostilefork.com/blackhighlighter">' +
			'hostilefork.com/blackhighlighter' +
		'</a>');
});

// The /write/ handler is relatively simple, as document authoring happens
// entirely in JavaScript on the client's machine.  The /commit/ HTTP POST
// handler does the actual server-side work of saving the document.
app.get('/write/$', function (req, res) {
    res.render('write', { MAIN_SCRIPT: "write" });
});

function generateHtmlFromCommitAndReveals(commit, reveals) {
	// u'\u00A0' is the non breaking space, should be preserved in db strings via UTF8
	
	// REVIEW: for each one that has been unredacted make
	// a hovery bit so that you can get a tip on when it was made public?
	// how will auditing be done?

	// http://documentcloud.github.com/underscore/#groupBy
	var revealsGroupedByHash = _.groupBy(reveals, function(reveal) { return reveal.sha256; });
	
	// No efficient way to do this?
	//     http://stackoverflow.com/questions/1295584/most-efficient-way-to-create-a-zero-filled-javascript-array
	var redactionIndexByHash = {};
	_.each(revealsGroupedByHash, function(reveal, hash) {
		redactionIndexByHash[hash] = 0;
	});
	
	var resultHtml = '';
	for (var commitSpanIndex = 0; commitSpanIndex < commit.spans.length; commitSpanIndex++) {
		var commitSpan = commit.spans[commitSpanIndex];
		
		if (_.isString(commitSpan)) {
			// line breaks must be converted to br nodes
			var commitSpanSplit = commitSpan.split('\n');
			resultHtml += commitSpanSplit[0];
			for (var commitSpanSplitIndex = 1; commitSpanSplitIndex < commitSpanSplit.length; commitSpanSplitIndex++) {
				resultHtml += '<br />';
				resultHtml += commitSpanSplit[commitSpanSplitIndex];
			}
		} else {
			var revealGroup = revealsGroupedByHash[commitSpan.sha256]; 
			if (revealGroup) {
				var reveal = revealGroup[0];
				resultHtml += '<span class="placeholder revealed" title="' + commitSpan.sha256 + '">';
				resultHtml += reveal.redactions[redactionIndexByHash[commitSpan.sha256]++];
				resultHtml += '</span>'
			} else {				
				var display_length = parseInt(commitSpan.display_length, 10);
				var placeholderString = '';
				for (var fillIndex = 0; fillIndex < display_length; fillIndex++) {
					placeholderString += '?';
				}
				
				// REVIEW: use hex digest as title for query, or do something more clever?
				// e.g. we could add a method onto the element or keep a sidestructure
				var placeholder = '<span class="placeholder protected" title="' + commitSpan.sha256 + '">' +
					placeholderString + '</span>';
				resultHtml += placeholder;
			}
		}
	}
	return resultHtml;
}

function generateCertificateStubsFromCommit(commit) {
	
	var mapSha256ToTrue = {};
	for (var commitSpanIndex = 0; commitSpanIndex < commit.spans.length; commitSpanIndex++) {
		var commitSpan = commit.spans[commitSpanIndex];
		
		if (_.isString(commitSpan)) {
			// Not redacted.
		} else {
			mapSha256ToTrue[commitSpan.sha256] = true;
		}
	}
			
	var result = [];
	_.each(mapSha256ToTrue, function(trueValue, key) {
		result.push({sha256: key});
	});
	return result;
}

function showOrVerify(req, res, tabstate) {
	Step(
		function connectToDatabaseWithAuthorization() {
			console.log(mongoConnectURI);
			mongodb.connect(mongoConnectURI, this);
		},
		function getCommitAndRevealsCollections(err, conn) {
			handleResErr(res, err);
			
			conn.collection('commits', this.parallel());
			conn.collection('reveals', this.parallel());
		},
		function queryForCommitAndReveals(err, commitsColl, revealsColl) {
			handleResErr(res, err);

			// REVIEW: necessary to use ObjectID conversion?
			// http://stackoverflow.com/questions/4902569/node-js-mongodb-select-document-by-id-node-mongodb-native
			commitsColl.find(
				{'commit_id': req.params.commit_id},
				{limit: 1, sort:[['_id', 'ascending']]},
				this.parallel()
			);
			revealsColl.find(
				{'commit_id': req.params.commit_id},
				{sort:[['sha256', 'ascending']]},
				this.parallel()
			);
		},
		function convertResultCursors(err, commitCursor, revealsCursor) {
			handleResErr(res, err);
			
			commitCursor.toArray(this.parallel());
			revealsCursor.toArray(this.parallel());
		},
		function generateResponseHtml(err, commitArray, revealsArray) {
			handleResErr(res, err);

			var commit = undefined;
			if (commitArray.length == 0) {
				// NOTE: Raise a 404 if the letter ID isn't found in the database?
				throw "No commit with requested _id";
			} else if (commitArray.length > 1) {
				// NOTE: Commits should be unique, that is enforced by the DB?
				throw "Multiple commits with same _id.";
			} else {
				commit = commitArray[0];
			}
			
			var reveals = revealsArray;
			// is any checking necessary?
			
			res.render('read', {
				MAIN_SCRIPT: 'read',
				commit_id: req.params.commit_id,
				all_certificates: generateCertificateStubsFromCommit(commit),
				tabstate: tabstate,
				commit: commit,
				revealed_certificates: reveals,
				public_html: generateHtmlFromCommitAndReveals(commit, reveals)
			});
		}
	);
}

app.get('/verify/:commit_id([0-9a-f]+)$', function (req, res) {
	showOrVerify(req, res, 'verify');
});

app.get('/show/:commit_id([0-9a-f]+)$', function (req, res) {
	showOrVerify(req, res, 'show');
});

app.post('/commit/$', function (req, res) {
	// http://www.robertprice.co.uk/robblog/archive/2011/5/JavaScript_Date_Time_And_Node_js.shtml
	var requestTime = new Date();
			
	Step(
		function connectToDatabaseWithAuthorization() {
			mongodb.connect(mongoConnectURI, this);
		},
		function getCommitCollection(err, conn) {
			handleResErr(res, err);
			conn.collection('commits', this);
		},
		function addCommitToCollection(err, coll) {
			handleResErr(res, err)
			// second parameter is default
			var commit = JSON.parse(req.param('commit', null));
			
			// We should verify that what we've been given fits the proper form for
			// a commit, and doesn't have extra garbage being stored in the database.
			// At the moment I'm just "trusting" that a well formed commit was given
			// to us, which turns us into a generic JSON object store.
			
			// should we check to make sure the date in the request matches so we are on
			// the same page as the client?				
			
			// mongodb JS driver knows about Date() or do we need to use the .toJSON() method?
			commit.commit_date = requestTime;
			commit.commit_id = common.makeIdFromCommit(commit);
			
			// "safe" tells the JSON mongodb driver to do an added check on the
			// getLastError to make sure that the asynchronous insert succeeded
			//     http://www.mongodb.org/display/DOCS/getLastError+Command#getLastErrorCommand-UsinggetLastErrorfromDrivers
			coll.insert(commit, {safe: true}, this);
		},
		function respondWithShowAndVerifyUrlsInJson(err, records) {
			handleResErr(res, err);

			// res.send(common.canonicalJsonFromCommit(records[0]), { 'Content-Type': 'application/json' });
			
			res.json({
				commit_date: records[0].commit_date
			});
		}
	);
});

app.post('/reveal/$', function (req, res) {
	// http://www.robertprice.co.uk/robblog/archive/2011/5/JavaScript_Date_Time_And_Node_js.shtml
	var requestTime = new Date();

	Step(
		function connectToDatabaseWithAuthorization() {
			mongodb.connect(mongoConnectURI, this.parallel());
		},
		function getCommitAndRevealsCollections(err, conn) {
			handleResErr(res, err);
			
			conn.collection('commits', this.parallel());
			conn.collection('reveals', this.parallel());
		},
		function queryForCommitAndOldReveals(err, commitsColl, revealsColl) {
			handleResErr(res, err);

			this.parallel()(null, revealsColl);
			// REVIEW: necessary to use ObjectID conversion?
			// http://stackoverflow.com/questions/4902569/node-js-mongodb-select-document-by-id-node-mongodb-native
			commitsColl.find(
				{'commit_id': req.params.commit_id},
				{limit: 1, sort:[['_id', 'ascending']]},
				this.parallel()
			);
			revealsColl.find(
				{'commit_id': req.params.commit_id},
				{sort:[['sha256', 'ascending']]},
				this.parallel()
			);
		},
		function convertResultCursors(err, revealsColl, commitCursor, oldRevealsCursor) {
			handleResErr(res, err);
			
			this.parallel()(null, revealsColl);
			commitCursor.toArray(this.parallel());
			oldRevealsCursor.toArray(this.parallel());
		},
		function addNewRevealsIfTheyPassVerification(err, revealsColl, commitArray, oldRevealsArray) {
			handleResErr(res, err);

			//
			// The /reveal/ HTTP POST handler historically accepted an array of reveals,
			// because there was no selective UI for picking which reveals that had been
			// locally entered were to be shown.
			//

			// second parameter is default
			var newReveals = JSON.parse(req.param('reveals', null));

			_.each(newReveals, function(newReveal) {
				// mongodb JS driver knows about Date() or do we need to use the .toJSON() method?
				newReveal.reveal_date = requestTime;
				
				// The reveal process needs to check to make sure the certificate is valid before
				// adding it to the reveal database.  Ideally this code would be shared with the
				// code in the client.  For the moment I'm less concerned about that issue than
				// figuring out how MongoDB works with Node.js so trying to close the query loop
				// first...

				// Is string matching not workable, and is it actually necessary 
				// to convert to the ObjectID BSON type to properly run the join query?
				// newReveal.commit_id = new mongodb.DBRef('commits', new mongodb.ObjectID(reveal.commit_id)); 
			});

			this.parallel()(null, newReveals.length);
			
			// "safe" tells the JSON mongodb driver to do an added check on the
			// getLastError to make sure that the asynchronous insert succeeded
			//     http://www.mongodb.org/display/DOCS/getLastError+Command#getLastErrorCommand-UsinggetLastErrorfromDrivers
			revealsColl.insert(newReveals, {safe: true}, this.parallel());
		},
		function respondWithInsertionCountAsJson(err, numReveals) {
			handleResErr(res, err);

			res.json({
				insertion_count: numReveals
			});
		}
	);
});



//
// START LISTENING FOR SERVER REQUESTS
//
// Once we've got all the handlers set up, we can tell Express to start listening
// for connections.
//

app.listen(port, host);
