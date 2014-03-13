//
// write.js - blackhighlighter supplemental javascript for composing letters.
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

// REVIEW: http://stackoverflow.com/questions/10302724/calling-methods-in-requirejs-modules-from-html-elements-such-as-onclick-handlers
var BlackhighlighterWrite = {};

// Main script file, brings page to life in $(document).onload handler
define([
	'jquery',
	'use!underscore',
	'client-server-common',
	'client-common',
	// these libs have no results, purely additive...
	'jqueryui',
	'sha256', // http://www.webtoolkit.info/javascript-sha256.html,
	'json2',
	'expanding'
], function($, _, common, clientCommon) {

	var Globals = {
		commitObj: undefined,
		protectedObjs: undefined,
		commit_id: undefined,
		successfulCommit: false,
		lastTabId: 'tabs-compose' // we start on compose tab, and don't get a select notification for it
	};

	// Theme all the button-type-things but not the <a href="#" ..> style
	$("input:submit, button").button();

	// Make all the indeterminate progress bars animate.  They're hidden.
	$(".indeterminate-progress").progressbar({value: false});

	// jquery UI does tabs by index, not ID.  using this to increase readability
	function tabIndexForId(id) {
		return {
			'tabs-compose': 0,
			'tabs-protect': 1,
			'tabs-commit': 2}[id];
	}
	
	function notifyErrorOnTab(tab, msg) {
		$('#error-' + tab + '-msg').text(msg);
		$('#error-' + tab).show();
	}
	
	function clearErrorOnTab(tab) {
		$('#error-' + tab).hide();
	}
	
	clearErrorOnTab('commit');

	
	// We seem to get empty text nodes for some reason, at least in Firefox
	// Jquery is not good at dealing with text nodes so best to use DOM to kill them
	// REVIEW: Why are these showing up?  Is it this?
	// http://markmail.org/message/uuoieaafwn6h6gxz
	// http://reference.sitepoint.com/javascript/Node/normalize
	function killEmptyTextNodesRecursivePreorder(node) {
		// http://www.jslab.dk/articles/non.recursive.preorder.traversal.part2
		if ((node.nodeType == Node.TEXT_NODE) && (node.data === "")) {
			$(node).remove();
		} else {
			for (var childIndex = 0; childIndex < node.childNodes.length; childIndex++) {
				killEmptyTextNodesRecursivePreorder(node.childNodes[childIndex]);
			}
		}
	}
	
	function notNormalized(node) {
		var lastWasTextNode = false;
		for (var childIndex = 0; childIndex < node.childNodes.length; childIndex++) {
			var child = node.childNodes[childIndex];
			var nodeType = _.isUndefined(node.nodeType) ? Node.ATTRIBUTE_NODE : node.nodeType;
			if (nodeType == Node.TEXT_NODE) {
				if (lastWasTextNode) {
					return true;
				}
				lastWasTextNode = true;
			} else {
				lastWasTextNode = false;
			}
		}
	}

	function normalizeProtectionsInSubtree(elm) {
		// Normalize protected spans so that ones sitting adjacent to each other
		// are unified into a single protected span
		var deleteSpans = [];
		$(elm).find('span').filter('.protected').each(function(i) {
			// REVIEW: short circuit if this is in deleteSpans?
			
			var current = this.nextSibling;
			while ((current !== null) && (current.nodeType == Node.ELEMENT_NODE) &&
					(current.tagName.toLowerCase() == 'span') && $(current).hasClass('protected')) {
				$(current).contents().remove().appendTo(this);
				this.normalize();
				deleteSpans.push(current);
				current = current.nextSibling;
			}
		});
		for (var deleteSpanIndex = 0; deleteSpanIndex < deleteSpans.length; deleteSpanIndex++) {
			$(deleteSpans[deleteSpanIndex]).remove();
		}
	}
	
	// Dynamic onclick methods...
	// http://www.webdeveloper.com/forum/archive/index.php/t-33159.html
	BlackhighlighterWrite.doUnprotectOrTakeSuggestion = function(protectedEl) {
		if (protectedEl.hasClass('protected-readwrite')) {
			return false;
		}

		clientCommon.clearUserSelection();
		
		if (protectedEl.hasClass("suggested-protection")) {
			protectedEl.removeClass("suggested-protection");
			protectedEl.addClass("protected");
			protectedEl.addClass("protected-readonly");
			normalizeProtectionsInSubtree(protectedEl.parent());
			return true;
		}
	
		var parent = protectedEl.parent();
		
		// http://www.exampledepot.com/egs/org.w3c.dom/MergeText.html
		// except getFirstChildNode is not cross-browser
		
		// Move all children of the element in front of the element
		protectedEl.contents().remove().insertBefore(protectedEl);

		// Remove the element
		protectedEl.remove();

		// Merge all text nodes under the parent
		parent.get(0).normalize();
		
		killEmptyTextNodesRecursivePreorder(parent.get(0));

		Globals.commitObj = undefined;
		Globals.protectedObjs = undefined;

		updateJsonCommitPreviewIfNecessary();

		return true;
	};
	var doUnprotectOrTakeSuggestion_callback = function() {
		return BlackhighlighterWrite.doUnprotectOrTakeSuggestion($(this));
	};
	
	
	function doProtect() {
		
		// This hack is necessary because the IE compatibility layer for W3C ranges
		// returns nulls at times nicEdit did not expect.  I'm not very confident that
		// the existing invariants were correct in any case, but this works around
		// the crashes.
		// (selElm can't handle "null" ranges, but tests startContainer, so given a
		// startContainer of null we can keep things going...)

		function getRng () {
			var nullRange = {
					'toString': function() { return "";},
					'startContainer': null, 
					'endContainer': null, 
					'parentElement': function() { return null;},
					'note': 'This is a FAKE RANGE, see nicEditorPatches.js getRng()'
			};
			var s = window.getSelection();
			if(s === null) {
				return nullRange;
			}
				
			if (s.rangeCount > 0) {
				var rangeAt = s.getRangeAt(0);
				if (rangeAt === null) {
					return nullRange;
				}
				return rangeAt;
			}

			var rangeNew = null;
			if('createRange' in s) {
				rangeNew = s.createRange();
			}
			if (rangeNew === null) {
				return nullRange;
			}
			
			return rangeNew;
		}

		// We depend on this compatibility layer:
		// http://code.google.com/p/ierange/
		var range = getRng();
		if (range && (range.toString() !== '')) {
						
			// we extract the contents which removes them from the editor.
			// REVIEW: cloneContents() instead?
			// http://www.phpied.com/replace-selected-text-firefox/
			var fragment = $(range.extractContents());
		
			// find all protected or suggested-protection spans in the range and replace them with their contents
			// NOTE: find() does not seem to work on document fragments, see post
			// http://groups.google.com/group/jquery-en/browse_thread/thread/c942018ff571b135/
			// http://docs.jquery.com/Selectors/multiple#selector1selector2selectorN
			fragment.children().filter('span').filter('.protected,.suggested-protection').each(function(i) {
				var parentOfThis = this.parentNode;
				$(this).replaceWith($(this).contents());
				// We must normalize so that adjacent TextNodes get merged together
				// NOTE: IE6 and 7 document fragments can't be normalized!
				// http://reference.sitepoint.com/javascript/DocumentFragment
				// we must defer the normalization until after the insertion below
				/* parentOfThis.normalize(); */
			});
			
			var protectedEl = $('<span class="protected protected-readonly"></span>');
			protectedEl.append(fragment.contents());
			protectedEl.get(0).normalize();
			protectedEl.click(doUnprotectOrTakeSuggestion_callback);
			
			range.insertNode(protectedEl.get(0));
	
			protectionAreaEl = $("#editor-protect").get(0);

			killEmptyTextNodesRecursivePreorder(protectionAreaEl);

			normalizeProtectionsInSubtree(protectionAreaEl);
			
			// we must unselect the selection, or the XORing will make it look
			// bad and not all blacked out
			// http://www.webreference.com/js/column12/selectionobject.html
			clientCommon.clearUserSelection();

			updateJsonCommitPreviewIfNecessary();
		}
		
		Globals.commitObj = undefined;
		Globals.protectedObjs = undefined;
	}

	// Bring tabs to life.
	$('#tabs').tabs();

	// Disable tabs that we're not ready for
	$('#tabs').tabs('disable', tabIndexForId('tabs-commit'));	

	// Selection changes are finalized by selected, or mouseup?  What do
	// we really want to capture here?
	$("#editor-protect").mouseup(doProtect);
	
	// NOTE: 		
	// http://bytes.com/groups/javascript/484582-setattribute-versus-assigning-property
	/* setAttribute('contentEditable','false'); */

	$('#editor-compose').focus();

	function addProtectSuggestions(node) {
	
		var lastPushWasText = false;
		// re-interleave the splits and matches...which goes first depends on whether
		// the match was at the first position.
		
		function pushSuggestSpan(str) {
			var suggestSpan = $('<span class="suggested-protection">' + str + '</span>');
			suggestSpan.click(doUnprotectOrTakeSuggestion_callback);
			$(node).before(suggestSpan);
			lastPushWasText = false;
		}

		function pushTextNode(str) {
			if (lastPushWasText) {
				throw "Pushed two text nodes in a row, need normalization for that.";
			}
			if (str !== '') {
				$(node).before(document.createTextNode(str));
				lastPushWasText = true;
			}
		}

		// This is just a simple demonstration of the concept that the editor could be looking for
		// things you might want to protect and suggest them for you.  Sophisticated searches
		// (such as identifying people's names) would probably want to be server-side instead 
		// of JavaScript, but this should be a server on your local network.
	
		var nodeType = _.isUndefined(node.nodeType) ? Node.ATTRIBUTE_NODE : node.nodeType;

		// search all textnodes that aren't under protected spans
		switch (nodeType) {
			case Node.TEXT_NODE:
				// REVIEW:  for some reason, while debugging in firebug the first assignment
				// in this case statement evaluates to nodeType instead of node.data.  Why?
				var dummyAssignmentToWorkaroundFirefoxBug = node.data;
				var strData = node.data; // this assignment seems to always work (?)
				
				// http://development.thatoneplace.net/2008/05/bug-discovered-in-internet-explorer-7.html
				/* var regexEmail = /[0-9a-zA-Z]+@[0-9a-zA-Z]+[\.]{1}[0-9a-zA-Z]+[\.]?[0-9a-zA-Z]+/g; */
				// using /g option does a global search
				var regexEmail = /[0-9a-zA-Z]+@[0-9a-zA-Z]+[\.][0-9a-zA-Z]+[\.]?[0-9a-zA-Z]+/g;
				var firstMatchPos = strData.search(regexEmail);
				if (firstMatchPos == -1) {
					break; // no matches, leave node alone
				}
								
				var splitArray = strData.split(regexEmail);

				// NOTE: Inconsistent cross-browser behavior led me to switch from RegExp.exec()
				// to using String.match() -- sometimes exec() did not reset the lastIndex 
				// for the next time this procedure is called (Firefox) and in IE there were
				// even weirder problems where the first call would return null but the second
				// would not (even with regexEmail.lastIndex = 0).
				regexEmail.lastIndex = 0; // reset lastIndex so we find first match again
				var matchArray = strData.match(regexEmail);
				
				var matchIndex = 0;
				var splitIndex = 0;
				// internet explorer does not return empty spans at start and end of match
				// array, so we can prune them off for firefox...
				if (splitArray[0] === '') {
					splitIndex++;
				}
					
				while ((matchIndex < matchArray.length) && (splitIndex < splitArray.length)) {
					if (firstMatchPos == 0) {
						pushSuggestSpan(matchArray[matchIndex++]);
						pushTextNode(splitArray[splitIndex++]);
					} else {
						pushTextNode(splitArray[splitIndex++]);
						pushSuggestSpan(matchArray[matchIndex++]);
					}
				} 

				if (firstMatchPos === 0) {
					if (matchIndex < matchArray.length) {
						pushSuggestSpan(matchArray[matchIndex++]);
					}
				} else {
					if (splitIndex < splitArray.length) {
						pushTextNode(splitArray[splitIndex++]);
					}
				}

				if ((splitIndex != splitArray.length) || (matchIndex != matchArray.length)) {
					throw "Unreachable condition in regular expression matcher for addProtectSuggestions.";
				}
				
				$(node).remove();
				break;
			case Node.ELEMENT_NODE:
				if ((node.tagName.toLowerCase() != 'span') || (!$(node).hasClass('protected'))) {
					var child = node.firstChild;
					while (child) {
						var next = child.nextSibling;
						addProtectSuggestions(child);
						child = next;
					}
				}
				break;
			default:
				break;
		}
	}
	
	
	function removeProtectSuggestions(node) {
		var replaceWithContents = [];
		$(node).find('span').filter('.suggested-protection').each(function(i) {
			replaceWithContents.push($(this));
		});
		for (var replaceIndex = 0; replaceIndex < replaceWithContents.length; replaceIndex++) {
			var parent = replaceWithContents[replaceIndex].parent();
			replaceWithContents[replaceIndex].replaceWith(replaceWithContents[replaceIndex].contents().remove());
			parent.get(0).normalize();
		}
	}

	function cloneContenteditableAsCanon(div, keepFunctions) {
		var divCopy = div.clone(keepFunctions);

		// While HTML may collapse all whitespace as not being visually
		// significant, we treat it as such.  If whitespace is not &nbsp;
		// we have to collapse it in the text nodes.
		//
		// http://stackoverflow.com/a/4399718/211160
		//
		var getTextNodesIn = function(el) {
			return $(el).find(":not(iframe)").addBack().contents().filter(function() {
				return this.nodeType == 3;
			});
		};
		getTextNodesIn(divCopy).each(function(idx, el) {
			// http://stackoverflow.com/questions/7635952/ 
			var str = el.nodeValue;
			str = str.replace(/\s+/g, " ");
			str = str.replace(/^\s+|\s+$/g, "");
			// should we also do something with zero-no-width joiners?
			el.nodeValue = str;
		});

		// First canonize all the <p> tags for browsers that make them into
		// <div> instead. As you might expect, an easy thing to change is hard;
		// tags on elements can't change without disrupting content.  :-/
		//
		// Note we lose any attributes that may have been attached to the
		// paragraph.  As we're going for canon, that's not a bad thing in
		// this case...in fact we should probably strip *more* information off!
		//
		// http://stackoverflow.com/a/1695200/211160
		//
		divCopy.find("p").each(function(idx, el) {
			var oldP = $(el);
			var newDiv = $('<div></div>');
			oldP.before(newDiv);
			newDiv.append(oldP.contents());
			oldP.remove();
		});

		// Due to wacky behavior of the ::selection pseudoclass, a custom
		// selection color will not apply to any *empty space* that crosses
		// line breaks.  This looks ugly.  There are other reasons for
		// canonizing the input so there are only <div></div> sections
		// with no <br> (simplifies later processing), so it's worth
		// doing regardless of this quirk.
		
		// It's hard to canonize any arbitrary input here, because you can't
		// (for instance) blindly transform all <div>foo</div> into foo<br>.
		// So this is an attempt to "make it work".  A common pattern in the
		// contenteditable I've seen is to kick off the process with something
		// not in a div, with things after that put into divs...which causes
		// a break similar to as if it was in a div.  So we can account for
		// that one.
		if (
			(divCopy.contents().length >= 2)
			&& (!divCopy.contents().eq(0).is("div"))
			&& (divCopy.contents().eq(1).is("div"))
		) {
			divCopy.contents().eq(0).wrapAll("<div></div>");
		}

		// After that let's flatten, and hope for the best.
		divCopy.find("div").each(function(idx, el) {
			var $el = $(el);
			// Flatten by putting content before, break after, and remove
			if (($el.contents().length == 1) && ($el.contents().first().is("br"))) {
				$el.after($('<br>'));
				$el.remove();
			} else {
	 			$el.after($('<br>'));
				$el.before($el.contents());
				$el.remove();
			}
		});

		// Now we recover the structure adapting code from StackOverflow
		// 
		// http://stackoverflow.com/q/18494385/211160
		//
		var $contents = divCopy.contents();
		var $cur, $set, i;
		$set = $();
		if ($contents.length > 1) {
			for (i = 0; i < $contents.length; i++) {
				$cur = $contents.eq(i);

				if ($cur.is("br")) {
					if ($set.length > 0) {
						$set.wrapAll("<div></div>");
						$cur.remove();
					} else {
						// An actual line break.  Wrap in a span so that we
						// don't have content as a direct child of the
						// contenteditble (causes ugly selection UI)
						$cur.replaceWith($('<div class="zwnj-spacing-hack">&zwnj;</div>'));
					}
					$set = $();
				} else {
					$set = $set.add($cur);
				}
			}
			$set.wrapAll("<div></div>");
		}

		return divCopy;
	}
	
	function cloneCanonAsContenteditable(div, keepFunctions) {
		var divCopy = div.clone(keepFunctions);

		// One simple way to decanonize is just to leave the first element
		// outside of a div, with all the successive elements keeping their
		// divs and wrapping actual breaks in divs.  This is what webkit
		// seems to do, and if it weren't for the selection stuff I'd have
		// left it be.
		//
		// If only custom selection color wasn't so aesthetically fickle :-/
		//
		divCopy.children().each(function(idx, el) {
			$el = $(el);
			if ($el.is("div") && (idx == 0)) {
				$el.before($el.contents());
				$el.remove();
			} else if ($el.is("div") && $el.hasClass("zwnj-spacing-hack")) {
				$el.html($('<br>'));
				$el.removeClass("zwnj-spacing-hack");
			}
			// Just leave it otherwise.
		});

		return divCopy;
	}

	function syncEditors() {
		if (Globals.lastTabId == 'tabs-protect') {

			// get any protections and copy to the compose editor
			// NOTE: "true" parameter to clone preserves functions attached to elements
			var divProtectCopy = cloneCanonAsContenteditable($("#editor-protect"), true);
			divProtectCopy.find('span').filter('.protected').each(function(i){
				$(this).removeClass('protected-readonly').addClass('protected-readwrite');
			});
			removeProtectSuggestions(divProtectCopy.get(0));
			$("#editor-compose").empty().append(divProtectCopy.contents());
			return true;
		} else if (Globals.lastTabId == 'tabs-compose') {
			// get any modifications to the letter and copy to the protected text
			// NOTE: "true" parameter to clone preserves functions attached to elements
			var divComposeCopy = cloneContenteditableAsCanon($("#editor-compose"), true);
			divComposeCopy.find('span').filter('.protected').each(function(i){
				$(this).removeClass('protected-readwrite').addClass('protected-readonly');
			});
			
			// REVIEW: IE has a "feature" where it will always turn things that
			// look like hyperlinks or email addresses into anchors.  Seems
			// you can't turn it off.
			//
			//   http://drupal.org/node/191644
			//
			// Removing all anchors is okay at this point, since we're not
			// allowing the user to deliberately insert anchors...
			var replaceWithContents = [];
			divComposeCopy.find('a').each(function(i) {
				replaceWithContents.push(this);
			});
			_.each(replaceWithContents, function(replaceMe) {
				var parentOfReplace = replaceMe.parentNode;
				$(replaceMe).replaceWith($(replaceMe).contents());
				parentOfReplace.normalize();
				if (notNormalized(parentOfReplace)) {
					throw "Normalization failure trying to fix contenteditable.";
				}
			})

			addProtectSuggestions(divComposeCopy.get(0));
			$("#editor-protect").empty().append(divComposeCopy.contents());
			return true;
		}

		// assume in sync
		return false;
	}
	

	function generateCommitAndProtectedObjects() {
		var $publicAndProtected = $("#editor-protect");
		removeProtectSuggestions($publicAndProtected.get(0));

		Globals.commitObj = {
			'spans': []
		};
		
		Globals.protectedObjs = undefined;
		
		var revealsByName = {};
		var placeholders = [];
		var mergeableLineBreakPending = false;
		var redactionOrder = 1;

		// Before the canonization, this process used to be more complex.
		// It can most likely be simplified now since there are no uses of
		// "mergeable line breaks"
		function processChild(child) {
			function pushStringSpan(stringSpan) {
				if (!_.isString(stringSpan)) {
					throw 'Pushing non-string as string span';
				}
				if (stringSpan.length === 0) {
					throw 'Pushing zero length string span';
				}
				
				handleMergeableLineBreaks();

				var numSpans = Globals.commitObj.spans.length;
						
				if ((numSpans > 0) && _.isString(Globals.commitObj.spans[numSpans-1])) {
					Globals.commitObj.spans[numSpans-1] += stringSpan;
				} else {
					Globals.commitObj.spans.push(stringSpan);
				}
			}
			
			function pushPlaceholderSpan(placeholder) {
				if (_.isUndefined(placeholder.display_length)) {
					throw 'Invalid placeholder pushed';
				}
				handleMergeableLineBreaks();
				Globals.commitObj.spans.push(placeholder);	
			}
			
			function handleMergeableLineBreaks() {
				if (mergeableLineBreakPending) {
					mergeableLineBreakPending = false;
					pushStringSpan('\n');
				}	
			}
			
			function pushMergeableLineBreak() {
				mergeableLineBreakPending = true;
			}
			
			function pushUnmergeableLineBreak() {
				mergeableLineBreakPending = false;
				pushStringSpan('\n');
			}
			
			function revealNameForSpan(span) {
				// The server supports multiple reveals per letter, but currently there's no
				// good interface for this... so we just have a single reveal name.  We'd
				// have to sniff the color of the redaction region or some other property
				// that was added during the marking....
				return 'black';
			}
			
			var nodeType = _.isUndefined(child.nodeType) ? Node.ATTRIBUTE_NODE : child.nodeType;
			
			// https://developer.mozilla.org/en/Case_Sensitivity_in_class_and_id_Names 
			var tagNameLowerCase = _.isUndefined(child.tagName) ? undefined : child.tagName.toLowerCase(); 
			
			switch (nodeType) {
				case Node.ELEMENT_NODE:
					if ((tagNameLowerCase == 'span') && $(child).hasClass('protected')) {
						// Each protected span adds a placeholder to the commit and a redaction to
						// the reveal certificate
						
						// Since the div in which editing happened was contenteditable
						// HTML, it will be representing < as &lt; inside a text node.
						// Consequently, we must unescape it before putting it into
						// a certificate.  The server will escape it back when it
						// generates HTML.
						var content = _.unescape($(child).html());

						if (content.length === 0) {
							throw "Zero length redaction found, illegal";
						}
							
						var revealName = revealNameForSpan(child);

						var reveal = revealsByName[revealName];
						if (_.isUndefined(reveal)) {
							reveal = {
								'redactions': [],
								'name': revealName
							};
							revealsByName[revealName] = reveal;
						}
						
						// http://www.javascripter.net/faq/convert3.htm
						// we track the order but do not put it into the commit or reveal as it is implicit
						var placeholder = {
							'display_length': content.length
						};
						placeholders.push({
							'obj': placeholder,
							'reveal': reveal,
							'order': redactionOrder
						});

						reveal.redactions.push(content);
						redactionOrder++;
						
						pushPlaceholderSpan(placeholder);
					} else {
						switch (tagNameLowerCase) {
							case 'br': {
								throw "Canonized contenteditable had stray <br> tag";
							}
							break;
							
							case 'p': {
								throw "Canonized contenteditable had <p> tag";
								// Though Firefox doesn't seem to inject paragraphs each time you press
								// enter, Opera does.  We translate these into two newlines.
								pushMergeableLineBreak();
								$(child).contents().each(function(i) { processChild(this); });
								pushMergeableLineBreak();
							}
							break;

							case 'div': {
								if ($(child).hasClass("zwnj-spacing-hack")) {
									// We canonize our contenteditable to put this odd char
									// only in an empty <div>.  It's enough to get the div
									// to space out, seemingly...and we'll just try and
									// make sure none of these are in the input code to
									// start with.
									pushUnmergeableLineBreak();
								} else {
									$(child).contents().each(function(i) { processChild(this); });
									pushUnmergeableLineBreak();
								}
							}
							break;
							
							default: {
								// REVIEW: it is technically possible to pass HTML inside of the strings
								// however that opens a can of worms so we just do UTF8 JSON strings
								if (true) {
									throw 'Rich text and HTML instructions not currently supported for security reasons: <' + child.tagName + '>';
								} else {
									pushStringSpan(clientCommon.outerXHTML(child));
								}
							}
						}
					}
					break;
					
				case Node.TEXT_NODE:
					// REVIEW: JSON.stringify seems not to escape \u00A0.  This is a problem because 
					// it looks just like a space to the user's clipboard, and so we lose it when the
					// user copies and pastes.  This will apply to other invisible unicode characters
					// too... but hopefully they're taken care of inside JSON.stringify (?)
					pushStringSpan(child.data);
					break;
					
				default:
					throw 'Unexpected node in XHTML produced by getElmCloneClean()';
			}
		}

		$publicAndProtected.contents().each(function(i){
			processChild(this);			
		});

		var revealsByHash = {};

		for (var revealNameToHash in revealsByName) {
			if (revealsByName.hasOwnProperty(revealNameToHash)) {
				var revealObjToHash = revealsByName[revealNameToHash];
				var saltToHash = common.stripHyphensFromUUID(common.generateRandomUUID());
				var contents = saltToHash;
				for (var redactionIndex = 0; redactionIndex < revealObjToHash.redactions.length; redactionIndex++) {
					contents += revealObjToHash.redactions[redactionIndex];
				}
				
				revealObjToHash.salt = saltToHash;
				revealObjToHash.sha256 = SHA256(contents);
				
				revealsByHash[revealObjToHash.sha256] = revealObjToHash;
			}
		}

		for (var placeholderToFinalizeIndex = 0; placeholderToFinalizeIndex < placeholders.length; placeholderToFinalizeIndex++) {
			var placeholderToFinalizeObj = placeholders[placeholderToFinalizeIndex].obj;
			var placeholderReveal = placeholders[placeholderToFinalizeIndex].reveal;
			var placeholderOrder = placeholders[placeholderToFinalizeIndex].order;

			// Due to large random salt, hash is a unique ID for the reveal
			placeholderToFinalizeObj.sha256 = placeholderReveal.sha256;
		}
		
		// Check that process did not produce two sequential string spans in commit
		var lastWasString = false;
		for (var commitCheckIndex = 0; commitCheckIndex < Globals.commitObj.spans.length; commitCheckIndex++) {
			if (_.isString(Globals.commitObj.spans[commitCheckIndex])) {
				if (lastWasString) {
					throw "Two sequential string spans in commit -- error in generateCommitAndProtectedObjects()"; 
				}
				lastWasString = true;
			} else {
				lastWasString = false;
			}
		}
		
		// If the commit is effectively empty, set the commit object to null
		if (Globals.commitObj.spans.length === 0) {
			Globals.commitObj = null;
		} else if (Globals.commitObj.spans.length == 1) {
			if (_.isString(Globals.commitObj.spans[0]) && (common.trimAllWhitespace(Globals.commitObj.spans[0]) === '')) {
				Globals.commitObj = null;
			}	
		}

		// Protected objects is an array for JSON, not a map
		// REVIEW: This used to be done sorted by hash, which underscore doesn't do.
		// Does it matter?  (Certificates should sort by name, if anything.)
		Globals.protectedObjs = _.values(revealsByHash);
	}

	$('#commit-json-accordion').accordion({
		collapsible: true,
		active: false, /* only collapsible accordions can be fully closed */

		// autoHeight doesn't seem to work by itself; mumbo-jumbo needed
		// http://stackoverflow.com/a/15413662/211160
		heightStyle: "content",
		autoHeight: false,
		clearStyle: true
	});

	// For performance reasons, it isn't good to update the JSON preview of
	// the commit on every redact/unredact.  But if you have the JSON accordion
	// open, you probably want to see it changing and are willing to pay for
	// the slower performance.  If it's closed you don't pay for it.
	function updateJsonCommitPreviewIfNecessary() {
		// can't just test for false if collapsed, since 0 is false!
		if ($('#commit-json-accordion').accordion('option', 'active') == 0) {
			$('#json-commit').empty();			
			if (_.isUndefined(Globals.commitObj) || _.isUndefined(Globals.protectedObjs)) {
				generateCommitAndProtectedObjects();
			}
			if (Globals.commitObj) {
				$('#json-commit').text(
					common.escapeNonBreakingSpacesInString(
						JSON.stringify(Globals.commitObj, null, ' ')
					)
				);
			}
		}
	}
	$('#commit-json-accordion').on("accordionactivate", function(event, ui) {
		// We don't update the json commit during redactions for performance
		// reasons, so if the user opens it we need to do so.
		updateJsonCommitPreviewIfNecessary();
	});


	// http://www.siafoo.net/article/67
	function closeEditorWarning() {
		if (Globals.successfulCommit) {
			if (Globals.protectedObjs.length > 0) {
				return 'You need to be *certain* you have saved the verification certificates somewhere on your computer before navigating away from this page.';
			}
		} else {
			// If any editor contents changed, regenerate the commit and protected objects
			if (syncEditors() || _.isUndefined(Globals.commitObj) || _.isUndefined(Globals.protectedObjs)) {
				generateCommitAndProtectedObjects();
			}
				
			if (Globals.commitObj !== null) {
				return 'It looks like you have been editing something -- if you leave before submitting your changes will be lost.';
			}
		}
		return null;
	}
	
	window.onbeforeunload = closeEditorWarning;
	
	$('#tabs').on('tabsshow', function(event, ui) {
		if (ui.newPanel.attr('id') == 'tabs-compose') {
			// REVIEW: If you don't set the focus to the compose editor, then clicking inside of it
			// after switching tabs causes an "Object does not support property or method" 
			// error in IE.  Specifically, the error is in a call to bkExtend where it receives
			// a read-only element that it attempts to copy properties to (e.g. 'construct').
			// This has to happen after the tab has been shown (tabsshow event) and not merely
			// at the moment of selection (tabsselect event)
			$('editor-compose').focus();
		}
	});
	
	// Bind function for what happens on tab select
	$('#tabs').on('tabsactivate', function(event, ui) {
		
		switch(ui.newPanel.attr('id')) {
			case 'tabs-compose':
				syncEditors();
				break;

			case 'tabs-protect':
				$('#progress-commit').hide();
				// Unfortunately, switching tabs disables undo.  :(
				// Also unfortunately, there's no undo for adding and removing protections
				syncEditors();
				updateJsonCommitPreviewIfNecessary();
				break;
			
			case 'tabs-commit':
				$('#json-protected').empty();
				if (Globals.protectedObjs.length === 0) {
					$('#no-protections').show();
					$('#some-protections').hide();
				} else if (Globals.protectedObjs.length == 1) {

					var certificate = '';					
					certificate += '/* BEGIN REVEAL CERTIFICATE */' + '\n';
					certificate += '/* To use this, visit: ' + common.makeVerifyUrl(PARAMS.base_url, Globals.commit_id) + ' */' + '\n';

					var reveal = Globals.protectedObjs[0];
					reveal.commit_id = Globals.commit_id;
					certificate += common.escapeNonBreakingSpacesInString(JSON.stringify(reveal, null, ' ')) + '\n';
					certificate += '/* END REVEAL CERTIFICATE */';

					$('#json-protected').text(certificate);
					$('#no-protections').hide();
					$('#some-protections').show();
					
					// jQuery tabs do something weird to the selection
					// http://groups.google.com/group/jquery-ui/browse_thread/thread/cf272e3dbb75f201
					// waiting is a workaround
					window.setTimeout(BlackhighlighterWrite.highlightProtectedText, 200); // returns timerId
				} else {
					// Before I tried to put HTML inside the textarea but,
					// but that was hard to escape properly.  If there were
					// multiple redaction pens it really should be done with
					// an accordion.  
					throw "UI for multiple redaction pens is not yet implemented.";
				}
				break;

			default:
				throw 'no match for tab in write.js';
		}
		Globals.lastTabId = ui.newPanel.attr('id');
	});

	BlackhighlighterWrite.highlightProtectedText = function() {
		clientCommon.highlightAllOfElement($('#json-protected').get(0));
	};
		
	$('#tabs').on('tabsfocus', function(event, ui) {
		if (ui.newPanel.attr('id') == 'tabs-commit') {
			BlackhighlighterWrite.highlightProtectedText();
		}
	});

	BlackhighlighterWrite.previousStep = function() {
		$('#tabs').tabs('option', 'active', tabIndexForId(Globals.lastTabId)-1);
	};

	BlackhighlighterWrite.nextStep = function() {
		$('#tabs').tabs('option', 'active', tabIndexForId(Globals.lastTabId)+1);
	};

	function finalizeCommitUI() {
		if (this.timerId !== null) {
			window.clearTimeout(this.timerId);
		}
		this.timerId = undefined;
		
		$('#progress-commit').hide();
		if (Globals.successfulCommit) {
			$('#tabs').tabs('enable', tabIndexForId('tabs-commit'));
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-commit'));
			$('#tabs').tabs('disable', tabIndexForId('tabs-protect'));
		} else {
			// Since we didn't successfully commit the letter, bring buttons back
			$('#buttons-protect').show();
			
			$('#tabs').tabs('enable', tabIndexForId('tabs-compose'));
		}
	}
	finalizeCommitUI.timerCallback = function() {
		finalizeCommitUI.timerId = null;
		if (Globals.successfulCommit) {
			finalizeCommitUI();
		} // else we expect the pending Ajax call to complete and reset this to undefined
	};
	finalizeCommitUI.timerId = undefined;
	
	BlackhighlighterWrite.commit = function() {

		if (Globals.successfulCommit) {
			throw "Duplicate commit attempt detected.";
		}
		if (!_.isUndefined(finalizeCommitUI.timerId)) {
			throw "Commit progress timer not cleared out by last attempt";
		}

		clearErrorOnTab('commit');

		// If any editor contents changed, regenerate the commit and protected objects
		if (syncEditors() || _.isUndefined(Globals.commitObj) || _.isUndefined(Globals.protectedObjs)) {
			generateCommitAndProtectedObjects();
		}
		
		// Hide the buttons so the user can't navigate away or click twice
		$('#buttons-protect').hide();
		$('#commit-json-accordion').hide();
		
		// jquery UI does not support an indeterminate progress bar yet
		// http://docs.jquery.com/UI/API/1.7/Progressbar
		// Currently using an animated GIF from http://www.ajaxload.info/
		$('#progress-commit').show();
		
		// We set a timer to make sure there is enough of a delay that the
		// user feels confident that something actually happened
		finalizeCommitUI.timerId = window.setTimeout(finalizeCommitUI.timerCallback, 3000);

		// don't allow tab switching back to compose or protect during Ajax request
		// if request succeeds, we don't re-enable them because the letter is readable at the post URL
		$('#tabs').tabs('disable', tabIndexForId('tabs-compose'));
				
		// http://docs.jquery.com/Ajax/jQuery.ajax
		$.ajax({
			type: 'POST',
			dataType: 'json', // expected response type from server
			url: common.makeCommitUrl(PARAMS.base_url),
			data: {
				'commit': common.escapeNonBreakingSpacesInString(JSON.stringify(Globals.commitObj, null, ' '))
			},
			success: function(result){
				if (result.error) {
					notifyErrorOnTab('commit', result.error.msg);
					finalizeCommitUI();
				} else {
					Globals.commitObj.commit_date = result.commit.commit_date;
					Globals.commit_id = common.calculateIdFromCommit(Globals.commitObj);

					if (Globals.commit_id != result.commit.commit_id) {
						throw 'Server accepted data but did not calculate same commit hash we did!';
					}

					Globals.successfulCommit = true;
					// The JSON response tells us where the show_url is for our new letter
					var showUrl = common.makeShowUrl(PARAMS.base_url, Globals.commit_id);
					$('#url-public').html( 
						'<a href="' + showUrl + '" target="_blank">'
						+ showUrl
						+ '</a>'
					);
				}
				if (finalizeCommitUI.timerId === null) {
					finalizeCommitUI();
				} // otherwise let the timer do the select after flicker interval is over
			},
			error: function (XMLHttpRequest, textStatus, errorThrown) {
				finalizeCommitUI();
				
				// Note that "this" contains the options for this ajax request
				switch (textStatus) {
					case 'timeout':
						notifyErrorOnTab('commit', 'The request timed out.  Check your network connection and try again.');
						break;
						
					case 'error':
						notifyErrorOnTab('commit', 'There was an error on the server side during your request.');
						break;
						
					case 'notmodified':
					case 'parsererror':
						notifyErrorOnTab('commit', 'Unexpected error code during Ajax POST: ' + textStatus);
						break;
						
					default:
						notifyErrorOnTab('Unexpected error code during Ajax POST: ' + textStatus);
						break;
				}
			}
		});
	};

});
