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
	'sha256', // http://www.webtoolkit.info/javascript-sha256.html
	'json2', // http://www.json.org/json2.js
	'innerxhtml', // innerXHTML, because... hey, why not be future proof and use XHTML?
	'autogrow',
	'niceditFixed'
], function($, _, common, clientCommon) {

	var Globals = {
		commitObj: undefined,
		protectedObjs: undefined,
		commit_id: undefined,
		successfulCommit: false,
		lastTabId: 'tabs-compose' // we start on compose tab, and don't get a select notification for it
	};

	// http://www.jankoatwarpspeed.com/post/2009/03/11/How-to-create-Skype-like-buttons-using-jQuery.aspx
	// lines broken differently to please javascript lint
	$(document).ready(function(){
		$('.button').hover(function(){
			$('.button img').animate(
				// first jump  
				{top: '-10px'}, 200).animate(
				{top: '-4px'}, 200).animate(
				// second jump
				{top: '-7px'}, 100).animate(
				{top: '-4px'}, 100).animate(
				// the last jump
				{top: '-6px'}, 100).animate(
				{top: '-4px'}, 100);
			});
		}); 

	// jquery UI does tabs by index, not ID.  using this to increase readability
	function tabIndexForId(id) {
		return {
			'tabs-compose': 0,
			'tabs-protect': 1,
			'tabs-commit': 2}[id];
	}
	
	function notifyErrorOnTab(tab, msg) {
		$('#error-' + tab + '-msg').empty().append(document.createTextNode(msg));
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

	// Though ideally we would be able to update the source code in #json-commit with
	// each protection, for performance reasons we collapse it each time the user
	// makes an edit which would change the json-commit source.
	function ensureJsonCommitCollapsed() {
		$('#json-commit').empty();
		$('#demo-source').find('> a').each(function(i) {
			if ($(this).hasClass('source-open')) {
				$(this).removeClass('source-open');
				$(this).addClass('source-closed');
				$(this).next().hide();
			}
		});
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
		if (protectedEl.hasClass('protected_readwrite')) {
			return false;
		}

		ensureJsonCommitCollapsed();
		clientCommon.clearUserSelection();
		
		if (protectedEl.hasClass("suggested_protection")) {
			protectedEl.removeClass("suggested_protection");
			protectedEl.addClass("protected");
			protectedEl.addClass("protected_readonly");
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

		return true;
	};
	var doUnprotectOrTakeSuggestion_callback = function() {
		return BlackhighlighterWrite.doUnprotectOrTakeSuggestion($(this));
	};
	
	
	function doProtect(selectedInstance, element) {
		// selectedInstance is null (?) so passed instance in as this ptr in closure
		var instance = this;
		
		ensureJsonCommitCollapsed();

		// We depend on this compatibility layer:
		// http://code.google.com/p/ierange/
		var range = instance.getRng();
		if (range && (range.toString() !== '')) {
						
			// we extract the contents which removes them from the editor.
			// REVIEW: cloneContents() instead?
			// http://www.phpied.com/replace-selected-text-firefox/
			var fragment = $(range.extractContents());
		
			// find all protected or suggested_protection spans in the range and replace them with their contents
			// NOTE: find() does not seem to work on document fragments, see post
			// http://groups.google.com/group/jquery-en/browse_thread/thread/c942018ff571b135/
			// http://docs.jquery.com/Selectors/multiple#selector1selector2selectorN
			fragment.children().filter('span').filter('.protected,.suggested_protection').each(function(i) {
				var parentOfThis = this.parentNode;
				$(this).replaceWith($(this).contents());
				// We must normalize so that adjacent TextNodes get merged together
				// NOTE: IE6 and 7 document fragments can't be normalized!
				// http://reference.sitepoint.com/javascript/DocumentFragment
				// we must defer the normalization until after the insertion below
				/* parentOfThis.normalize(); */
			});
			
			var protectedEl = $('<span class="protected protected_readonly"></span>');
			protectedEl.append(fragment.contents());
			protectedEl.get(0).normalize();
			protectedEl.click(doUnprotectOrTakeSuggestion_callback);
			
			range.insertNode(protectedEl.get(0));
	
			killEmptyTextNodesRecursivePreorder(instance.getElm());

			normalizeProtectionsInSubtree(instance.getElm());
			
			// we must unselect the selection, or the XORing will make it look
			// bad and not all blacked out
			// http://www.webreference.com/js/column12/selectionobject.html
			clientCommon.clearUserSelection();
		}
		
		Globals.commitObj = undefined;
		Globals.protectedObjs = undefined;
	}

	// Bring tabs to life.
	$('#tabs').tabs();

	// Disable tabs that we're not ready for
	$('#tabs').tabs('disable', tabIndexForId('tabs-commit'));
	
	// used to have this code in bkLib.onDomLoaded
	// but that caused some kind of crash in IE because if you are in a jquery $() scoping thing
	// you're already in the loaded phase... 
	// see: http://www.learningjquery.com/2006/09/introducing-document-ready
	
		
	var nicEditorCompose = new nicEditor({
		// http://wiki.nicedit.com/Configuration-Options
		'iconsPath': PARAMS.blackhighlighter_media_url + 'nicEditorIcons.gif', 
/*		'srcPath': PARAMS.blackhighlighter_media_url + 'nicEdit/', */
		'xhtml': true,
		'buttonList': [
			// REVIEW: Allow markup and rich formatting?
/*			'bold',
			'italic',
			'underline',
			'left',
			'center',
			'right'*/
		]
	}).panelInstance('editor-compose');
	var nicInstanceCompose = nicEditorCompose.instanceById('editor-compose');

	var nicEditorProtect = new nicEditor({
		'iconsPath': PARAMS.blackhighlighter_media_url + 'nicEditorIcons.gif', 
/*		'srcPath': PARAMS.blackhighlighter_media_url + 'nicEdit/', */
		'xhtml': true,
		'buttonList': [
			// REVIEW: Buttons for different redaction pens?
		]
	}).panelInstance('editor-protect');
	var nicInstanceProtect = nicEditorProtect.instanceById('editor-protect');
	
	// The nicEdit selection event only captured mouse downs
	// (see init method in nicInstance.js)
	// I wanted mouse ups.  Well, actually selection changes which 
	// are finalized by mouse ups...
	nicInstanceProtect.elm.addEvent('mouseup', nicInstanceProtect.selected.closureListener(nicInstanceProtect));
	nicEditorProtect.addEvent('selected', doProtect.closure(nicInstanceProtect));
			
	// http://bytes.com/groups/javascript/484582-setattribute-versus-assigning-property
	nicInstanceProtect.elm.setAttribute('contentEditable','false');
	nicInstanceProtect.elm.className = 'protection_area';

	nicInstanceCompose.elm.focus();

	function addProtectSuggestions(node) {
	
		var lastPushWasText = false;
		// re-interleave the splits and matches...which goes first depends on whether
		// the match was at the first position.
		
		function pushSuggestSpan(str) {
			var suggestSpan = $('<span class="suggested_protection">' + str + '</span>');
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
		$(node).find('span').filter('.suggested_protection').each(function(i) {
			replaceWithContents.push($(this));
		});
		for (var replaceIndex = 0; replaceIndex < replaceWithContents.length; replaceIndex++) {
			var parent = replaceWithContents[replaceIndex].parent();
			replaceWithContents[replaceIndex].replaceWith(replaceWithContents[replaceIndex].contents().remove());
			parent.get(0).normalize();
		}
	}
	
	
	function syncEditors() {
		if (Globals.lastTabId == 'tabs-protect') {
			// get any protections and copy to the compose editor
			// NOTE: "true" parameter to clone preserves functions attached to elements
			var elementProtectCopy = $(nicInstanceProtect.elm).clone(true);
			elementProtectCopy.find('span').filter('.protected').each(function(i){
				$(this).removeClass('protected_readonly').addClass('protected_readwrite');
			});
			removeProtectSuggestions(elementProtectCopy.get(0));
			$(nicInstanceCompose.elm).empty().append(elementProtectCopy.contents());
			return true;
		} else if (Globals.lastTabId == 'tabs-compose') {
			// get any modifications to the letter and copy to the protected text
			// NOTE: "true" parameter to clone preserves functions attached to elements
			var elementComposeCopy = $(nicInstanceCompose.elm).clone(true);
			elementComposeCopy.find('span').filter('.protected').each(function(i){
				$(this).removeClass('protected_readwrite').addClass('protected_readonly');
			});
			
			// REVIEW: IE has a "feature" where it will always turn things that look like 
			// hyperlinks or email addresses into anchors.  Seems you can't turn it off.
			//   http://drupal.org/node/191644
			// Removing all anchors is okay at this point, since we're not allowing the
			// user to deliberately insert anchors...
			var replaceWithContents = [];
			elementComposeCopy.find('a').each(function(i) {
				replaceWithContents.push(this);
			});
			for (var replaceIndex = 0; replaceIndex < replaceWithContents.length; replaceIndex++) {
				var replaceMe = replaceWithContents[replaceIndex];
				var parentOfReplace = replaceMe.parentNode;
				$(replaceMe).replaceWith($(replaceMe).contents());
				parentOfReplace.normalize();
				if (notNormalized(parentOfReplace)) {
					throw "Normalization failure!  What kind of browser are you running, anyway?";
				}
			}
			
			addProtectSuggestions(elementComposeCopy.get(0));
			$(nicInstanceProtect.elm).empty().append(elementComposeCopy.contents());
			return true;
		}

		// assume in sync
		return false;
	}
	

	function generateCommitAndProtectedObjects() {
		// Abstraction for getting the DOM (not text content) of a nicEditor while still
		// handling the issues noted in http://wiki.nicedit.com/XHTML-Compliant-Output
		var publicAndProtected = nicInstanceProtect.getElmCloneClean();
		removeProtectSuggestions(publicAndProtected.get(0));

		Globals.commitObj = {
			'spans': []
		};
		
		Globals.protectedObjs = undefined;
		
		var revealsByName = {};
		var placeholders = [];
		var mergeableLineBreakPending = false;
		var redactionOrder = 1;

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
						
						var content = innerXHTML(child);
						// REVIEW: If HTML formatting is ever supported, we would need to ensure that the all subsets of
						// substitutions generate valid HTML, e.g. you can't mark out the open tag for a bold and leave 
						// the close tag behind.  Also, need to sanitize all script tags and other non-markup bits.
			
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
								if ($(child).contents().length === 0) {
									pushUnmergeableLineBreak();
								} else {
									throw 'Malformed <br> tag has child nodes';
								}
							}
							break;
							
							case 'p': {
								// Though Firefox doesn't seem to inject paragraphs each time you press
								// enter, Opera does.  We translate these into two newlines.
								pushMergeableLineBreak();
								$(child).contents().each(function(i) { processChild(this); });
								pushMergeableLineBreak();
							}
							break;
							
							case 'div': {
								// Chrome use "div" instead of paragraphs.  Each "div" introduces a line
								// break which is merged with that from other sibling divs.
								pushMergeableLineBreak();
								$(child).contents().each(function(i) { processChild(this); });
								pushMergeableLineBreak();
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

		publicAndProtected.contents().each(function(i){
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

	// This was tricky to figure out but it's based on how jquery ui demo does "View Source"
	// See it used on http://jqueryui.com/demos/accordion/
	//
	// It used to be more terse, e.g. 
	// $(this).toggleClass('source-closed').toggleClass('source-open').next().toggle();
	//
	// However, I was finding it difficult to debug and getting some kind of strange re-entrant
	// situation that was leaving spans mysteriously hidden, at least in Firefox.  When I changed
	// it to this more verbose method it started working.  
	$('#demo-source').find('> a').click(function() {
		if ($(this).hasClass('source-closed')) {
			$('#json-commit').empty();			
			if (syncEditors() || _.isUndefined(Globals.commitObj) || _.isUndefined(Globals.protectedObjs)) {
				generateCommitAndProtectedObjects();
			}
			if (Globals.commitObj !== null) {
				$('#json-commit').append(document.createTextNode(
					common.escapeNonBreakingSpacesInString(JSON.stringify(Globals.commitObj, null, ' '))));
			}
			
			$(this).removeClass('source-closed');
			$(this).addClass('source-open');
			$(this).next().show();
		} else if ($(this).hasClass('source-open')) {
			$(this).removeClass('source-open');
			$(this).addClass('source-closed');
			$(this).next().hide();
		} else {
			throw "node should have source-open or source-closed class";
		}

		return false;
	});
	$('#demo-source').find('> a').next().hide();

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
	
	$('#tabs').bind('tabsshow', function(event, ui) {
		if (ui.panel.id == 'tabs-compose') {
			// REVIEW: If you don't set the focus to the compose editor, then clicking inside of it
			// after switching tabs causes an "Object does not support property or method" 
			// error in IE.  Specifically, the error is in a call to bkExtend where it receives
			// a read-only element that it attempts to copy properties to (e.g. 'construct').
			// This has to happen after the tab has been shown (tabsshow event) and not merely
			// at the moment of selection (tabsselect event)
			nicInstanceCompose.elm.focus();
		}
	});
	
	// Bind function for what happens on tab select
	$('#tabs').bind('tabsselect', function(event, ui) {

		// Objects available in the function context:
		// ui.tab     // anchor element of the selected (clicked) tab
		// ui.panel   // element, that contains the selected/clicked tab contents
		// ui.index   // zero-based index of the selected (clicked) tab
		
		switch(ui.panel.id) {
			case 'tabs-compose':
				syncEditors();
				break;

			case 'tabs-protect':
				ensureJsonCommitCollapsed();
				
				$('#progress-commit').hide();
				// Unfortunately, switching tabs disables undo.  :(
				// Also unfortunately, there's no undo for adding and removing protections
				syncEditors();
				break;
			
			case 'tabs-commit':
				$('#json-protected').empty();
				if (Globals.protectedObjs.length === 0) {
					$('#no-protections').show();
					$('#some-protections').hide();
				} else {
					var protectedHtml = '';
					
					protectedHtml += '<p>';
					protectedHtml += '/* BEGIN REVEAL CERTIFICATE */' + '<br />';
					protectedHtml += '/* To use this, visit: ' + common.makeVerifyUrl(PARAMS.base_url, Globals.commit_id) + ' */' + '<br />';
					
					if (Globals.protectedObjs.length == 1) {
						var reveal = Globals.protectedObjs[0];
						reveal.commit_id = Globals.commit_id;
						protectedHtml +=  common.escapeNonBreakingSpacesInString(JSON.stringify(reveal, null, ' ')) + '<br />';
					} else if (Globals.protectedObjs.length > 1) {
						if (true) {
							throw "UI for multiple redaction pens is not yet implemented.";
						} else {
							for (var protectedObjIndex = 0; protectedObjIndex < Globals.protectedObjs.length; protectedObjIndex++) {
								protectedHtml += '<p>';
								protectedHtml += '// Key #' + (protectedObjIndex+1) + ' goes here<br />';
								protectedHtml += JSON.stringify(Globals.protectedObjs[protectedObjIndex], null, ' ');
								protectedHtml += '</p>';
							}
						}
					}
					protectedHtml += '/* END REVEAL CERTIFICATE */';
					protectedHtml += '</p>';

					$('#json-protected').append($(protectedHtml));
					$('#no-protections').hide();
					$('#some-protections').show();
					
					// jQuery tabs do something weird to the selection
					// http://groups.google.com/group/jquery-ui/browse_thread/thread/cf272e3dbb75f201
					// waiting is a workaround
					window.setTimeout(BlackhighlighterWrite.highlightProtectedText, 200); // returns timerId
				}
				break;

			default:
				throw 'no match for tab in write.js';
		}
		Globals.lastTabId = ui.panel.id;
	});

	BlackhighlighterWrite.highlightProtectedText = function() {
		clientCommon.highlightAllOfElement($('#json-protected').get(0));
	};
		
	$('#tabs').bind('tabsfocus', function(event, ui) {
		if (ui.panel.id == 'tabs-commit') {
			BlackhighlighterWrite.highlightProtectedText();
		}
	});

	BlackhighlighterWrite.previousStep = function() {
		$('#tabs').tabs('select', tabIndexForId(Globals.lastTabId)-1);
	};

	BlackhighlighterWrite.nextStep = function() {
		$('#tabs').tabs('select', tabIndexForId(Globals.lastTabId)+1);
	};

	function finalizeCommitUI() {
		if (this.timerId !== null) {
			window.clearTimeout(this.timerId);
		}
		this.timerId = undefined;
		
		$('#progress-commit').hide();
		if (Globals.successfulCommit) {
			$('#tabs').tabs('enable', tabIndexForId('tabs-commit'));
			$('#tabs').tabs('select', tabIndexForId('tabs-commit'));
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
					Globals.successfulCommit = true;
					Globals.commitObj.commit_date = result.commit_date;
					
					Globals.commit_id = common.makeIdFromCommit(Globals.commitObj);

					// The JSON response tells us where the show_url is for our new letter
					var showUrl = common.makeShowUrl(PARAMS.base_url, Globals.commit_id);
					innerXHTML($('#url-public').get(0), 
						'<a href="' + showUrl + '" target="_blank">' + showUrl + '</a>');
				}
				if (finalizeCommitUI.timerId === null) {
					finalizeCommitUI();
				} // otherwise let the timer do the select after flicker interval is over
			},
			error: function (XMLHttpRequest, textStatus, errorThrown) {
				finalizeCommitUI();
				
				// "this" contains the options for this ajax request
				if (errorThrown) {
					throw errorThrown;
				} else {
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
			}
		});
	};

});