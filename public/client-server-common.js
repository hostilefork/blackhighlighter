//
// client-server-common.js - Common JavaScript for node server & browser
// Copyright (C) 2009 HostileFork.com
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


// The module standard being used is the "asynchronous module definition"
//     https://github.com/amdjs/amdjs-api/wiki/AMD
define(['use!underscore', 'use!sha256'], function(_, SHA256){
    return {
		
		// URL api
		makeCommitUrl: function(base_url) {
			return base_url + 'commit/';
		},
		makeVerifyUrl: function(base_url, commit_id) {
			return base_url + 'verify/' + commit_id;
		},
		makeShowUrl: function(base_url, commit_id) {
			return base_url + 'show/' + commit_id;
		},
		makeRevealUrl: function(base_url) {
			return base_url + 'reveal/';
		},
		
		// 
		// UUID
		// http://en.wikipedia.org/wiki/UUID
		//

		generateRandomUUID: function() {
			// 128 bits of random data is the size of a Uuid
			// http://bytes.com/groups/javascript/523253-how-create-Uuid-javascript

			function fourHex(count) {
				if (count === 0) {
					return '';
				}
				
				// if count is null or undefined, assume 1
				var ret = '';
				for (var index = 0; index < (count ? count : 1); index++) {
					ret += (((1+Math.random()) * 0x10000)|0).toString(16).substring(1); 
				}
				return ret;
			}

			return (fourHex(2)+'-'+fourHex()+'-'+fourHex()+'-'+fourHex()+'-'+fourHex(3));
		},

		stripHyphensFromUUID: function(uuid) {
			// standard Uuid format contains hyphens to improve readability
			// freebase and other systems that use Uuids in URLs don't have the hyphens
			
			return uuid.replace(/-/g, '');
		},


		//
		// TYPE DETECTION
		//
		// REVIEW: Use better approaches?  Something like this?
		// 	http://mattsnider.com/javascript/type-detection/
		// 	http://mattsnider.com/core/type-detection-revisited/
		//

		isWhitespace: function(charToCheck) {
			// http://www.somacon.com/p355.php
			
			var whitespaceChars = ' \t\n\r\f\u00A0'; // added non-breaking space
			return (whitespaceChars.indexOf(charToCheck) != -1);
		},

		//
		// JAVASCRIPT HELPERS
		//

		escapeNonBreakingSpacesInString: function(str) {
			// UNICODE \u00A0 is not escaped by JSON.stringify

			var nbspSplit = str.split('\u00A0');
			if (nbspSplit.length == 1) {
				return str;
			}
			var ret = nbspSplit[0];
			for (var nbspSplitIndex = 1; nbspSplitIndex < nbspSplit.length; nbspSplitIndex++) {
				ret += '\\' + 'u00A0';
				ret += nbspSplit[nbspSplitIndex];
			}
			return ret;
		},

		// http://www.somacon.com/p355.php
		trimLeadingWhitespace: function(str) { 
			var k = 0;
			while ((k < str.length) && this.isWhitespace(str.charAt(k))) {
				k++;
			}
			return str.substring(k, str.length);
		},
		
		trimTrailingWhitespace: function(str) {
			var j = str.length-1;
			while ((j >= 0) && this.isWhitespace(str.charAt(j))) {
				j--;
			}
			return str.substring(0, j + 1);
		},
		
		trimAllWhitespace: function(str) {
			return this.trimLeadingWhitespace(this.trimTrailingWhitespace(str));
		},


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
		// 		{ "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
		// 		" PublicThree ",
		//		{ "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" }, 
		//		" PublicFour"
		//	] }
		//
		// We must be able to check that the server doesn't change the content of the
		// commit out from under you.  Additionally, a client who only has been 
		// given a URL needs to be able to do this check.  That means the URL must
		// encode enough information to test an unrevealed commit.  To do this, we
		// make a cryptographic hash of a string made by appending together the
		// spans along with the commit_date.
		//
		// (Note: Because letters without redactions do not have reveal certificates,
		// the only thing differentiating two unredacted letters is the commit_date.
		// Hence the client cannot know the actual URL until after the server has
		// decided the commit time.)
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
		
		canonicalJsonFromCommit: function(commit) {
			// There are some things to consider here regarding Unicode Normalization
			// and canonical JSON: http://wiki.laptop.org/go/Canonical_JSON
			
			// In general, having a dependency on a library that may change (like
			// how escaping of strings is done by JSON.stringify) could cause false
			// negatives.  These could be investigated after the fact and rectified
			// against a correct answer.
			// REVIEW: Discuss this with peers to make sure there's no risk of false
			// positives, and see if there are better ways to avoid false negatives.
			
			var result = '{"commit_date":';
			result += JSON.stringify(commit.commit_date);
			result += ',';

			var isFirstSpan = true;			
			result += '"spans":[';
			_.each(commit.spans, function(span) {
				if (isFirstSpan) {
					isFirstSpan = false;
				} else {
					result += ',';
				}
				if (_.isString(span)) {
					// We want to turn single quotes into \", etc.
					// for our canonical representation
					result += JSON.stringify(span);
				} else {
					result += '["display_length":';
					result += span.display_length.toString(10);
					result += ',';
					result += '"sha256":';
					result += JSON.stringify(span.sha256);
					result += ']';
				}
			});
			result += ']}';
			return result;
		},
		
		makeIdFromCommit: function(commit) {
			return SHA256(this.canonicalJsonFromCommit(commit));
		}
    };
});