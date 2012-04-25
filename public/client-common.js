//
// client-common.js - Common JavaScript helpers for in-browser code
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
	window.Node = {
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

// The module standard being used is the "asynchronous module definition"
//     https://github.com/amdjs/amdjs-api/wiki/AMD
define(['jquery', 'use!underscore'], function($, _){
    return {

		outerXHTML: function($source) {
			// I don't understand why, if I have an element like <div><p>Foo</p></div>, it's
			// so much more interesting to get the innerXHTML ("<p>Foo</p>") than the outerXHTML
			// ("<div><p>Foo</p></div>").

			var ret = '';
			// create a temporary parent
			var tempParent = $('<span title="outerXHTML() temporary wrapper"></span>');
			
			if ($source.parentNode === null) {
				tempParent.append($source);
				ret = innerXHTML(tempParent.get(0));
				$source.remove();
			} else {
				tempParent.append($source.clone());
				ret = innerXHTML(tempParent.get(0));
			}
			
			return ret;
		},

		absoluteFromRelativeURL: function(url) {
			// http://objectmix.com/javascript/352627-relative-url-absolute-url.html

			return $('<a href="' + url + '"></a>').get(0).href;
		},



		//
		// SELECTIONS
		//

		highlightAllOfElement: function(elm) {
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
		},

		clearUserSelection: function() {
			// http://www.webmasterworld.com/javascript/3074874.htm
			
			if (window.getSelection) {
				window.getSelection().removeAllRanges();
			} else if (document.selection) {
				document.selection.empty();
			}
		}
	}
});