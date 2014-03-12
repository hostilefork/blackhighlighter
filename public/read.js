//
// read.js - blackhighlighter supplemental javascript for reading/verifying letters.
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

// REVIEW: What's the best way to call methods in requirejs modules from
// html elements (such as onClick handlers?)

// http://stackoverflow.com/questions/10302724/
var BlackhighlighterRead = {};

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
	'expanding'
], function($, _, common, clientCommon) {
	
	var Globals = {
		// due to the fact that there's no "get currently active accordion section",
		// we have to track it ourself.
		lastAccordionId: null,
		commit: PARAMS.commit,
		initialLetterText: $('#letter-text').contents().clone(),
		serverRevealsByHash: {},
		localRevealsByHash: {},
		successfulVerify: undefined,
		successfulReveal: undefined
	};

	// Theme all the button-type-things but not the <a href="#" ..> style
	$("input:submit, button").button();

	// Make all the indeterminate progress bars animate.  They're hidden.
	$(".indeterminate-progress").progressbar({value: false});

	// The JSON in the reveal is static and populated later
	// This just sets up a collapsible accordion to contain it, start closed
	$('#reveal-json-accordion').accordion({
		collapsible: true,
		active: false,

		// autoHeight doesn't seem to work by itself; mumbo-jumbo needed
		// http://stackoverflow.com/a/15413662/211160
		heightStyle: "content",
		autoHeight: false,
        clearStyle: true
	});


	// http://www.jacklmoore.com/autosize/
	$('textarea.expanding').expanding();

	
	// jquery UI does tabs by index, not ID.  using this to increase readability
	// NOTE: a function as opposed to a raw map for consistency with accordionIndexForId
	function tabIndexForId(id) {
		return {
			'tabs-verify': 0, 
			'tabs-show': 1,
			'tabs-reveal': 2,
			'tabs-done': 3
		}[id];
	}

	// Bring tabs to life.
	$('#tabs').tabs();
	
	function notifyErrorOnTab(tab, msg) {
		$('#error-' + tab + '-msg').empty().append(document.createTextNode(msg));
		$('#error-' + tab).show();
	}
	
	function clearErrorOnTab(tab) {
		$('#error-' + tab).hide();
	}

	// NOTE: This is a function, not a map.
	function accordionIndexAndChildForId(revealKey) {
		var index = null;
		var child = null;
		$('#accordion').children().each(function(i) {
			if ($(this).attr('title') == revealKey) {
				if (index !== null) {
					throw 'More than one accordion tab for certificate' + revealKey;
				}
				index = i;
				child = $(this);
			}
		});
		if (index === null) {
			throw 'Cannot find accordion tab for certificate ' + revealKey;
		}
		return {'index': index, 'child': child};
	}
	
	function accordionIndexForId(revealKey) {
		return accordionIndexAndChildForId(revealKey).index;
	}

	function accordionHeaderForId(revealKey) {
		return accordionIndexAndChildForId(revealKey).child.children().filter("a");
	}
	
	function accordionContentForId(revealKey) {
		return accordionIndexAndChildForId(revealKey).child.children().filter("div");
	}
	
	// Hide the accordion from view until multiple reveals have UI better implemented
	// and CSS issues are solved
	$('#accordion').hide();
	
	// Bring accordion to life
	// http://jqueryui.com/accordion/
	$('#accordion').accordion({ 
		'collapsible': true
	});
	
	$('#accordion').on('accordionchange', function(event, ui) {
		// ui.newHeader // jQuery object, activated header
		// ui.oldHeader // jQuery object, previous header
		// ui.newContent // jQuery object, activated content
		// ui.oldContent // jQuery object, previous content
		
		// we don't get the index, we get the header and the content
		// the header seems to be the expected object, but the
		// content is incorrect
		// http://dev.jqueryui.com/ticket/4469
		if ((ui.newHeader !== null) && (ui.newHeader.length !== 0)) {
			Globals.lastAccordionId = ui.newHeader.parent().attr('title');
		} else {
			Globals.lastAccordionId = null;
		}
	});

	// Pass -1 to close all (only possible with collapsible:true).
	$('#accordion').accordion('option', 'active', false);
	
	BlackhighlighterRead.addReveal = function(reveal, server) {

		var actualHash = common.actualHashForReveal(reveal);
		var claimedHash = common.claimedHashForReveal(reveal);

		if (actualHash != claimedHash) {
			throw 'Invalid certificate: content hash is ' + actualHash 
				+ ' while claimed hash is ' + claimedHash;
		}

		var numPlaceholdersForKey = 0;
		_.each(Globals.commit.spans, function (commitSpan) {
			if (commitSpan.sha256 == claimedHash) {
				numPlaceholdersForKey++;
			}
		});
		// warn user if certificate is useless, need better UI
		if (numPlaceholdersForKey === 0) {
			throw 'Certificate does not match any placeholders.';
		}
		if (numPlaceholdersForKey != reveal.redactions.length) {
			throw 'Certificate contains ' + reveal.redactions.length +
				' redactions for key when letter needs ' + 
				numPlaceholdersForKey + ' for that key';
		}
	
		if (server) {
			Globals.serverRevealsByHash[reveal.sha256] = reveal;
		} else {
			if (reveal.sha256 in Globals.serverRevealsByHash) {
				throw 'Local certificate already revealed on server.';
			} else if (reveal.sha256 in Globals.localRevealsByHash) {
				throw 'You have already revealed the local certificate.';
			} else {
				Globals.localRevealsByHash[reveal.sha256] = reveal;
			}
		}

		var namePart = reveal.name ? (': ' + reveal.name) : '';
		accordionHeaderForId(reveal.sha256).empty().append(
			'<span>' + (server ? 'Server Certificate' : 'Local Certificate') + namePart + '</span>');
		var spanPart = $('<span></span>');
		spanPart.append($('<p>' + JSON.stringify(reveal, null, ' ') + '</p>'));
		if (!server) {
			var buttonPart = $('<input type="button" value="Remove" name="' + reveal.sha256 + '"></input>');
			buttonPart.click(function() {
				BlackhighlighterRead.removeReveal(this.name);
				return true;
			});
			spanPart.append(buttonPart);
		}			
		accordionContentForId(reveal.sha256).empty().append(spanPart);
	};


	try {
		if (!_.isArray(PARAMS.reveals)) {
			throw "Expected server to give reveals[] as JSON array";
		}
		$.each(PARAMS.reveals, function(index, reveal) {
			BlackhighlighterRead.addReveal(reveal, true);
		});
	} catch(err) {
		throw 'Reveal posted on server did not pass client verification check: ' + err; 
	}
	
	
	// The user is allowed to type in or paste certificates.  For reasons of readability
	// and to give users the ability to easily extract individual certificates, we
	// accept a lot of non-JSON-parser-compatible stuff (like comments and arrays without
	// commas).  This function tries to reform the pseudo-JSON into real JSON.
	function tidyInputForJsonParser(pseudoJson) {
		if (!_.isString(pseudoJson)) {
			throw 'Passed a non-string into tidyInputForJsonParser';
		}
		
		var tidyJson = '';

		// start by removing comments and whitespace
		var inputLength = pseudoJson.length;
		var index = 0;
		var whitespacePending = false;
		var skipNext = false;
		var last = null;
		// NOTE: Internet Explorer doesn't allow array subscript access e.g. psuedoJson[0] (?)
		var current = (inputLength > 0) ? pseudoJson.charAt(0) : null;
		var next = undefined;
		function pushCharacter(ch) {
			if (ch == ' ' || ch == '\t' || ch == '\n') {
				whitespacePending = true;
			} else {
				if (whitespacePending && (tidyJson !== '')) {
					tidyJson += ' ';
					whitespacePending = false;
				}
				tidyJson += ch;
			}
		}
		function pushWhitespace() {
			// we strip out all whitespace for the moment...but we could collapse it
			if (false) {
				whitespacePending = true;
			}
		}
		function skipNextCharacter() {
			skipNext = true;
		}

		var topmostBraceCount = 0;
		var braceDepth = 0;
		var commaFound = undefined;
		
		var stringType = null;
		var commentType = null;		
		while (current !== null) {
			next = (index == inputLength-1) ? null : pseudoJson.charAt(index+1);

			if (skipNext) {
			
				skipNext = false;
				
			} else if (commentType !== null) {
			
				switch (commentType) {
					case '//':
						if (current == '\n') {
							commentType = null;
						}
						break;
						
					case '/*':
						if (current == '*' && next == '/') {
							skipNextCharacter();
							commentType = null;
						}
						break;
						
					default:
						throw 'Unknown comment type';
				}
				
			} else if (stringType !== null) {
			
				if (current == '\n') {
					throw 'End of line in middle of quote context';
				}
				
				if (current == '\\') {
					if (next == stringType) {
						// it's an escaped quote marker, so it needs to go into the
						// output stream... go ahead and write the escape and the
						// quote end and then skip the quote end so we don't
						// see it in our next iteration and think it's a real quote ending
						pushCharacter(current);
						pushCharacter(next);
						skipNextCharacter(); 
					} else {
						pushCharacter(current);
					}
				} else if (current == stringType) {
					pushCharacter(current);
					stringType = null;
				} else {
					pushCharacter(current);
				}
				
			} else {
			
				// general handling if we are not (yet) in a quote or in a string
				switch (current) {
					case '{':
						if (braceDepth === 0) {
							if (topmostBraceCount > 0) {
								if (!commaFound) {
									pushCharacter(',');
									pushWhitespace();
								}
								commaFound = undefined;
							}
							topmostBraceCount++;
						}
						braceDepth++;
						pushCharacter(current);
						break;

					case ',':
						if (!_.isUndefined(commaFound)) {
							commaFound = true;
						}
						pushCharacter(current);
						break;
						
					case '}':
						if (braceDepth === 0) {
							throw 'Bad brace nesting in Json input';
						} else {
							braceDepth--;
							if (braceDepth === 0) {
								commaFound = false;
							}
						}
						pushCharacter(current);
						break;
					
					case '"':
					case "'":
						stringType = current;
						pushCharacter(current);
						break;
						
					case '/':
						if (next == '*') {
							commentType = '/*';
							skipNextCharacter();
						} else if (next == '/') {
							commentType = '//';
							skipNextCharacter();
						} else {
							pushCharacter(current);
						}
						break;
						
					case '\n':
					case ' ':
					case '\t':
						pushWhitespace();
						break;
						
					default:
						pushCharacter(current);
						break;
				}
			}
			last = current;
			current = next;
			index++;
		}

		// if we have something like "{foo},{bar}", then ensure it has brackets e.g. "[{foo},{bar}]"
		if (topmostBraceCount > 1) {
			if (tidyJson[0] != '[') {
				tidyJson = '[' + tidyJson;
			}
			if (tidyJson[tidyJson.length-1] != ']') {
				tidyJson = tidyJson + ']';
			}
		}

		return tidyJson;
	}
	
	
	function updateTabEnables() {
		$('#tabs').tabs('enable', tabIndexForId('tabs-verify'));
		$('#tabs').tabs('enable', tabIndexForId('tabs-show'));

		// REVIEW: hasOwnProperty(), does it matter? http://yuiblog.com/blog/2006/09/26/for-in-intrigue/
		if (_.keys(Globals.localRevealsByHash).length > 0) {
			$('#tabs').tabs('enable', tabIndexForId('tabs-reveal'));
			$('#buttons-show-before').hide();			
			$('#buttons-show-after').show();
		} else {
			$('#tabs').tabs('disable', tabIndexForId('tabs-reveal'));
			$('#buttons-show-after').hide();			
			$('#buttons-show-before').show();
		}
	}
	
	updateTabEnables();
	
	var lastTabId = 'tabs-verify'; // we start on verify tab, and don't get a select message
	// Bind function for what happens on tab select
	$('#tabs').on('tabsactivate', function(event, ui) {

		switch(ui.newPanel.attr('id')) {
			case 'tabs-verify':
				$('#progress-verify').hide();
				clearErrorOnTab('verify');
				break;
			
			case 'tabs-show':		
				var revealIndices = {};
							
				function fillInPlaceholder(placeholder) {

					var shaHexDigest = placeholder.attr('title');

					if (!placeholder.hasClass('revealed')) {
						var publiclyRevealed = true;
						var reveal = Globals.serverRevealsByHash[shaHexDigest];
						if (!reveal) {
							publiclyRevealed = false;
							reveal = Globals.localRevealsByHash[shaHexDigest];
						}
						if (reveal) {
							if (!revealIndices[shaHexDigest]) {
								revealIndices[shaHexDigest] = 0;
							}
							placeholder.empty().append(document.createTextNode(reveal.redactions[revealIndices[shaHexDigest]]));
							revealIndices[shaHexDigest]++;

							placeholder.removeClass('protected');
							if (publiclyRevealed) {
								placeholder.addClass('revealed');
							} else {
								placeholder.addClass('verified');
							}
						}
					}

					// These reference links help to determine which reveal a placeholder is from,
					// which is useful in cases of multiple reveals (not currently supported in the UI)
					if (false) {
						var referenceLink = $('<span class="certlink" title="' + shaHexDigest + '"><sup>' + '[' +
							(accordionIndexForId(shaHexDigest)+1) + ']' + '</sup></span>');
						referenceLink.click(function() {
							// As per example #5, you can't make a closure using shaHexDigest here
							// http://blog.morrisjohns.com/javascript_closures_for_dummies
							// REVIEW: way to do this that frees up the title for something else?
							BlackhighlighterRead.viewReveal($(this).attr('title'));
							return true;
						});
						placeholder.after(referenceLink);
					}
				}

				// we used to convert the JSON into a public HTML fragment on the client side.
				// but server-side generation is better for running in non-javascript contexts.
				// and making it possible for search engines to index the letter.
				// Save what the server made in the beginning so that if we mess with it we
				// can restore it back.			
				$('#letter-text').empty().append(Globals.initialLetterText.clone());
				$('#letter-text').find('span').filter('.placeholder').each(function(i) {
					fillInPlaceholder($(this));		
				});				
				break;
		
			case 'tabs-reveal':
				clearErrorOnTab('reveal');
				$('#progress-reveal').hide();
				$('#json-reveal').empty().append(
					// REVIEW: used to sort values in array by key (hash), does this matter?
					document.createTextNode(JSON.stringify(_.values(Globals.localRevealsByHash), null, ' ')));
				break;
		
			case 'tabs-done':
				// nothing to do?
				break;

			default:
				throw 'no match for tab in read.js';
		}
		lastTabId = ui.newPanel.attr('id');
	});

	switch (PARAMS.tabstate) {
		case 'verify':
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-verify'));
			break;
			
		case 'show':
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-show'));
			break;
			
		default:
			throw 'invalid PARAMS.tabstate';
	}	

	BlackhighlighterRead.viewReveal = function(revealKey) {
		// first make sure we're on the verify tab
		$('#tabs').tabs('option', 'active', tabIndexForId('tabs-verify'));
		if (Globals.lastAccordionId != revealKey) {
			$('#accordion').accordion('activate', accordionIndexForId(revealKey));
		}
	};

	
	BlackhighlighterRead.removeReveal = function(revealKey) {
	
		if (!(revealKey in Globals.localRevealsByHash)) {
			throw 'Attempt to remove certificate that is not in the local list.';
		}
		
		delete Globals.localRevealsByHash[revealKey];

		accordionHeaderForId(revealKey).empty().append(
				'<span>' + 'Certificate not revealed' + '</span>');
		accordionContentForId(revealKey).empty().append(
				'<span>' + 'No information about this reveal available' + '</span>');
		
		updateTabEnables();
	};
	

	BlackhighlighterRead.previousStep = function() {
		$('#tabs').tabs('option', 'active', tabIndexForId(lastTabId) - 1);
	};


	BlackhighlighterRead.nextStep = function() {
		$('#tabs').tabs('option', 'active', tabIndexForId(lastTabId) + 1);
	};
	
	BlackhighlighterRead.clearRevealInputField = function() {
		$('#certificates').get(0).value = '';
	};
	
	function finalizeVerifyUI() {
		if (this.timerId !== null) {
			window.clearTimeout(this.timerId);
		}
		this.timerId = undefined;

		updateTabEnables();
		
		if (Globals.successfulVerify) {
			BlackhighlighterRead.clearRevealInputField();
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-show'));
		}
		
		$('#progress-verify').hide();
		$('#buttons-verify').show();
		
		Globals.successfulVerify = undefined;
	}
	finalizeVerifyUI.timerCallback = function() {
		this.timerId = null;
		if (Globals.successfulVerify) {
			finalizeVerifyUI();
		} // we expect the pending Ajax call to complete and reset this to undefined
	};
	finalizeVerifyUI.timerId = undefined;
	
	BlackhighlighterRead.verify = function() {
		clearErrorOnTab('verify');
	
		var revealInput = $('#certificates').get(0).value;
		if (common.trimAllWhitespace(revealInput) === '') {
			// if they haven't typed anything into the box
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-show'));
		} else {
			$('#tabs').tabs('disable', tabIndexForId('tabs-show'));
			$('#tabs').tabs('disable', tabIndexForId('tabs-reveal'));
			$('#progress-verify').show();
			$('#buttons-verify').hide();
			Globals.successfulVerify = false;
		
			// We set a timer to make sure there is enough of a delay that the
			// user feels confident that something actually happened
			finalizeVerifyUI.timerId = window.setTimeout(finalizeVerifyUI.timerCallback, 3000);

			var parsedJson = null;
			// Catch parsing errors and put them in an error message
			try {
				var tidyRevealText = tidyInputForJsonParser(revealInput);
				
				parsedJson = JSON.parse(tidyRevealText);	
			} catch(errParse) {
				notifyErrorOnTab('verify', errParse);
				// do not continue to next tab
				finalizeVerifyUI();
			}

			if (parsedJson) {
				try {
					var reveals = null;
					if (!_.isArray(parsedJson)) {
						reveals = [parsedJson];
					} else {
						reveals = parsedJson;
					}
					
					if (reveals.length > 1) {
						throw "User interface for multiple certificates is not currently available";
					}
					
					$.each(reveals, function(index, reveal) {
						BlackhighlighterRead.addReveal(reveal, false);
					});

					Globals.successfulVerify = true;
					if (finalizeVerifyUI.timerId === null) {
						finalizeVerifyUI();
					}
				} catch(errAdd) {
					notifyErrorOnTab('verify', errAdd);
					// do not continue to next tab
					finalizeVerifyUI();
				}
			}
		}
	};

	function finalizeRevealUI() {
		if (this.timerId !== null) {
			window.clearTimeout(this.timerId);
		}
		this.timerId = undefined;
		
		if (Globals.successfulReveal) {
			// We want to redirect to the "show" page for this letter
			// Which means we have to reload if we were already on the letter's "show" URL
			if (PARAMS.tabstate == 'show') {
				// Reload semantics vary in Java and browser versions
				// http://grizzlyweb.com/webmaster/javascripts/refresh.asp
				window.location.reload(true);
			} else {
				window.navigate(clientCommon.absoluteFromRelativeURL(PARAMS.show_url));
			}
		} else {
			$('#buttons-reveal').show();
			$('#tabs').tabs('enable', tabIndexForId('tabs-verify'));
			$('#tabs').tabs('enable', tabIndexForId('tabs-show'));
			
			// we only hide the progress bar in the error case, because otherwise we
			// want the animation to stick around until the redirect has completed
			$('#progress-reveal').hide();
		}
		
		Globals.successfulReveal = undefined;
	}
	finalizeRevealUI.timerCallback = function() {
		this.timerId = null;
		if (Globals.successfulReveal) {
			finalizeRevealUI();
		} // else we expect the pending Ajax call to complete and reset this to undefined
	};
	finalizeRevealUI.timerId = undefined;
	
	BlackhighlighterRead.reveal = function() {
	
		$('#tabs').tabs('disable', tabIndexForId('tabs-verify'));
		$('#tabs').tabs('disable', tabIndexForId('tabs-show'));

		// jquery UI does not support an indeterminate progress bar yet
		// http://docs.jquery.com/UI/API/1.7/Progressbar
		// Currently using an animated GIF from http://www.ajaxload.info/
		$('#progress-reveal').show();
		$('#buttons-reveal').hide();
		$('#reveal-json-accordion').hide();
		
		// We set a timer to make sure there is enough of a delay that the
		// user feels confident that something actually happened
		finalizeRevealUI.timerId = window.setTimeout(finalizeRevealUI.timerCallback, 3000);

		Globals.successfulReveal = false;

		// If there is more than one reveal in the UI, we'd need to have a
		// way to indicate which one we are revealing in the request.  (or
		// make multiple requests if we intend to do more than one).  For
		// protocol simplicity in error reporting, the server now accepts
		// only one reveal per XMLHttpRequest.
		if (_.keys(Globals.localRevealsByHash).length != 1) {
			throw 'Multiple reveals feature not currently supported by client';
		}
		
		// http://docs.jquery.com/Ajax/jQuery.ajax
		$.ajax({
			type: 'POST'
		,
			dataType: 'json' // expected response type from server
		,
			url: common.makeRevealUrl(PARAMS.base_url)
		,
			// sends as UTF-8
			data: {
				reveal: JSON.stringify(
					_.values(Globals.localRevealsByHash)[0], null, ' '
				)
			}
		,
			success: function(resultJson) {
				if (resultJson.error) {
					notifyErrorOnTab('reveal', resultJson.error.msg);
					finalizeRevealUI();
				} else {
					Globals.successfulReveal = true;
				}
				if (finalizeRevealUI.timerId === null) {
					finalizeRevealUI();
				}
			}
		,
			error: function (XMLHttpRequest, textStatus, errorThrown) {
				finalizeRevealUI();
				
				// "this" contains the options for this ajax request

				switch (textStatus) {
					case 'timeout':
						notifyErrorOnTab('reveal', 'The POST reveal request timed out on ' + PARAMS.reveal_url + 
							' --- check your network connection and try again.');
						break;
						
					case 'error':
						notifyErrorOnTab('reveal', 'There was an error with the web server during your request.');
						break;
						
					case 'notmodified':
					case 'parsererror':
						notifyErrorOnTab('reveal', 'Unexpected error code during Ajax POST: ' + textStatus);
						break;
						
					default:
						notifyErrorOnTab('reveal', 'Unexpected error code during Ajax POST: ' + textStatus);
						break;
				}
			}
		});
	};
	
	return BlackhighlighterRead;
});