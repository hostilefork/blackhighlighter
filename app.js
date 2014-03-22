"use strict";

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
//   See http://blackhighlighter.hostilefork.com for documentation.
//


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
		'jquery-blackhighlighter':
			'jquery-blackhighlighter/jquery-blackhighlighter',

		'jquery': 'jquery-fake'
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
// step to your process.  Originally I used the Step library to address this,
// but decided to convert to the Q Promises library instead:
// 
// http://stackoverflow.com/questions/22138759/
var Q = require('q');


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
// Node is unusual because if its single-threaded-server crashes in any given
// handler, it will take down the whole server process.  A general error
// handling strategy is needed.  How do we deal with exceptions that are thrown
// on invalid inputs from the client, vs. internal errors.
//
// http://stackoverflow.com/questions/5816436/
//
// For now just strings, but we want the stack trace in there too
//
// http://www.devthought.com/2011/12/22/a-string-is-not-an-error/
//
// See note here about how arguments.callee is not to be used in strict mode:
//
// https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
//
function ClientError(msg) {
	// http://stackoverflow.com/a/13294728/211160
	if (!(this instanceof ClientError)){ return new ClientError(msg); }

	Error.call(this);
	Error.captureStackTrace(this, ClientError);
	this.message = msg;
	this.name = 'ClientError';
};
ClientError.prototype.__proto__ = Error.prototype;

function resSendJsonForErr(res, err) {

	if (!err) {
		// Legacy from Step; changing to not call this when there is no error
		throw Error("resSendJsonForErr called without an error parameter");
	} 

	if (err instanceof Error) {
		console.error(err.stack);
	} else {
		console.warn("Non-error subclass thrown, bad style...");
	}

	if (err instanceof ClientError) {
		console.error(err.message);
		res.json(400, { error: err.toString() });
	} else {
		res.json(500, { error: err.toString() });
	}
}


//
// EXPRESS AND SWIG SETUP
//
// Express is a layer which provides things like URL redirects and content 
// negotiation for the web ( http://expressjs.com/ ).  It does not prescribe
// any particular "templating engine", which lets you author web content as a
// hybrid of boilerplate with dynamic portions weaved in from code.  For that
// I use Swig ( http://paularmstrong.github.com/swig/ ).
//
// I chose Express because it seemed like the de facto standard.  I chose Swig
// because I was originally porting Blackhighlighter from Django, which Swig
// was designed to be (mostly) compatible with--due to shared philosophy:
//
// https://docs.djangoproject.com/en/dev/topics/templates/
//
// Swig also fares well in terms of metrics when compared with the competition
// (but do note this table was made by Swig's author):
//
// http://paularmstrong.github.io/node-templates/
//
// To get Swig integrated with Express I referred to this sample code:
//
// https://github.com/paularmstrong/swig/blob/master/examples/express/server.js
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
	loader: swig.loaders.fs(__dirname + '/views'),

	// TURN CACHE BACK ON in deployment environments...
	cache: false
});

// Load custom template tags
//     http://paularmstrong.github.io/swig/docs/api/#setTag
//     http://paularmstrong.github.io/swig/docs/extending/#tags
var mytags = require('./mytags');
swig.setTag(
	'url'
	, mytags.url.parse
	, mytags.url.compile
	, mytags.url.ends
);
swig.setTag(
	'comment'
	, mytags.comment.parse
	, mytags.comment.compile
	, mytags.comment.ends
);


app.locals({
	// These are provided to every template context by default
	LIBS_URL: '/public/js/'
	, BLACKHIGHLIGHTER_MEDIA_URL: '/public/'
	, PROJECT_MEDIA_URL: '/public/'
	, NODE_VERSION: process.version

	// optionals, set in your environment somewhere...
	// HOSTING_SERVICE: string
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

var common = requirejs('jquery-blackhighlighter');


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
// http://stackoverflow.com/questions/5924072/
app.use("/public/js/jquery-blackhighlighter",
	express.static(__dirname + '/jquery-blackhighlighter')
);
app.use("/public", express.static(__dirname + '/public'));


// No homepage for now, just redirect to write URL
app.get('/', function (req, res) {
	res.redirect('/write/');
});


// No online documentation for now
app.get('/docs/*', function(req, res) {
	res.send('For now, if you want to '
		+ 'learn more about this project, please visit '
		+ '<a href="http://blackhighlighter.hostilefork.com">'
		+	'hostilefork.com/blackhighlighter'
		+ '</a>');
});


// The /write/ handler is relatively simple, as document authoring happens
// entirely in JavaScript on the client's machine.  The /commit/ HTTP POST
// handler does the actual server-side work of saving the document.
app.get('/write/$', function (req, res) {
    res.render('write', {
    	MAIN_SCRIPT: "write"
    	, HOSTING_SERVICE: process.env.HOSTING_SERVICE
    	, HOSTING_SERVICE_URL: process.env.HOSTING_SERVICE_URL
    });
});


function generateHtmlFromCommitAndReveals(commit, reveals) {
	// Note: We do this on the server side rather than in JavaScript code on
	// the client for purposes of search engines, and also based on the
	// general principle that while writing and verifying a blackhighlighter
	// letter requires a JavaScript-enabled browser, reading it should not!
	// (though without the JavaScript the current page might look a bit bad,
	// this could be used for some kind of "raw" page generator as well)

	// u'\u00A0' is the non breaking space
	// ...it should be preserved in db strings via UTF8
	
	// REVIEW: for each one that has been unredacted make
	// a hovery bit so that you can get a tip on when it was made public?
	// how will auditing be done?

	// http://documentcloud.github.com/underscore/#groupBy
	var revealsByHash = _.groupBy(reveals, function(reveal) { 
		return reveal.sha256;
	});
	
	// No efficient way to do this?
	// http://stackoverflow.com/questions/1295584/
	var redactionIndexByHash = {};
	_.each(revealsByHash, function(reveal, hash) {
		redactionIndexByHash[hash] = 0;
	});
	
	var result = '';
	_.each(commit.spans, function (commitSpan) {

		if (_.isString(commitSpan)) {
			// The commits and reveals contain just ordinary text as JavaScript
			// strings, so "a < b" is legal.  But what we're making here needs
			// to be raw HTML in the template, to get the spans and divs and
			// such for the redaction in the blacked-out bits.  Hence, we have
			// to escape the text span!
			commitSpan = _.escape(commitSpan);

			// Also, line breaks must be converted to br nodes
			result += commitSpan.split('\n').join('<br />');
		} else {
			var revealGroup = revealsByHash[commitSpan.sha256]; 
			if (revealGroup) {
				var reveal = revealGroup[0];
				result += 
					'<span class="placeholder revealed" title="'
					+ commitSpan.sha256 + '">'
					+ reveal.redactions[redactionIndexByHash[commitSpan.sha256]]
					+ '</span>';

				redactionIndexByHash[commitSpan.sha256]++;
			} else {				
				var display_length = parseInt(commitSpan.display_length, 10);

				// http://stackoverflow.com/a/1877479/211160
				var placeholderString = Array(display_length + 1).join('?');
				
				// REVIEW: use hex digest as title for query, or do something
				// more clever?  e.g. we could add a method onto the element
				// or keep a sidestructure
				var placeholder = 
					'<span class="placeholder protected" title="'
					+ commitSpan.sha256 + '">'
					+ placeholderString + '</span>';

				result += placeholder;
			}
		}
	});
	return result;
}


function generateCertificateStubsFromCommit(commit) {
	
	var mapSha256ToTrue = {};
	_.each(commit.spans, function (commitSpan) {		
		if (_.isString(commitSpan)) {
			// Not redacted.
		} else {
			mapSha256ToTrue[commitSpan.sha256] = true;
		}
	});
			
	var result = [];
	_.each(mapSha256ToTrue, function(trueValue, key) {
		result.push({sha256: key});
	});
	return result;
}


function showOrVerify(req, res, tabstate) {

	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var commit_id = req.param('commit_id', null);

	Q.try(function() {

		// 1: Connect to database with authorization
		return Q.ninvoke(mongodb, 'connect', mongoConnectURI);

	}).then(function (conn) {

		// 2: Get commits and reveals collections in parallel
		return [
			Q.ninvoke(conn, 'collection', 'commits')
			, Q.ninvoke(conn, 'collection', 'reveals')
		];

	}).spread(function (commitsCollection, revealsCollection) {

		// 3: Query for specific commit and reveals objects in parallel
		//
		// REVIEW: necessary to use ObjectID conversion?
		// http://stackoverflow.com/questions/4902569/
		return [
			Q.ninvoke(
				commitsCollection, 'find'
				, {'commit_id': commit_id}
				, {limit: 1, sort:[['_id', 'ascending']]}
			)
			, Q.ninvoke(
				revealsCollection, 'find'
				, {'commit_id': commit_id}
				, {sort:[['sha256', 'ascending']]}
			)
		];

	}).spread(function (commitsCursor, revealsCursor) {

		// 4: Convert the result cursors to arrays
		return [
			Q.ninvoke(commitsCursor, 'toArray')
			, Q.ninvoke(revealsCursor, 'toArray')
		];

	}).spread(function (commitsArray, revealsArray) {

		// 5: Check the arrays for validity and extract needed data
		if (commitsArray.length == 0) {
			throw ClientError("No commit with requested _id");
		} else if (commitsArray.length > 1) {
			throw Error("Multiple commits with same _id.");
		}

		// REVIEW: is the length the only thing we need to check?
		return [commitsArray[0], revealsArray];

	}).spread(function (commit, reveals) {

		// 6: Generate response HTML
		res.render('read', {
			MAIN_SCRIPT: 'read'
			, HOSTING_SERVICE: process.env.HOSTING_SERVICE
			, HOSTING_SERVICE_URL: process.env.HOSTING_SERVICE_URL
			, commit_id: commit_id
			, all_certificates: generateCertificateStubsFromCommit(commit)
			, tabstate: tabstate
			, commit: commit
			, revealed_certificates: reveals
			, public_html: generateHtmlFromCommitAndReveals(commit, reveals)
		});

	}).catch(function (err) {

		// REVIEW: We weren't asked for JSON.  We were asked for HTML.
		// This is not the right thing to do in case of an error here!

		resSendJsonForErr(res, err);

	}).finally(function () {

		// add general cleanup code here if necessary

	}).done();
}


app.get('/v/:commit_id([0-9A-Za-z~_\-]+)$', function (req, res) {
	showOrVerify(req, res, 'verify');
});


app.get('/s/:commit_id([0-9A-Za-z~_\-]+)$', function (req, res) {
	showOrVerify(req, res, 'show');
});


app.post('/commit/$', function (req, res) {
	var requestTime = new Date();

	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var commit = JSON.parse(req.param('commit', null));	

	// We don't want to put "extra junk" in the MongoDB database, as it
	// will just store whatever objects we put in it (no schema).
	//
	// REVIEW: This seems pretty tedious, but what else can we do when
	// storing JSON from a potentially hostile/hacked client?

	// Must be an object
	if (!_.isObject(commit)) {
		throw ClientError('commit must be an object');
	}

	// Verify it doesn't have more than just "spans"
	if (!_.isEqual(_.keys(commit).sort(), ["spans"])) {
		console.log(commit.toString());
		throw ClientError('commit should have a .spans key, only');
	}

	// Spans can be either strings or objects with 2 keys
	_.each(commit.spans, function (commitSpan) {
		if (_.isString(commitSpan)) {
			return;
		}
		if (!_.isObject(commitSpan)) {
			throw ClientError('commit spans must be string or object');
		}
		if (!_.isEqual(
			_.keys(commitSpan).sort(), ["display_length", "sha256"])
		) {
			throw ClientError(
				'span objects can only have sha256 and display_length'
			);
		}
		if (!_.isNumber(commitSpan.display_length)) {
			throw ClientError('display_length must be a number');
		}
		if (!_.isString(commitSpan.sha256)) {
			throw ClientError('sha256 of span must be string');
		}
	});

	// Okay, the written content itself may be junk, but at least it's 
	// all "in-band" junk.  Start the database work...

	Q.try(function() {

		// 1: Connect to database with authorization
		return Q.ninvoke(mongodb, 'connect', mongoConnectURI);

	}).then(function (conn) {

		// 2: Get the commits collection from the database
		return Q.ninvoke(conn, 'collection', 'commits');

	}).then(function (coll) {

		// 3: Add commit to collection

		// Should we check to make sure the date in the request matches
		// so we are on the same page as the client about time?
		//
		// mongodb JS driver knows about Date()?
		// or do we need to use the .toJSON() method?
		commit.commit_date = requestTime;
		commit.commit_id = common.commitIdFromCommit(commit);
		return Q.ninvoke(coll, "insert", commit, {safe: true});

	}).then(function (records) {

		// 4. Echo the commit back with the commit_date and commit_id added

		// MongoDB stuck its own _id on there, and the client doesn't
		// need to know that.
		delete commit._id;

		// We know the async insertion actually succeeded due to {safe: true}
		res.json({
			commit: commit
		});

	}).catch(function (err) {

		resSendJsonForErr(res, err);

	}).finally(function () {

		// add general cleanup code here if necessary

	}).done();
});


app.post('/reveal/$', function (req, res) {
	var requestTime = new Date();

	// The /reveal/ HTTP POST handler once would take an array to allow you
	// to reveal more than one redaction "color" at a time.  But the current
	// main demo is only one color (black) so that would be uncommon, and
	// also it creates protocol complexity in error reporting if you were to
	// send two reveals... with one bad, and one good. 

	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var reveal = JSON.parse(req.param('reveal', null));

	// We don't want to put "extra junk" in the MongoDB database, as it
	// will just store whatever objects we put in it (no schema).
	//
	// REVIEW: This seems pretty tedious, but what else can we do when
	// storing JSON from a potentially hostile/hacked client?

	// Must be an object
	if (!_.isObject(reveal)) {
		throw ClientError('reveal must be an object');
	}

	// Verify the keyset
	// REVIEW: Should "naming" each redaction in a certificate be optional?
	if (!_.isEqual(_.keys(reveal).sort(), 
		["commit_id", "name", "redactions", "salt", "sha256"])
	) { 
		throw ClientError('reveal has extra or missing keys');
	}

	// Verify the values
	if (!_.isString(reveal.commit_id)) {
		throw ClientError('commit_id should be a string');
	}
	if (!_.isString(reveal.salt)) {
		throw ClientError('salt should be a string');
	}
	if (!_.isString(reveal.sha256)) {
		throw ClientError('sha256 should be a string');
	}
	if (!_.isString(reveal.name)) {
		throw ClientError('name should be a string');
	}
	if (!_.isArray(reveal.redactions)) {
		throw ClientError('redactions should be an array');
	}
	_.each(reveal.redactions, function (redactionSpan) {
		if (!_.isString(redactionSpan)) {
			throw ClientError('all redaction spans must be strings');
		}
	});

	// Now make sure the reveal isn't lying about its contents hash
	var actualHash = common.revealIdFromReveal(reveal);
	if (actualHash != reveal.sha256) {
		throw ClientError(
			'Actual reveal content hash is ' + actualHash
			+ ' while claimed hash is ' + reveal.sha256
		);
	}

	// Okay the reveal is "well-formed".  For more we have to start talking
	// to the database...

	var commit_id = reveal.commit_id;

	Q.try(function() {

		// 1: Connect to database with authorization
		return Q.ninvoke(mongodb, 'connect', mongoConnectURI);

	}).then(function (conn) {

		// 2: Get commits and reveals collections in parallel
		return [
			Q.ninvoke(conn, 'collection', 'commits')
			, Q.ninvoke(conn, 'collection', 'reveals')
		];

	}).spread(function (commitsCollection, revealsCollection) {

		// 3: Query for specific commit and reveals objects in parallel

		// REVIEW: necessary to use ObjectID conversion?
		// http://stackoverflow.com/questions/4902569/

		return [
			revealsCollection
			, Q.ninvoke(commitsCollection, 'find'
				, {'commit_id': commit_id}
				, {limit: 1, sort:[['_id', 'ascending']]}
			)
			, Q.ninvoke(revealsCollection, 'find' 
				, {'commit_id': commit_id}
				, {sort:[['sha256', 'ascending']]}
			)
		];

	}).spread(function (revealsCollection, commitsCursor, oldRevealsCursor) {

		// 4: Convert the result cursors to arrays
		return [
			revealsCollection
			, Q.ninvoke(commitsCursor, 'toArray')
			, Q.ninvoke(oldRevealsCursor, 'toArray')
		];

	}).spread(function (revealsCollection, commitsArray, oldRevealsArray) {

		// 5: Add new reveal if it passes verification

		// Ensure it hasn't *already* been revealed
		_.each(oldRevealsArray, function(oldReveal) {
			if (reveal.sha256 == oldReveal.sha256) {
				throw ClientError(
					"Reveal " + reveal.sha256 + " was already published."
				);
			}
		});

		// Make sure there's exactly one commit with that ID
		if (commitsArray.length == 0) {
			throw ClientError("No commit with requested _id");
		} else if (commitsArray.length > 1) {
			throw Error("Multiple commits with same _id.");
		}

		var commit = commitsArray[0];

		// Now make sure the hash matches at least one existing span hash
		// Note: Some spans are strings!  So .sha256 is not defined for them.
		var matchedSpan = null;
		_.every(commit.spans, function(span) {
			if (span.sha256 == reveal.sha256) {
				matchedSpan = span;
				// http://stackoverflow.com/a/8779920/211160
				return false;
			}
			return true;
		});
		if (!matchedSpan) {
			throw ClientError("Reveal's hash matches no span in commit.");
		}

		// mongodb JS driver knows about Date(), or do we need to use
		// the .toJSON() method?
		reveal.reveal_date = requestTime;

		// Is string matching not workable, and is it actually necessary 
		// to convert to the ObjectID BSON type to properly run the join query?
		if (false) {
			reveal.commit_id = new mongodb.DBRef(
				'commits', new mongodb.ObjectID(reveal.commit_id)
			);
		}

		return Q.ninvoke(revealsCollection, 'insert', reveal, {safe: true});

	}).then(function (insertedRecords) {

		// 6: Respond with reveal's insertion date

		// We know asynchronous insert actually succeeded due to {safe: true}
		res.json({
			reveal_date: insertedRecords[0].reveal_date
		});

	}).catch(function (err) {

		resSendJsonForErr(res, err);

	}).finally(function () {

		// add general cleanup code here if necessary

	}).done();
});



//
// START LISTENING FOR SERVER REQUESTS
//
// Once we've got all the handlers set up, we can tell Express to start
// listening for connections.
//

console.log("Listening on port " + port);
app.listen(port, host);
