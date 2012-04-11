//
// common.js - Common JavaScript helpers for all blackhighlighter code
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


//
// DOM
// http://en.wikipedia.org/wiki/Document_Object_Model
//

if (!window.Node) {
	// Better to use these constants than test against "magic numbers"
	// http://safalra.com/web-design/javascript/dom-node-type-constants/
	var Node = {
		ELEMENT_NODE: 1,
		ATTRIBUTE_NODE: 2,
		TEXT_NODE: 3,
		CDATA_SECTION_NODE: 4,
		ENTITY_REFERENCE_NODE: 5,
		ENTITY_NODE: 6,
		PROCESSING_INSTRUCTION_NODE: 7,
		COMMENT_NODE: 8,
		DOCUMENT_NODE: 9,
		DOCUMENT_TYPE_NODE: 10,
		DOCUMENT_FRAGMENT_NODE: 11,
		NOTATION_NODE: 12
	};
}

function outerXHTML($source) {
	// I don't understand why, if I have an element like <div><p>Foo</p></div>, it's
	// so much more interesting to get the innerXHTML ("<p>Foo</p>") than the outerXHTML
	// ("<div><p>Foo</p></div>").

	var ret = '';
	// create a temporary parent
	var tempParent = $('<span title="outerXHTML() temporary wrapper"></span>');
	
	if ($source.parentNode === null) {
		tempParent.append($source);
		ret = innerXHTML(tempParent.get(0));
		$($source).remove();
	} else {
		tempParent.append($($source).clone());
		ret = innerXHTML(tempParent.get(0));
	}
	
	return ret;
}

function absoluteFromRelativeURL(url) {
	// http://objectmix.com/javascript/352627-relative-url-absolute-url.html

	return $('<a href="' + url + '"></a>').get(0).href;
}


// 
// UUID
// http://en.wikipedia.org/wiki/UUID
//

function generateRandomUUID() {
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
}

function stripHyphensFromUUID(uuid) {
	// standard Uuid format contains hyphens to improve readability
	// freebase and other systems that use Uuids in URLs don't have the hyphens
	
	return uuid.replace(/-/g, '');
}


//
// TYPE DETECTION
//
// REVIEW: Use better approaches?  Something like this?
// 	http://mattsnider.com/javascript/type-detection/
// 	http://mattsnider.com/core/type-detection-revisited/
//

function isWhitespace(charToCheck) {
	// http://www.somacon.com/p355.php
	
	var whitespaceChars = ' \t\n\r\f\u00A0'; // added non-breaking space
	return (whitespaceChars.indexOf(charToCheck) != -1);
}

function isString(obj) {
	// http://www.planetpdf.com/developer/article.asp?ContentID=testing_for_object_types_in_ja
	// Return a boolean value telling whether the first argument is a string. 

	if (typeof obj == 'string') {
		return true;
	}
		
	if (typeof obj == 'object') {
		var criterion = obj.constructor.toString().match(/string/i); 
		return (criterion !== null);
	}
	return false;
}

function isArray(obj) {
	// http://www.bram.us/2008/02/01/javascript-isarray-check-if-an-elementobject-is-an-array/

	return obj.constructor == Array;
}

function isBoolean(obj) {
	return (obj === true) || (obj === false);
}

function isUndefined(obj) {
	// http://quomon.com/question-how-to-check-if-a-javascript-variable-is-defined-891.aspx
	return typeof(obj) == 'undefined';
}


//
// JAVASCRIPT HELPERS
//

function keysForObject(obj, inheritPrototypeKeys) {
	// simply return the keys inside of an object, no order.  So:
	//
	// {'f': foo, 'b': bar, 'm': mumble}
	//
	// would become:
	//
	// ['f', 'b', 'm']
	
	var keys = [];
	for (var key in obj) {
		// http://yuiblog.com/blog/2006/09/26/for-in-intrigue/
		if (inheritPrototypeKeys || obj.hasOwnProperty(key)) {
			keys.push(key);
		}
	}
	return keys;
}

function dropObjectKeysToMakeSortedArray(obj) {
	// for a key/value based object, drop the keys and make a flat array
	// the order of the array will be the order of the keys!  So if you had:
	//
	// {'f': foo, 'b': bar, 'm': mumble}
	//
	// You would end up with an array like:
	//
	// [bar, foo, mumble]

	var keysSorted = keysForObject(obj).sort();
	var ret = [];	
	for (var keyIndex = 0; keyIndex < keysSorted.length; keyIndex++) {
		ret.push(obj[keysSorted[keyIndex]]);
	}

	return ret;
}

function escapeNonBreakingSpacesInString(str) {
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
}

// http://www.somacon.com/p355.php
function trimLeadingWhitespace(str) { 
	var k = 0;
	while ((k < str.length) && isWhitespace(str.charAt(k))) {
		k++;
	}
	return str.substring(k, str.length);
}
function trimTrailingWhitespace(str) {
	var j = str.length-1;
	while ((j >= 0) && isWhitespace(str.charAt(j))) {
		j--;
	}
	return str.substring(0, j + 1);
}
function trimAllWhitespace(str) {
	return trimLeadingWhitespace(trimTrailingWhitespace(str));
}

// Equality semantics vary by object, but this works for simple cases
// http://stackoverflow.com/questions/201183/how-do-you-determine-equality-for-two-javascript-objects/302451
function objectEquals(obj1, obj2) {
    for (var i1 in obj1) {
        if (obj1.hasOwnProperty(i1)) {
            if (!obj2.hasOwnProperty(i1)) { return false; }
            if (obj1[i1] != obj2[i1]) { return false; }
        }
    }
    for (var i2 in obj2) {
        if (obj2.hasOwnProperty(i2)) {
            if (!obj1.hasOwnProperty(i2)) { return false; }
            if (obj1[i2] != obj2[i2]) { return false; }
        }
    }
    return true;
}


//
// SELECTIONS
//

function highlightAllOfElement(elm) {
	// http://www.codingforums.com/archive/index.php/t-105808.html

	if (window.getSelection) {
		var selection = window.getSelection();
		if (selection.setBaseAndExtent) { // for Safari
			// slight mod for 4th param needed to ensure all text in div selected
			// http://lists.apple.com/archives/dashboard-dev/2005/May/msg00212.html
			selection.setBaseAndExtent(elm, 0, elm, elm.innerText.length - 1);
		} else { // for FF, Opera, or IE with ierange W3C compatibility module
			selection.removeAllRanges();			
			try { 
				var rangeW3C = document.createRange();
				rangeW3C.selectNodeContents(elm);
				selection.addRange(rangeW3C);
			} catch(err) {
				// REVIEW: at time of writing ierange had not been patched for this issue
				// http://code.google.com/p/ierange/issues/detail?id=5
				// Hence we catch the exception and revert to the IE way of selecting
				// if the above code crashes
				var rangeWorkaround = document.body.createTextRange();
				rangeWorkaround.moveToElementText(elm);
				rangeWorkaround.select();
			}
		}
	} else { // for IE without ierange W3C compatibility module
		var rangeIE = document.body.createTextRange();
		rangeIE.moveToElementText(elm);
		rangeIE.select();
	}
}

function clearUserSelection() {
	// http://www.webmasterworld.com/javascript/3074874.htm
	
	if (window.getSelection) {
		window.getSelection().removeAllRanges();
	} else if (document.selection) {
		document.selection.empty();
	}
}