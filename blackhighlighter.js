"use strict";

//
// blackhighlighter.js
// Black Highlighter main Node.JS **server-side** routines 
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
// Explanation and griping about requirejs and JS modularization in general:
//
//     http://blog.hostilefork.com/sharing-code-client-server-nodejs/
//

var requirejs = require('requirejs');

requirejs.config({
    // Use node's special variable __dirname to
    // get the directory containing this file.
    // Useful if building a library that will
    // be used in node but does not require the
    // use of node outside
    // https://github.com/jrburke/requirejs/issues/150

    baseUrl: __dirname,

    // Pass the top-level main.js/index.js require
    // function to requirejs so that node modules
    // are loaded relative to the top-level JS file.

    nodeRequire: require,
    
    // Note: do not include the '.js' at the end of these paths!

    paths: {
        'jquery-blackhighlighter':
            'jquery-blackhighlighter/jquery-blackhighlighter',

        // http://stackoverflow.com/q/22471822

        'jquery': 'jquery-fake'
    }
});


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



//
// COMMON ROUTINES BETWEEN CLIENT AND SERVER
//
// In order to reduce the total number of files that clients need to use, the
// common code between the client and server lives inside the jquery widget.
// Since the server doesn't use jQuery, a "fake" jQuery is used instead.
//

var common = requirejs('jquery-blackhighlighter');

// http://blog.hostilefork.com/error-handling-internal-badrequest-node/

exports.ClientError = common.ClientError;



//
// UTILITY LIBRARIES
//

// http://blog.hostilefork.com/underscore-use-with-node-jquery/

var _ = require('underscore')._;


// Q Promises library
//
// https://github.com/kriskowal/q
// http://stackoverflow.com/questions/22138759/

var Q = require('q');



//
// CONFIGURATION
//
// Should be improved with something like the jQuery $.extend mechanism.
// Not sure what things besides the database will wind up going in here.
//

var configuration = {
    /* MONGO_CONNECT_URI: ... */
};

exports.configure = function (config) {
    configuration = config;
}



//
// DIRECTORY FOR STATIC FILES JQUERY-BLACKHIGHLIGHTER
//

exports.pathForJqueryBlackhighlighter = function () {
    return __dirname + '/jquery-blackhighlighter';
}



//
// COMMITTING
//

function throwIfCommitIsMalformed (commit) {
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
}

exports.makeCommitments = function (commit_array, callback) {
    var requestTime = new Date();

    if (
        !_.isArray(commit_array) || !commit_array.length
    ) {
        throw ClientError(
            'commit_array should be a non-empty array'
        );
    }

    _.each(commit_array, function (commit) {
        // We don't want to allow clients to slip "extra junk" into the MongoDB
        // database, as it will just store whatever JSON blobs we ask to
        // put in it (no schema).

        throwIfCommitIsMalformed(commit);

        // Calculate commit_id from the content hashed with the timestamp.

        commit.commit_date = requestTime;
        commit.commit_id = common.commitIdFromCommit(commit);
    });

    // Okay, the written content itself may be junk, but at least it's 
    // all "in-band" junk.  Start the database work...

    var result = null;

    Q.try(function() {
        // 1: Connect to database with authorization

        return Q.ninvoke(mongodb, 'connect', configuration.mongoConnectURI);
    })
    .then(function (conn) {
        // 2: Get the commits collection from the database

        return Q.ninvoke(conn, 'collection', 'commits');
    })
    .then(function (coll) {
        // 3: Add commits to collection

        // There is no transactionality in MongoDB, so when we insert an array
        // of JS objects it doesn't guarantee us all will succeed or fail.
        // We can ask to stop on the first failure, though.
        //
        // https://github.com/hostilefork/blackhighlighter/issues/52

        return Q.ninvoke(coll, "insert", commit_array, {safe: true});
    })
    .then(function (result) {
        // 4. Success (via .then), so give commit_ids and times to the client

        // We know the async insertion actually succeeded due to {safe: true}

        var commit_id_and_date_array = [];
        _.each(commit_array, function (commit) {
            // Note: MongoDB stuck its own _id on there, and the client
            // doesn't need to know about that; it's not a hash so not suitable
            // for our ID purposes.

            // We guarantee this output will be in the same order as the array
            // used for input, so it can be lined up and verified by client

            commit_id_and_date_array.push({
                'commit_id': commit.commit_id,
                'commit_date': commit.commit_date
            });
        });

        callback(null, {
            'commit_id_and_date_array': commit_id_and_date_array
        });
    })
    .catch(function (err) {
        callback(err);
    })
    .finally(function () {
        // add general cleanup code here if necessary
    })
    .done();
}



//
// READING
//

exports.generateHtmlFromCommitAndReveals = function (commit, reveal_array) {
    return common.generateHtmlFromCommitAndReveals(commit, reveal_array);
}


exports.getCommitsWithReveals = function (commit_id_array, callback) {
    Q.try(function () {
        // 1: Connect to database with authorization

        return Q.ninvoke(mongodb, 'connect', configuration.mongoConnectURI);
    })
    .then(function (conn) {
        // 2: Get commits and reveals collections in parallel

        return [
            Q.ninvoke(conn, 'collection', 'commits')
            , Q.ninvoke(conn, 'collection', 'reveals')
        ];
    })
    .spread(function (commitsCollection, revealsCollection) {
        // 3: Query for specific commits and reveals objects in parallel

        // We want to batch these up, so use $or:
        // http://mongodb.github.io/node-mongodb-native/markdown-docs/queries.html

        var orList = [];
        _.each(commit_id_array, function (commit_id) {
            orList.push({'commit_id': commit_id});
        });

        return [
            Q.ninvoke(
                commitsCollection,
                'find'
                , {$or: orList}
                , {sort:[['_id', 'ascending']]}
            )
            , Q.ninvoke(
                revealsCollection
                , 'find'
                , {$or: orList}
                , {sort:[['sha256', 'ascending']]}
            )
        ];
    })
    .spread(function (commitsCursor, revealsCursor) {
        // 4: Convert the result cursors to arrays

        return [
            Q.ninvoke(commitsCursor, 'toArray')
            , Q.ninvoke(revealsCursor, 'toArray')
        ];
    })
    .spread(function (commitsArray, revealsArray) {
        // 5: Check the arrays for validity and formulate results

        // REVIEW: is the length the only thing we need to check?

        if (commitsArray.length < commit_id_array.length) {
            throw ClientError("Request for non-existent commit_id.");
        } else if (commitsArray.length > commit_id_array.length) {
            throw Error("Multiple commits with same _id found.");
        }

        // The result we return is an array of objects, which have a
        // "commit" and "reveals" field.  If there were no reveals, then
        // the reveals will be an empty array.

        var revealsByCommitId = _.groupBy(revealsArray, 'commit_id');

        var commits_and_reveals = [];
        _.each(commitsArray, function(commit) {
            // http://stackoverflow.com/questions/4035232/

            var revealsForCommit = revealsByCommitId[commit.commit_id];

            _.each(revealsForCommit, function(reveal) {
                // https://github.com/hostilefork/blackhighlighter/issues/48

                if (!('commit_id' in reveal)) {
                    throw Error('commit_id expected in server-side reveal');
                }
                delete reveal['commit_id'];

                if (!('_id' in reveal)) {
                    throw Error('_id expected in server-side reveal');
                }
                delete reveal['_id'];
            });

            commits_and_reveals.push({
                'commit': commit,
                'reveals': revealsForCommit != null
                    ? revealsForCommit
                    : []
            });
        });

        callback(null, commits_and_reveals);
    })
    .catch(function (err) {
        callback(err);
    })
    .finally(function () {
        // add general cleanup code here if necessary
    })
    .done();
};



//
// REVEALING
//

function throwIfRevealIsMalformedOrLying (reveal) {
    // REVIEW: This seems pretty tedious, but what else can we do when
    // storing JSON from a potentially hostile/hacked client?

    if (!_.isObject(reveal)) {
        throw ClientError('all reveals must be objects');
    }

    if (!_.isEqual(_.keys(reveal).sort(), 
        ["salt", "sha256", "value"])
    ) { 
        throw ClientError('reveal has extra or missing keys');
    }

    if (!_.isString(reveal.salt)) {
        throw ClientError('reveal salt should be a string');
    }

    if (!_.isString(reveal.sha256)) {
        throw ClientError('reveal sha256 should be a string');
    }

    if (!_.isString(reveal.value)) {
        throw ClientError('reveal value should be a string');
    }

    // Now make sure the reveal isn't lying about its contents hash

    var actualHash = common.hashOfReveal(reveal);

    if (actualHash != reveal.sha256) {
        throw ClientError(
            'Actual redaction hash is ' + actualHash
            + ' while claimed hash is ' + reveal.sha256
        );
    }
}


exports.revealSecrets = function (commit_id_with_reveals_array, callback) {
    var requestTime = new Date();

    // We don't want to put "extra junk" in the MongoDB database, as it
    // will just store whatever objects we put in it (no schema).

    if (
        !_.isArray(commit_id_with_reveals_array)
        || !commit_id_with_reveals_array.length
    ) {
        throw ClientError(
            'commit_id_with_reveals_array should be a non-empty array'
        );
    }

    _.each(commit_id_with_reveals_array, function (commit_id_with_reveals) {

        if (!_.isEqual(_.keys(commit_id_with_reveals).sort(), 
            ["commit_id", "reveal_array"])
        ) { 
            throw ClientError(
                'commit_id_with_reveals has extra or missing keys'
            );
        }

        if (!_.isString(commit_id_with_reveals.commit_id)) {
            throw ClientError('commit_id should be a string');
        }

        if (
            !_.isArray(commit_id_with_reveals.reveal_array)
            || !commit_id_with_reveals.reveal_array.length
        ) {
            throw ClientError('reveal_array should be a non-empty array');
        }

        _.each(commit_id_with_reveals.reveal_array, function (reveal) {
            // Check the reveal contents, including that it hashes to
            // what the claim is.

            throwIfRevealIsMalformedOrLying(reveal);
        });
    });

    // Okay the certificate is "well-formed".  For more we have to start
    // talking to the database...

    Q.try(function() {
        // 1: Connect to database with authorization

        return Q.ninvoke(mongodb, 'connect', configuration.mongoConnectURI);
    })
    .then(function (conn) {
        // 2: Get commits and reveals collections in parallel

        return [
            Q.ninvoke(conn, 'collection', 'commits')
            , Q.ninvoke(conn, 'collection', 'reveals')
        ];
    })
    .spread(function (commitsCollection, revealsCollection) {
        // 3: Query for specific commit and reveals objects in parallel

        // We want to batch these up, so use $or:
        // http://mongodb.github.io/node-mongodb-native/markdown-docs/queries.html

        var orList = [];
        _.each(commit_id_with_reveals_array, function (commit_id_with_reveals) {
            orList.push({'commit_id': commit_id_with_reveals.commit_id});
        });

        // REVIEW: necessary to use ObjectID conversion?
        // http://stackoverflow.com/questions/4902569/

        return [
            revealsCollection
            , Q.ninvoke(
                commitsCollection
                , 'find'
                , {$or: orList}
                , {limit: 1, sort:[['_id', 'ascending']]}
            )
            , Q.ninvoke(
                revealsCollection
                , 'find' 
                , {$or: orList}
                , {sort:[['sha256', 'ascending']]}
            )
        ];
    })
    .spread(function (revealsCollection, commitsCursor, oldRevealsCursor) {
        // 4: Convert the result cursors to arrays

        return [
            revealsCollection
            , Q.ninvoke(commitsCursor, 'toArray')
            , Q.ninvoke(oldRevealsCursor, 'toArray')
        ];
    })
    .spread(function (revealsCollection, commitsArray, oldRevealsArray) {
        // 5: Add new reveals if they pass verification

        // Make sure we got as many commits back as we asked for.  Note that
        // this will not be true if you used the same commit_id twice in the
        // same request rather than grouping those reveals under a single
        // commit_id...which might be useful, but this check may help make
        // sure the client meant to do that.

        if (commitsArray.length < commit_id_with_reveals_array.length) {
            throw ClientError("Not all commit_ids found (or not all unique)");
        }
        else if (commitsArray.length > commit_id_with_reveals_array.length) {
            throw Error("Multiple commits with same _id.");
        }

        var commitsById = _.groupBy(commitsArray, function(commit) {
            return commit.commit_id;
        });

        _.each(commitsById, function(value) {
            if (value.length !== 1) {
                throw Error("More than one commit with same ID on server.");
            }
        }); 

        // Now verify the reveals for the redacted portions against the hash
        // values we stored at the time of commit.

        var newRevealsArray = [];

        _.each(commit_id_with_reveals_array, function (commit_id_with_reveals) {

            _.each(commit_id_with_reveals.reveal_array, function(reveal) {

                // Ensure the redaction hasn't *already* been revealed

                _.each(oldRevealsArray, function(oldReveal) {
                    if (reveal.sha256 == oldReveal.sha256) {
                        throw ClientError(
                            "Redaction " + reveal.sha256 + " was already published."
                        );
                    }
                });

                // Make sure the hash matches an existing hash in the commit
                // Note: Some spans are strings!  .sha256 is not defined for them.

                var matchedSpan = null;
                var commit = commitsById[commit_id_with_reveals.commit_id][0];

                _.every(commit.spans, function(span) {
                    if (span.sha256 == reveal.sha256) {
                        matchedSpan = span;

                        // http://stackoverflow.com/a/8779920/211160

                        return false;
                    }
                    return true;
                });

                if (!matchedSpan) {
                    throw ClientError("A reveal hash matched no span in commit.");
                }

                // we need to poke the commit_id into the reveal so that the
                // database can connect them to the commit in our query
                
                reveal.commit_id = commit.commit_id;
                reveal.reveal_date = requestTime;

                newRevealsArray.push(reveal);
            });
        });

        return Q.ninvoke(
            revealsCollection, 'insert', newRevealsArray, {safe: true}
        );
    })
    .then(function (insertedRecords) {
        // 6: Respond with reveal's insertion date

        // We know asynchronous insert actually succeeded due to {safe: true}

        callback(null, {
            reveal_date: insertedRecords[0].reveal_date
        });
    })
    .catch(function (err) {
        callback(err);
    })
    .finally(function () {
        // add general cleanup code here if necessary
    })
    .done();
};
