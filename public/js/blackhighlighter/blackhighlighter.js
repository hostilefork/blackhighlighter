//
// blackhighlighter.js
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
//   See http://hostilefork.com/blackhighlighter for documentation.
//


// Basic structure borrowed from:
// https://github.com/bgrins/BlackhighlighterTextareas

(function(factory) {
	// Add jQuery via AMD registration or browser globals
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery', 'underscore', 'sha256', 'client-server-common', 'client-common'], factory);
	}
	else {
		// How to pass in underscore in non-AMD cases?  Is this right?
		factory(jQuery, _);
	}
}(function ($, _, SHA256, common, clientCommon) {

	var Blackhighlighter = function($div, opts) {
		Blackhighlighter._registry.push(this);

		this.$div = $div;
		$div.addClass("blackhighlighter"); // keep track of if we added it to take it off?
		this.setMode(opts.mode, true);
		if (opts.mode === 'show') {
			if (opts.commit) {
				this.commit = opts.commit;
			} else {
				throw "Starting a blackhighlighter in show mode requires a commit in the options";
			}
		} else {
			if (opts.commit) {
				throw "Can't start a compose/protect blackhighlighter with a commit";
			}
		}

		// Do more checking on this
		if (opts.reveals) {
			this.reveals = opts.reveals;
		}
		if (opts.protections) {
			this.protections = opts.protections;
		}

		// We need some kind of updating/event model so that clients can
		// know at least if someone has redacted or unredacted...

		if (opts.update) $div.bind("update.blackhighlighter", opts.update);
	};

	// Stores (active) `Blackhighlighter` instances
	// Destroyed instances are removed
	Blackhighlighter._registry = [];

	// Returns the `Blackhighlighter` instance given a DOM node
	Blackhighlighter.getInstance = function(div) {
		var $divs = $.map(Blackhighlighter._registry, function(instance) {
				return instance.$div[0];
			}),
			index = $.inArray(div, $divs);
		return index > -1 ? Blackhighlighter._registry[index] : null;
	};


// We seem to get empty text nodes for some reason, at least in Firefox
// Jquery is not good at dealing with text nodes so best to use DOM to kill them
// REVIEW: Why are these showing up?  Is it this?
// http://markmail.org/message/uuoieaafwn6h6gxz
// http://reference.sitepoint.com/javascript/Node/normalize
function _killEmptyTextNodesRecursivePreorder(node) {
	// http://www.jslab.dk/articles/non.recursive.preorder.traversal.part2
	if ((node.nodeType == Node.TEXT_NODE) && (node.data === "")) {
		$(node).remove();
	} else {
		_.each(node.childNodes, function(childNode) {
			_killEmptyTextNodesRecursivePreorder(childNode);
		});
	}
};

////////////////////////////////////////////////////////////////////////////////

	Blackhighlighter.prototype = {
/*
		// Attaches input events
		// Only attaches `keyup` events if `input` is not fully suported
		attach: function() {
			var events = 'input.blackhighlighter change.blackhighlighter',
				_this = this;
			if(!inputSupported) events += ' keyup.blackhighlighter';
			this.$textarea.bind(events, function() { _this.update(); });
		},*/

		// In expanding, this would update the clone and trigger an event
		// I'm using it just to say when things get protected or unprotected
		// enhance event model later when I understand it better
		update: function() {

			// Use `triggerHandler` to prevent conflicts with `update` in Prototype.js
			this.$div.triggerHandler("update.blackhighlighter");
		},

		// Tears down the plugin on the object
		destroy: function() {
			var index = $.inArray(this, Blackhighlighter._registry);
			if (index > -1) Blackhighlighter._registry.splice(index, 1);

			// REVIEW: clean up any contenteditable or events?
			// version of setMode for targeting an undefined mode to help?

			this.$div.unbind('update.blackhighlighter'); // can pass more in string, space-delimited
		},

////////////////////////////////////////////////////////////////////////////////

		_addProtectSuggestionsRecursive: function(node) {
		
			var lastPushWasText = false;
			// re-interleave the splits and matches...which goes first depends on whether
			// the match was at the first position.
			
			function pushSuggestSpan(str) {
				var suggestSpan = $('<span class="suggested-protection">' + str + '</span>');
				suggestSpan.on('click', this._doUnprotectOrTakeSuggestion);
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

			// This is just a simple demonstration of the concept that the
			// editor could be looking for things you might want to protect
			// and suggest them for you.  While there are limits to how good
			// a job a browser client can do without talking to *some* server
			// to analyze for you, one could use a local/trusted server to
			// do it.
			//
			// NOTE: Blackhighlighter should only implement the suggestion
			// offering interface, not scan for the suggestions itself.
			// This needs to be broken out as an API.  At minimum, put the
			// suggest regexes in the options for now.

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
							this._addProtectSuggestionsRecursive(child);
							child = next;
						}
					}
					break;
				default:
					break;
			}
		},
		
		_removeProtectSuggestions: function() {
			this.$div.find('span.suggested-protection').each(function(idx, span) {
				var parent = span.parent();
				var $span = $(span);
				$span.replaceWith($span.contents().remove());
				parent.normalize();
			});
		},

		_canonizeContent: function() {
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
			getTextNodesIn(this.$div).each(function(idx, el) {
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
			this.$div.find("p").each(function(idx, el) {
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
				(this.$div.contents().length >= 2)
				&& (!this.$div.contents().eq(0).is("div"))
				&& (this.$div.contents().eq(1).is("div"))
			) {
				this.$div.contents().eq(0).wrapAll("<div></div>");
			}

			// After that let's flatten, and hope for the best.
			this.$div.find("div").each(function(idx, el) {
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
			var $contents = this.$div.contents();
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

			// REVIEW: IE has a "feature" where it will always turn things that
			// look like hyperlinks or email addresses into anchors.  Seems
			// you can't turn it off.
			//
			//   http://drupal.org/node/191644
			//
			// Removing all anchors is okay at this point, since we're not
			// allowing the user to deliberately insert anchors...
			var replaceWithContents = [];
			this.$div.find('a').each(function(i) {
				replaceWithContents.push(this);
			});
			_.each(replaceWithContents, function(replaceMe) {
				var parentOfReplace = replaceMe.parentNode;
				$(replaceMe).replaceWith($(replaceMe).contents());
				parentOfReplace.normalize();
				if (notNormalized(parentOfReplace)) {
					throw "Normalization failure trying to fix contenteditable.";
				}
			});

		},
		
		_decanonizeContent: function() {

			// One simple way to decanonize is just to leave the first element
			// outside of a div, with all the successive elements keeping their
			// divs and wrapping actual breaks in divs.  This is what webkit
			// seems to do, and if it weren't for the selection stuff I'd have
			// left it be.
			//
			// If only custom selection color wasn't so aesthetically fickle :-/
			//
			this.$div.children().each(function(idx, el) {
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
		},

		setMode: function(newMode, initializing) {
			var oldMode = undefined;

			if (!initializing) {
				oldMode = this.mode;
				if (oldMode == newMode) {
					return;
				}

				switch (oldMode) {
					case 'compose': {
						this.$div
							.attr("contenteditable", false)
							.removeClass("blackhighlighter-compose");
						break;
					}

					case 'protect': {
						this.$div
							.removeClass("blackhighlighter-protect")
							.off("mouseup", $.proxy(this._doProtect, this));
						this._removeProtectSuggestions();
						this._decanonizeContent();
						break;
					}

					case 'show': {
						throw "Cannot shift out of show mode; it's a finalization.";
						break;
					}

					default:
						throw "Internal blackhighlighter error: bad mode found."
				}
			}

			// Invariant: no classes we've added here should be applied
			// If we use this routine to cleanup, we may need to tolerate
			// a shutdown where we don't apply anything.  Content is
			// decanonized from our internal form to whatever the browser
			// likes best for non-blackhighlighter divs.

			switch (newMode) {
				case 'compose': {
					this.$div
						.attr("contenteditable", true)
						.addClass("blackhighlighter-compose");
					break;
				}

				case 'protect': {
					this.$div.addClass("blackhighlighter-protect");
					this._canonizeContent();

					// Selection changes are finalized by selected, or mouseup?  What
					// do we really want to capture here?
					this.$div.on("mouseup", $.proxy(this._doProtect, this));

					this._addProtectSuggestionsRecursive(this.$div.get(0));
					break;
				}

				case 'show':
					// only good for initializing...
					if (initializing) {
						this.$div.addClass("blackhighlighter-show");
						this.initialLetterText = this.$div.contents().clone();
					} else {
						this.$div.html(
							"<b>Ajax-based show mode not implemented yet!</b>"
							+ " : You have to load a show url for now"
						);
					}
					break;

				default:
					throw "Invalid mode passed to setBlackhighlighterMode: " + newMode;
			}

			this.mode = newMode;
		},

////////////////////////////////////////////////////////////////////////////////
		
		_notNormalized: function(node) {
			var lastWasTextNode = false;
			_.each(node.childNodes, function(child) {
				var nodeType = _.isUndefined(node.nodeType) ? Node.ATTRIBUTE_NODE : node.nodeType;
				if (nodeType == Node.TEXT_NODE) {
					if (lastWasTextNode) {
						return true;
					}
					lastWasTextNode = true;
				} else {
					lastWasTextNode = false;
				}
			});
		},

		_normalizeProtectionsInSubtree: function(elm) {
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
			_.each(deleteSpans, function(span) {
				span.remove();
			});
		},
		
		_doUnprotectOrTakeSuggestion: function(eventObj) {

			// http://www.quirksmode.org/js/events_properties.html
			var $target = $(eventObj.target);

			clientCommon.clearUserSelection();
			
			if ($target.hasClass("suggested-protection")) {
				$target.removeClass("suggested-protection");
				$target.addClass("protected");
				this._normalizeProtectionsInSubtree($target.parent());
			} else {		
				// http://www.exampledepot.com/egs/org.w3c.dom/MergeText.html
				// (except getFirstChildNode is not cross-browser)
				
				// Move all children of the clicked span in front of the span

				$target.contents().remove().insertBefore($target);
				var parent = $target.parent().get(0);
				$target.remove();

				// Merge all text nodes under the parent
				parent.normalize();
				_killEmptyTextNodesRecursivePreorder(parent);
			}

			this.update();
			return true;
		},
		
		_doProtect: function(eventObj) {
			$target = eventObj.target;

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
				
				var protectedEl = $('<span class="protected"></span>');
				protectedEl.append(fragment.contents());
				protectedEl.get(0).normalize();
				protectedEl.on('click', $.proxy(this._doUnprotectOrTakeSuggestion, this));
				
				range.insertNode(protectedEl.get(0));
		
				protectionAreaEl = $("#editor").get(0);

				_killEmptyTextNodesRecursivePreorder(protectionAreaEl);

				this._normalizeProtectionsInSubtree(protectionAreaEl);
				
				// we must unselect the selection, or the XORing will make it look
				// bad and not all blacked out
				// http://www.webreference.com/js/column12/selectionobject.html
				clientCommon.clearUserSelection();

				this.update();
			}		
		},

////////////////////////////////////////////////////////////////////////////////

		/*
		 * This should probably not be part of the API.  Though interesting to
		 * offer it as a hook so that curious people can see the certificate
		 * data without *actually* committing it, really it should only be
		 * offered as an undocumented hook.
		 */
		generateCommitAndProtections: function() {

			// The editor must be cleaned up and switched into canonical mode
			var modeSaved = this.mode;
			this.setMode('protect');

			// Note: This means if you are debugging and want to see the
			// suggestions you will have to turn them back on.  Work that out
			// later.

			this._removeProtectSuggestions(this.$div.get(0));

			var commit = {'spans': []};
			var protectedObjs = undefined;
			
			var protectionsByName = {};
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

					var numSpans = commit.spans.length;
							
					if ((numSpans > 0) && _.isString(commit.spans[numSpans-1])) {
						commit.spans[numSpans-1] += stringSpan;
					} else {
						commit.spans.push(stringSpan);
					}
				}
				
				function pushPlaceholderSpan(placeholder) {
					if (_.isUndefined(placeholder.display_length)) {
						throw 'Invalid placeholder pushed';
					}
					handleMergeableLineBreaks();
					commit.spans.push(placeholder);	
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
				
				function protectionNameForSpan(span) {
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
								
							var protectionName = protectionNameForSpan(child);

							var protection = protectionsByName[protectionName];
							if (_.isUndefined(protection)) {
								protection = {
									'redactions': [],
									'name': protectionName
								};
								protectionsByName[protectionName] = protection;
							}
							
							// http://www.javascripter.net/faq/convert3.htm
							// we track the order but do not put it into the
							// commit or protection as it is implicit
							var placeholder = {
								'display_length': content.length
							};
							placeholders.push({
								obj: placeholder,
								protection: protection,
								order: redactionOrder
							});

							protection.redactions.push(content);
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

			this.$div.contents().each(function(i){
				processChild(this);			
			});

			var protectionsByHash = {};

			for (var protectionNameToHash in protectionsByName) {
				if (protectionsByName.hasOwnProperty(protectionNameToHash)) {
					var protectionToHash = protectionsByName[protectionNameToHash];
					var saltToHash = common.stripHyphensFromUUID(common.generateRandomUUID());
					var contents = saltToHash;
					_.each(protectionToHash.redactions, function(redaction) {
						contents += redaction;
					});
					
					protectionToHash.salt = saltToHash;
					protectionToHash.sha256 = SHA256(contents);
					
					protectionsByHash[protectionToHash.sha256] = protectionToHash;
				}
			}

			_.each(placeholders, function(finalizeMe) {
				var obj = finalizeMe.obj;
				var protection = finalizeMe.protection;
				var order = finalizeMe.order;

				// Due to large random salt, hash is a unique ID for the reveal
				obj.sha256 = protection.sha256;
			});
			
			// Check that process did not produce two sequential string spans in commit
			var lastWasString = false;
			_.each(commit.spans, function(spanToCheck) {
				if (_.isString(spanToCheck)) {
					if (lastWasString) {
						throw "Two sequential string spans in commit -- error in generateCommitAndProtections()"; 
					}
					lastWasString = true;
				} else {
					lastWasString = false;
				}
			});
			
			// If the commit is effectively empty, set the commit object to null
			if (commit.spans.length === 0) {
				commit = null;
			} else if (commit.spans.length === 1) {
				if (_.isString(commit.spans[0]) && (common.trimAllWhitespace(commit.spans[0]) === '')) {
					commit = null;
				}
			}

			this.setMode(modeSaved);

			return {
				commit: commit,
				protections: protectionsByHash
			}
		},

////////////////////////////////////////////////////////////////////////////////

		makeCommitment: function(base_url, callback) {

			// Should be parameterized with the server.

			var temp = this.generateCommitAndProtections();
			var instance = this;

			// http://docs.jquery.com/Ajax/jQuery.ajax
			$.ajax({
				type: 'POST',
				dataType: 'json', // expected response type from server
				url: common.makeCommitUrl(base_url),
				data: {
					'commit': common.escapeNonBreakingSpacesInString(JSON.stringify(temp.commit, null, ' '))
				},
				success: function(result) {
					if (result.error) {
						notifyErrorOnTab('commit', result.error.msg);
						finalizeCommitUI();
					} else {
						temp.commit.commit_date = result.commit.commit_date;
						temp.commit.commit_id = SHA256(common.canonicalJsonFromCommit(temp.commit));

						if (temp.commit.commit_id != result.commit.commit_id) {
							callback('Server accepted data but did not calculate same commit hash we did!', null);
						}

						// Put the commit_id into the protection objects
						_.each(temp.protections, function(val) {
							val.commit_id = temp.commit.commit_id;
						});

						instance.commit = temp.commit;
						instance.protections = temp.protections;

						instance.setMode('show');

						callback(null);
					}
				},
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					finalizeCommitUI();
					
					// Note that "this" contains the options for this ajax request
					switch (textStatus) {
						case 'timeout':
							callback('The request timed out.  Check your network connection and try again.', null);
							break;
							
						case 'error':
							callback('There was an error on the server side during your request.', null);
							break;
							
						case 'notmodified':
						case 'parsererror':
							callback('commit', 'Unexpected error code during Ajax POST: ' + textStatus, null);
							break;
							
						default:
							callback('Unexpected error code during Ajax POST: ' + textStatus, null);
							break;
					}
				}
			});
		},

////////////////////////////////////////////////////////////////////////////////

		// For the moment, we assume the HTML with the placeholders was
		// already in the blackhighlighter region in the case of showing
		// This will need to be revisited.

		_refreshAllPlaceholders: function() {
			var revealIndices = {};

			// we used to convert the JSON into a public HTML fragment on the client side.
			// but server-side generation is better for running in non-javascript contexts.
			// and making it possible for search engines to index the letter.
			// Save what the server made in the beginning so that if we mess with it we
			// can restore it back.			
			this.$div.empty().append(this.initialLetterText.clone());

			var instance = this;
			this.$div.find('span').filter('.placeholder').each(function(i) {
				var placeholder = $(this);
				var shaHexDigest = placeholder.attr('title');

				if (!placeholder.hasClass('revealed')) {
					var publiclyRevealed = true;
					var reveal = instance.reveals[shaHexDigest];
					if (!reveal) {
						publiclyRevealed = false;
						reveal = instance.protections[shaHexDigest];
					}
					if (reveal) {
						if (!revealIndices[shaHexDigest]) {
							revealIndices[shaHexDigest] = 0;
						}
						placeholder.text(reveal.redactions[revealIndices[shaHexDigest]]);
						revealIndices[shaHexDigest]++;

						placeholder.removeClass('protected');
						if (publiclyRevealed) {
							placeholder.addClass('revealed');
						} else {
							placeholder.addClass('verified');
						}
					}
				}	
			});
		},

		seeProtection: function(protection, isFromServer) {

			var actualHash = SHA256(common.canonicalStringFromReveal(protection));
			if (actualHash != protection.sha256) {
				throw 'Invalid certificate: content hash is ' + actualHash 
					+ ' while claimed hash is ' + protection.sha256;
			}

			var numPlaceholdersForKey = 0;
			_.each(this.commit.spans, function (commitSpan) {
				if (commitSpan.sha256 == protection.sha256) {
					numPlaceholdersForKey++;
				}
			});
			// warn user if certificate is useless, need better UI
			if (numPlaceholdersForKey === 0) {
				throw 'Certificate does not match any placeholders.';
			}
			if (numPlaceholdersForKey != protection.redactions.length) {
				throw 'Certificate contains ' + protection.redactions.length +
					' redactions for key when letter needs ' + 
					numPlaceholdersForKey + ' for that key';
			}
		
			if (isFromServer) {
				this.reveals[protection.sha256] = protection;
			} else {
				if (protection.sha256 in this.reveals) {
					throw 'Local certificate already revealed on server.';
				} else if (protection.sha256 in this.protections) {
					throw 'You have already revealed the local certificate.';
				} else {
					this.protections[protection.sha256] = protection;
				}
			}

			this._refreshAllPlaceholders();
		},

		unseeProtection: function(protectionKey) {
		
			if (!(protectionKey in this.protections)) {
				throw 'Attempt to remove certificate that is not in the local list.';
			}
			
			delete this.protections[protctionKey];

			this._refreshAllPlaceholders();
		},

////////////////////////////////////////////////////////////////////////////////

		revealSecret: function(base_url, callback) {
			// If there is more than one reveal in the UI, we'd need to have a
			// way to indicate which one we are revealing in the request.  (or
			// make multiple requests if we intend to do more than one).  For
			// protocol simplicity in error reporting, the server now accepts
			// only one reveal per XMLHttpRequest.
			if (_.keys(this.protections).length != 1) {
				throw 'Multiple reveals feature not currently supported by client';
			}
			
			var reveal_url = common.makeRevealUrl(PARAMS.base_url);
			// http://docs.jquery.com/Ajax/jQuery.ajax
			$.ajax({
				type: 'POST',
				dataType: 'json', // expected response type from server
				url: reveal_url,
				// sends as UTF-8
				data: {
					reveal: JSON.stringify(
						_.values(this.protections)[0], null, ' '
					)
				},
				success: function(resultJson) {
					if (resultJson.error) {
						callback(resultJson.error.msg);
					} else {
						callback(null)	
					}
				},
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					finalizeRevealUI();
					
					// "this" contains the options for this ajax request

					switch (textStatus) {
						case 'timeout':
							callback('The POST reveal request timed out on ' + reveal_url + 
								' --- check your network connection and try again.');
							break;
							
						case 'error':
							callback('There was an error with the web server during your request.');
							break;
							
						case 'notmodified':
						case 'parsererror':
							notifyErrorOnTab('Unexpected error code during Ajax POST: ' + textStatus);
							break;
							
						default:
							notifyErrorOnTab('Unexpected error code during Ajax POST: ' + textStatus);
							break;
					}
				}
			});
		}


////////////////////////////////////////////////////////////////////////////////
	};


	//
	// This is the jQuery extension function which allows you to choose any
	// jQuery collection and run $(selector).blackhighlighter(...)
	//
	// Here the default options are set up.
	//
	$.blackhighlighter = $.extend({
		// Global options for the behavior of the blackhighlighter plugin
		autoInitialize: true,
		initialSelector: "div.blackhighlighter",

		// These are the per-instance options.  If there's a piece of state
		// or a hook that might be different between one div and another
		// then in needs to go in here.
		opts: {
			mode: 'compose',
			commit: null,
			protections: {},
			reveals: {},
			update: function() { }
		}
	}, $.blackhighlighter || {});


	//
	// This is the method dispatcher, and if a method is not detected then it
	// can initialize a new blackhighlighter on an element.
	//
	$.fn.blackhighlighter = function(o, arg1, arg2) {

		// 1. CHECK FOR METHOD CALLS
		//
		// Method calls are indicated by having the first parameter being a
		// string, so $(selector).blackhighlighter("...", ..., ...)
		//
		// I'm cloning jQuery UI's interface (options, methods, events) but
		// not in any general way at the moment.

		if (o === "option") {
			// I'm not clear on what to do if there's an array incoming, and
			// you're trying to get properties.  Let's say I want to call an
			// option getter for a string property, and I pass in a single
			// object... I'd just want a string, right?  But if I use
			// jQuery map I'll get an array, even on a single object (and
			// a jQuery object wrapping that array, without fn.map :-/)
			// REVIEW: Ask what convention is here.

			if (this.length != 1) {
				throw new Error("Currently not handling length > 1 collections in blackhighlighter options.");
			}

			var instance = Blackhighlighter.getInstance(this.get(0));
	
			if (arg1 === "mode") {
				if (!instance) return undefined;

				if (_.isUndefined(arg2)) {
					return instance.mode
				} else {
					instance.setMode(arg2);
					return undefined;
				}
			}

			if (arg1 === "commit") {
				if (this.length != 1) {
					throw new Error("Currently not handling length > 1 collections for commit.");
				}

				var instance = Blackhighlighter.getInstance(this.get(0));

				if (instance.mode === 'show') {
					// Don't return the actual commit object!
					return _.clone(instance.commit);
				} else {
					// REVIEW: should giving back the pre-commit and pre-reveal
					// be a special debugging function only?
					var temp = instance.generateCommitAndProtections();
					return temp.commit; 
				}
			}

			if (arg1 === "protections") {
				if (!instance) return undefined;

				if (instance.mode === 'show') {
					// Don't return the actual protection objects!
					return _.clone(instance.protections);
				} else {
					// REVIEW: should giving back the pre-commit and pre-reveal
					// be a special debugging function only?
					var temp = instance.generateCommitAndProtections();
					return temp.protections;
				}
			}

			if (arg1 === "reveals") {
				if (!instance) return undefined;

				if (instance.mode === 'show') {
					// Don't return the actual reveal objects!
					return _.clone(instance.reveals);
				} else {
					// Nothing is revealed to the server if we're still editing
					return {};
				}
			}

			throw "Unknown option passed to blackhighlighter";
		}

		if (o === "ismodified") {
			if (this.length != 1) {
				throw new Error("Currently not handling length > 1 collections in debuginfo.");
			}

			var instance = Blackhighlighter.getInstance(this.get(0));

			if (instance.mode === 'show') {
				// Once in the show state, it's too late to make changes
				// But does adding reveals count as a modification?
				return false;
			} else {
				// If an uncommitted editor has anything in the commit,
				// that's a sign that some editing has happened
				var temp = instance.generateCommitAndProtections();				
				return (temp.commit !== null);
			}
		}

		if (o === "makecommitment") {
			if (this.length != 1) {
				throw new Error("Currently not handling length > 1 collections in commit.");
			}

			var instance = Blackhighlighter.getInstance(this.get(0));
			instance.makeCommitment(arg1, arg2);
		}

		if (o === "seereveal") {
			if (this.length != 1) {
				throw new Error("Currently not handling length > 1 collections in commit.");
			}

			var instance = Blackhighlighter.getInstance(this.get(0));
			return instance.seeProtection(arg1, arg2);
		}

		if (o === "revealsecret") {
			if (this.length != 1) {
				throw new Error("Currently not handling length > 1 collections in commit.");
			}

			var instance = Blackhighlighter.getInstance(this.get(0));
			instance.revealSecret(arg1, arg2);
		}

		if (o === "destroy") {
			this.each(function() {
				var instance = Blackhighlighter.getInstance(this);
				if (instance) instance.destroy();
			});
			return this;
		}

		// Checks to see if any of the given DOM nodes have the
		// blackhighlighter behaviour.
		if (o === "active") {
			return !!this.filter(function() {
				return !!Blackhighlighter.getInstance(this);
			}).length;
		}

		// 2. MAKE A NEW BLACKHIGHLIGHTER
		//
		// If the method name is not recognized, we treat whatever we get as
		// being options.  (Note: is this safe?  It's what expandarea did, but
		// seems it would be better to make sure what we're looking at is an
		// object, or perhaps testing for no arguments :-/)

		var opts = $.extend({ }, $.blackhighlighter.opts, o);

		this.filter("div").each(function() {
			var initialized = Blackhighlighter.getInstance(this);

			if(!initialized) new Blackhighlighter($(this), opts);
			else {
				if(initialized) _warn("Blackhighlighter: attempt to initialize a div that has already been initialized. Subsequent calls are ignored.");
			}
		});
		return this;
	};

	function _warn(text) {
		if(window.console && console.warn) console.warn(text);
	}

	$(function () {
		if ($.blackhighlighter.autoInitialize) {
			$($.blackhighlighter.initialSelector).blackhighlighter();
		}
	});

}));
