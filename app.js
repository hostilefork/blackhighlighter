//
// app.js - blackhighlighter main Node.JS server-side application code 
// Copyright (C) 2012 HostileFork.com
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


// If any paths do not start with a slash or a dot used by a require
// this says where the files should be searched for...
// This seems to anger node.js locally but is required by the cloud
require.paths.unshift('./node_modules');


//
// UTILITY LIBRARIES
//

// http://documentcloud.github.com/underscore/
var _ = require('underscore')._;

// Is it worth it to convert to the "Step" form in order to make
// the asynchronous code read more cleanly?
//
//  https://github.com/creationix/step



// 
// BASIC HTTP SETUP
//
// The Virtual Cloud tells us our port and host, but if we are running
// locally we default to localhost and port 3000.
//

var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
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

if (process.env.VCAP_SERVICES) {
	var env = JSON.parse(process.env.VCAP_SERVICES);
	var mongo = env['mongodb-1.8'][0]['credentials'];
} else {
	var mongo = {
		"hostname":"localhost",
		"port":27017,
		"username":"",
		"password":"", 
		"name":"",
		"db":""
	}
}

var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'test');

	if(obj.username && obj.password) {
		return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
	} else {
		return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
	}
}

var mongourl = generate_mongo_url(mongo);

var mongodb = require('mongodb');

// How to deal with internally-generated exceptions and errors, as 
// well as exceptions thrown by library code?
//     http://stackoverflow.com/questions/5816436/error-handling-in-asynchroneous-node-js-calls
function handleMongoDbError(res, err) {
	if (err) {
		console.log("MongoDb error: " + JSON.stringify(err));			
		res.json({errortype: 'mongodb', errordata: err});
		throw "MongoDB error";
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
var app = express.createServer();
var swig = require('swig');

// Register the template engine
app.register('.html', swig);
app.set('view engine', 'html');

// Initialize Swig, for full list of options see:
//     https://github.com/paularmstrong/swig/blob/master/docs/getting-started.md#init
swig.init({
	// Set the view directory
	// NOTE: There's also app.set('views', ...); but that didn't seem to work
	root: __dirname + '/views',
	
	allowErrors: true,

	// See mytags.js for why this requirement is necessary
	tags: require('./mytags')
});

app.set('view options', {
	// Make sure you aren't using Express's built-in "layout extending".
	// This was commented out in the GitHub for Swig's Express example,
	// but it seems to be necessary to get the {% block %} inheritance
	// to work at all!
	layout: false,
	
	// These are provided to every template context by default
	LIBS_URL: '/public/js/',
	BLACKHIGHLIGHTER_MEDIA_URL: '/public/',
	PROJECT_MEDIA_URL: '/public/'
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
// DATA FORMAT NOTES
//
// "PublicOne PublicTwo [RedactedOne] PublicThree [RedactedTwo] PublicFour"
//
// The commit looks like this, and when put into the database it will have
// added to it a MongoDB _id as well as a commit_date
// 
// { "spans": [
//		"PublicOne PublicTwo ", 
// 		{ "displayLength": "11", "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
// 		" PublicThree ",
//		{ "displayLength": "11", "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" }, 
//		" PublicFour"
//	] }
//
// A single revealJson looks like this, and when put into the database it will
// have added to it a mongodb _id as well as a commit_date
//
// { "commit_id": "4f89521b67032a424a000002",
//		"redactions": [ "RedactedOne", "RedactedTwo" ], 
//		"salt": "26716853c86b247fc81834822b0ca058",
//		"sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce"
// }
//
// (Note: Hash values are made up, will fix in real documentation.)
//
// The /reveal/ HTTP POST handler historically accepted an array of reveals,
// because there was no selective UI for picking which reveals that had been
// locally entered were to be shown.
//



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

// The /write/ handler is relatively simple, as document authoring happens
// entirely in JavaScript on the client's machine.  The /commit/ HTTP POST
// handler does the actual server-side work of saving the document.
app.get('/write/$', function (req, res) {
    res.render('write', {});
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
				var displayLength = parseInt(commitSpan.displayLength, 10);
				var placeholderString = '';
				for (var fillIndex = 0; fillIndex < displayLength; fillIndex++) {
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

function showOrVerify(req, res, tabstate) {
	
	// Connect to the database with authorization
	mongodb.connect(mongourl, function(err, conn) {	
		handleMongoDbError(res, err);

		// we dispatch two separate queries, and since the code is
		// single-threaded we just check to run our handler only
		// if we have both the commit and the reveals back
		var commit = undefined;
		var reveals = undefined;
		
		function weHaveTheCommitAndReveals() {
			res.render('read', {
				commit_id: req.params.commit_id,
				revealsDb: [],
				tabstate: tabstate,
				commit: commit,
				reveals: reveals,
				public_html: generateHtmlFromCommitAndReveals(commit, reveals)
			});
		}
				
		conn.collection('commits', function(err, coll) {
			handleMongoDbError(res, err);
			
			// http://stackoverflow.com/questions/4902569/node-js-mongodb-select-document-by-id-node-mongodb-native
			coll.find({'_id': new mongodb.ObjectID(req.params.commit_id)}, {limit: 1, sort:[['_id', 'ascending']]}, function(err, cursor) {
				handleMongoDbError(res, err);
			
				cursor.toArray(function(err, items) {
					handleMongoDbError(res, err);

					if (items.length == 0) {
						// NOTE: Raise a 404 if the letter ID isn't found in the database?
						throw "No commit with requested _id";
					} else if (items.length > 1) {
						// NOTE: Commits should be unique, that is enforced by the DB?
						throw "Multiple commits with same _id.";
					} else {
						commit = items[0];
					}
					
					if (reveals !== undefined) {
						weHaveTheCommitAndReveals();
					}					
				});
			});
		});
		
		conn.collection('reveals', function(err, coll) {
			handleMongoDbError(res, err);
			
			// http://stackoverflow.com/questions/4902569/node-js-mongodb-select-document-by-id-node-mongodb-native
			coll.find({'commit_id': req.params.commit_id}, {sort:[['sha256', 'ascending']]}, function(err, cursor) {
				handleMongoDbError(res, err);
			
				cursor.toArray(function(err, items) {
					handleMongoDbError(res, err);

					reveals = items;
					
					if (commit !== undefined) {
						weHaveTheCommitAndReveals();
					}					
				});
			});
		});
	});
}

app.get('/verify/:commit_id([0-9a-f]+)/$', function (req, res) {
	showOrVerify(req, res, 'verify');
});

app.get('/show/:commit_id([0-9a-f]+)/$', function (req, res) {
	showOrVerify(req, res, 'show');
});

app.post('/commit/$', function (req, res) {

	// second parameter is default
	var commit = JSON.parse(req.param('commit', null));

	// We should verify that what we've been given fits the proper form for
	// a commit, and doesn't have extra garbage being stored in the database.
	// At the moment I'm just "trusting" that a well formed commit was given
	// to us, which turns us into a generic JSON object store.
	
	// should we check to make sure the date in the request matches so we are on
	// the same page as the client?	

	// http://www.robertprice.co.uk/robblog/archive/2011/5/JavaScript_Date_Time_And_Node_js.shtml
	var now = new Date();
	// mongodb JS driver knows about Date() or do we need to use the .toJSON() method?
	commit.commit_date = now; 

	// Connect to the database with authorization
	mongodb.connect(mongourl, function(err, conn){
		handleMongoDbError(res, err);
		
		conn.collection('commits', function(err, coll){
			handleMongoDbError(res, err);

			// Insert the object and then respond with a json object providing
			// the show and verify URLs
			coll.insert(commit, {safe:true}, function(err, records) {
				handleMongoDbError(res, err);
				
				res.json({
					commit_id: records[0]._id, 
					show_url: '/show/' + records[0]._id + '/',
					verify_url: '/verify/' + records[0]._id + '/'
				});				
			});
		});
	});
});

app.post('/reveal/$', function (req, res) {

	var reveals = JSON.parse(req.param('reveals', null));  // second parameter is default

	// should we check to make sure the date in the request matches so we are on
	// the same page as the client?	

	// http://www.robertprice.co.uk/robblog/archive/2011/5/JavaScript_Date_Time_And_Node_js.shtml
	var now = new Date();

	// The reveal process needs to check to make sure the certificate is valid before
	// adding it to the reveal database.  Ideally this code would be shared with the
	// code in the client.  For the moment I'm less concerned about that issue than
	// figuring out how MongoDB works with Node.js so trying to close the query loop
	// first...
	// Connect to the database with authorization
	require('mongodb').connect(mongourl, function(err, conn){
		handleMongoDbError(res, err);

		conn.collection('reveals', function(err, coll){
			handleMongoDbError(res, err);
			
			var insertionCount = 0;
			
			_.each(reveals, function(reveal) {
				// mongodb JS driver knows about Date() or do we need to use the .toJSON() method?
				reveal.reveal_date = now;
				
				// Is string matching not workable, and is it actually necessary 
				// to convert to the ObjectID BSON type to properly run the join query?
				/* reveal.commit_id = new mongodb.DBRef('commits', new mongodb.ObjectID(reveal.commit_id)); */
			});
								
			coll.insert(reveals, {safe:true}, function(err) {
				handleMongoDbError(res, err);
					
				res.json({
					insertion_count: reveals.length
				});
			});
		});
	});
});



//
// START LISTENING FOR SERVER REQUESTS
//
// Once we've got all the handlers set up, we can tell Express to start listening
// for connections.
//

app.listen(port, host);