"use strict";

//
// app.js
// Server-side code for the black Highlighter demo sandbox 
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
// UTILITY LIBRARIES
//

// Underscore contains common JavaScript helpers like you might find in a
// library like jQuery (forEach, isString, etc)...but without being tied
// into the presumption that you are running in a browser with a DOM, etc.
//
// http://documentcloud.github.com/underscore/
var _ = require('underscore')._;



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

	if (err instanceof blackhighlighter.ClientError) {
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


// These are provided to every template context by default
app.locals.LIBS_URL = '/public/js/';
app.locals.BLACKHIGHLIGHTER_MEDIA_URL = '/public/';
app.locals.PROJECT_MEDIA_URL = '/public/';
app.locals.NODE_VERSION = process.version;

// optionals, set in your environment somewhere...
/* app.locals.HOSTING_SERVICE: "string"; */


//
// BLACKHIGHLIGHTER COMPONENT
//
// The Black Highlighter logic for doing commits, reveals, and storing
// information in the database is put in its own component.  Although
// you could conceivably run it as a server on its own, some services
// charge per-node-instance.  This way you can just hook the routines
// in with everything else.
// 
var blackhighlighter = require('./blackhighlighter');
blackhighlighter.configure({
	mongoConnectURI: process.env.MONGO_CONNECT_URI
    	// http://docs.mongodb.org/manual/reference/default-mongodb-port/
    	|| "mongodb://localhost:27017"
});



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
    res.render('home', {
    	MAIN_SCRIPT: "home"
    	, HOSTING_SERVICE: process.env.HOSTING_SERVICE
    	, HOSTING_SERVICE_URL: process.env.HOSTING_SERVICE_URL
    });
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


function showOrVerify(req, res, tabstate) {

	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var commit_id = req.param('commit_id', null);

	blackhighlighter.getCommitAndReveals(commit_id, function(err, commit, reveals) {
		if (err) {
			// REVIEW: We weren't asked for JSON.  We were asked for HTML.
			// This is not the right thing to do in case of an error here!
			resSendJsonForErr(res, err);
		} else {
			res.render('read', {
				MAIN_SCRIPT: 'read'
				, HOSTING_SERVICE: process.env.HOSTING_SERVICE
				, HOSTING_SERVICE_URL: process.env.HOSTING_SERVICE_URL
				, commit_id: commit_id
				, all_certificates:
					blackhighlighter.generateCertificateStubsFromCommit(commit)
				, tabstate: tabstate
				, commit: commit
				, revealed_certificates: reveals
				, public_html:
					blackhighlighter.generateHtmlFromCommitAndReveals(
						commit,
						reveals
					)
			});
		}
	});
}


app.get('/v/:commit_id([0-9A-Za-z~_\-]+)$', function (req, res) {
	showOrVerify(req, res, 'verify');
});


app.get('/s/:commit_id([0-9A-Za-z~_\-]+)$', function (req, res) {
	showOrVerify(req, res, 'show');
});


app.post('/commit/$', function (req, res) {
	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var commit = JSON.parse(req.param('commit', null));	

	blackhighlighter.makeCommitment(commit, function(err, json) {
		if (err) {
			resSendJsonForErr(res, err);
		} else {
			res.json(json);
		}
	});
});


app.post('/reveal/$', function (req, res) {
	// The /reveal/ HTTP POST handler once would take an array to allow you
	// to reveal more than one redaction "color" at a time.  But the current
	// main demo is only one color (black) so that would be uncommon, and
	// also it creates protocol complexity in error reporting if you were to
	// send two reveals... with one bad, and one good. 

	// Difference between req.param and req.params:
	// http://stackoverflow.com/a/9243020/211160
	var commit_id = req.param('commit_id');
	var revealsArray = JSON.parse(req.param('reveals', null));

	blackhighlighter.revealSecret(
		commit_id, revealsArray,
		function(err, json) {
			if (err) {
				resSendJsonForErr(res, err);
			} else {
				res.json(json);
			}
		}
	);
});



//
// START LISTENING FOR SERVER REQUESTS
//
// Once we've got all the handlers set up, we can tell Express to start
// listening for connections.
//

console.log("Listening on port " + port);
app.listen(port, host);
