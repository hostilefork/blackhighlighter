//
// test/all.js
// Copyright (C) 2009-2014 HostileFork.com
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
            '../jquery-blackhighlighter/jquery-blackhighlighter',

        // http://stackoverflow.com/q/22471822

        'jquery': '../jquery-fake'
    }
});



//
// COMMON ROUTINES BETWEEN CLIENT AND SERVER
//
// In order to reduce the total number of files that clients need to use, the
// common code between the client and server lives inside the jquery widget.
// Since the server doesn't use jQuery, a "fake" jQuery is used instead.
//

var common = requirejs('jquery-blackhighlighter');


// DATA FORMAT NOTES
//
// See http://blackhighlighter.hostilefork.com
// "PublicOne PublicTwo [HiddenOne] PublicThree [HiddenTwo] PublicFour"
//
// The commit looks like this, and when put into the database it will
// have added to it a MongoDB _id as well as a commit_date
//
// { "spans": [
//      "PublicOne PublicTwo ",
//      { "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
//      " PublicThree ",
//      { "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
//      " PublicFour"
//  ] }
//
// We must be able to check that the server doesn't change the content
// of the commit out from under you.  Additionally, a client who *only*
// has been given a URL needs to be able to do this check.  That means
// the URL must encode enough information to test an unrevealed commit.
// To do this, we make a cryptographic hash of a string made by
// appending together the spans along with the commit_date.
//
// (Note: Because letters without redactions do not have reveal
// certificates, the only thing differentiating two unredacted letters
// is the commit_date.  Hence the client cannot know the actual URL
// until after the server has decided the commit time.)
//
// A single revealJson looks like this, and when put into the database
// it will have added to it a mongodb _id as well as a commit_date
//
// {
//     "commit_id": "4f89521b67032a424a000002",
//     "reveals": [
//          [
//              value: "HiddenOne",
//              salt: "26716853c86b247fc81834822b0ca058",
//              sha256: "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce"
//          ], [
//              value: "HiddenTwo",
//              salt: "26716853c86b247fc81834822b0ca058",
//              sha256: "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce"
//          ]
//      ]
// }
//
// (Note: Hash values are made up, will fix in real documentation.)


// using assert passed to the test function that just logs failures
exports['test that logs all failures'] = function(assert) {

    assert.equal(1 + 1, 2, 'sanity check: 1 + 1 != 2');

    var commit = {
        "spans": [
            "PublicOne PublicTwo ",
            {
                "display_length": 9,
                "sha256": "mnh3vSg3bL6xcPKCXFpBqwtMGZbnxktreEAZ9iGx85o~"
            },
            " PublicThree ",
            {
                "display_length": 9,
                "sha256": "mFCATQsSgt5ZK0SfR4Zmka8s2wmYFD0y-_5ZTiM4YfA~"
            },
            " PublicFour\n" 
        ],
        "commit_date" : "2014-07-28T15:04:57.172Z"
    };

    // REVIEW: this is the certificate; make certificate checking a test
    // that can be done independent of widget
    var certificate =
"ewogImNvbW1pdF9pZCI6ICJ1Q0tvc3dDYlpWU3dtWjJyS2lOSlFLckdEYlp5RVc1UjIwSnVkUXY5" +
"TW93fiIsCiAicmV2ZWFscyI6IFsKICB7CiAgICJ2YWx1ZSI6ICJIaWRkZW5PbmUiLAogICAic2Fs" +
"dCI6ICI4NDQ4M2FhMzkxYTUwMmRlZDBiYWFkNDY0YmI4ZTkwOCIsCiAgICJzaGEyNTYiOiAibW5o" +
"M3ZTZzNiTDZ4Y1BLQ1hGcEJxd3RNR1pibnhrdHJlRUFaOWlHeDg1b34iCiAgfSwKICB7CiAgICJ2" +
"YWx1ZSI6ICJIaWRkZW5Ud28iLAogICAic2FsdCI6ICI5OTI0NDM5ZDU0MzA0OTBhOGE0MzBjYzAz" +
"YjRkZDZiYiIsCiAgICJzaGEyNTYiOiAibUZDQVRRc1NndDVaSzBTZlI0Wm1rYThzMndtWUZEMHkt" +
"XzVaVGlNNFlmQX4iCiAgfQogXQp9";

/* END BLACKHIGHLIGHTER CERTIFICATE */

    assert.equal(
        common.commitIdFromCommit(commit),
        "uCKoswCbZVSwmZ2rKiNJQKrGDbZyEW5R20JudQv9Mow~",
        'commit ID invariance test'
    );
}


if (module == require.main) {
    require('test').run(exports);
}
