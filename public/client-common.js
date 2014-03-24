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
//   See http://blackhighlighter.hostilefork.com for documentation.
//

// Whole-script strict mode syntax
"use strict";

// The module standard being used is the "asynchronous module definition"
//     https://github.com/amdjs/amdjs-api/wiki/AMD
define(['jquery', 'underscore'], function($, _){
    return {
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

		// http://stackoverflow.com/a/12463110/211160
		//
		getHiddenHeightForWidth: function(element, width) {
		    var $temp = $(element).clone()
		 		.css('position','absolute')
		   		.css('height','auto').css('width', width + 'px')
		  	  	// inject right into parent element so all the css applies
		  	  	// (yes, i know, except the :first-child and other pseudo stuff
			    .appendTo($(element).parent())
			    .css('left','-10000em')
			    .show();

		    h = $temp.height();
		    $temp.remove();
		    return h;
		},

		resizeListener: function(event) {
			// We want some leading text before the boxes containing data, but we
			// want them to be the same size.  We can get their height by default
			// and then style them to have the height of the maximum of any of them.

			var $leads = $('#tabs > div.tabs-content div.leading-section');

			$leads.css('height', 'auto');

			var maxHeight = undefined;

			$leads.each(function(idx, el) {
				var $el = $(el);
				var hiddenHeight = $el.actual('height');
				if (!maxHeight) {
					maxHeight = hiddenHeight;
				} else {
					if (hiddenHeight > maxHeight) {
						maxHeight = hiddenHeight;
					}
				}
			});

	    	$leads.height(maxHeight);
	    }
	}
});