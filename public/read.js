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
//   See http://blackhighlighter.hostilefork.com for documentation.
//

// Whole-script strict mode syntax
"use strict";

define([
	// libs which return exported objects to capture in the function prototype
	'jquery',
	'underscore',
	'blackhighlighter',
	'client-common',

	// these libs have no results, they just add to the environment (via shims)
	'jqueryui',
	'expanding',
	'actual'
], function($, _, blackhighlighter, clientCommon) {

	// We used to pass in a base URL in PARAMS.base_url, but now we go off
	// of the browser's hostname and port for that...we could conceivably
	// check to make sure the server and client are in agreement of what
	// the server's base url is.
	var base_url = "http://" + document.location.host + "/";

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
	
	// jquery UI does tabs by index, not ID - using this to increase readability
	// NOTE: a function as opposed to a raw map for consistency with
	// accordionIndexForId
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
	
	$(window).resize(clientCommon.resizeListener);

	clientCommon.resizeListener(null);

	function notifyErrorOnTab(tabname, err) {
		var $tab = $("#tabs-" + tabname);
		var message = "<span><b>" + err.toString() + "</b></span>";

		if (err instanceof Error) {
			var stack = err.stack.split("\n");
			message += "<br><br><ul><li>" 
				+ stack.join("</li><li>")
				+ "</li></ul>"
				+ "<br><br>" 
				+ 'Please save a copy of this error and report it to <a href="https://github.com/hostilefork/blackhighlighter/issues/new">the Blackhighlighter Issue Tracker</a> on GitHub!';
		} 

		$tab.find(".error-display-msg").empty().html(message);
		$tab.find('.error-display').show();
	}
	
	function clearErrorOnTab(tabname) {
		var $tab = $("#tabs-" + tabname);
		$tab.find('.error-display').hide();
	}

	function updateTabEnables() {
		$('#tabs').tabs('enable', tabIndexForId('tabs-verify'));
		$('#tabs').tabs('enable', tabIndexForId('tabs-show'));

		var protections = $("#editor").blackhighlighter('option', 'protected');

		if (_.values(protections).length) {
			$('#tabs').tabs('enable', tabIndexForId('tabs-reveal'));
			$('#buttons-show-before').hide();			
			$('#buttons-show-after').show();
		} else {
			$('#tabs').tabs('disable', tabIndexForId('tabs-reveal'));
			$('#buttons-show-after').hide();			
			$('#buttons-show-before').show();
		}
	}

	$("#editor").blackhighlighter({
		mode: 'show',
		commit: PARAMS.commit,
		update: updateTabEnables
	});

	try {
		if (!_.isArray(PARAMS.reveals)) {
			throw "Expected server to give reveals[] as JSON array";
		}
		$("#editor").blackhighlighter('verify', PARAMS.reveals, true);
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
		
	updateTabEnables();
	
	var lastTabId = 'tabs-verify'; // we start on verify tab, and don't get a select message
	// Bind function for what happens on tab select
	$('#tabs').on('tabsbeforeactivate', function(event, ui) {

		var $editor = $("#editor");

		switch(ui.newPanel.attr('id')) {
			case 'tabs-verify':
				clearErrorOnTab('verify');
				break;
			
			case 'tabs-show':		
				// Shouldn't have to do anything?
				$("#tabs-show .textarea-wrapper").append(
					$editor.detach()
				);
				$editor.blackhighlighter('option', 'mode', 'show');
				break;
		
			case 'tabs-reveal':
				clearErrorOnTab('reveal');
				$("#tabs-reveal .textarea-wrapper").append(
					$editor.detach()
				);
				$editor.blackhighlighter('option', 'mode', 'reveal');

				var protections = $("#editor").blackhighlighter("option", "protected");
				// REVIEW: used to sort values in array by key (hash)
				// Does it matter?  Should there be a "canonized" ordering?
				$('#json-reveal').text(
					JSON.stringify(_.values(protections), null, ' ')
				);
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

/*
	function showRevealInTab(revealKey) {
		// first make sure we're on the verify tab
		$('#tabs').tabs('option', 'active', tabIndexForId('tabs-verify'));
		if (Globals.lastAccordionId != revealKey) {
			$('#accordion').accordion('activate', accordionIndexForId(revealKey));
		}
	};
	*/

	$(".previous-step").on('click', function(event) {
		$('#tabs').tabs('option', 'active', tabIndexForId(lastTabId) - 1);
	});

	$(".next-step").on('click', function(event) {
		$('#tabs').tabs('option', 'active', tabIndexForId(lastTabId) + 1);
	});
	
	$("#verify-button").on('click', function() {

		var finalizeVerifyUI = _.debounce(function(err) {
			updateTabEnables();
			
			if (err) {
				notifyErrorOnTab('verify', err);
			} else {
				$('#certificates').val('');
				$('#tabs').tabs('option', 'active', tabIndexForId('tabs-show'));
			}
			
			$('#progress-verify').hide();
			$('#buttons-verify').show();
		}, 2000);

		clearErrorOnTab('verify');
	
		var revealInput = $('#certificates').get(0).value;
		if (blackhighlighter.trimAllWhitespace(revealInput) === '') {
			// if they haven't typed anything into the box
			$('#tabs').tabs('option', 'active', tabIndexForId('tabs-show'));
		} else {
			$('#tabs').tabs('disable', tabIndexForId('tabs-show'));
			$('#tabs').tabs('disable', tabIndexForId('tabs-reveal'));
			$('#progress-verify').show();
			$('#buttons-verify').hide();

			var tidyRevealText = tidyInputForJsonParser(revealInput);
			if (!tidyRevealText) {
				finalizeVerifyUI(Error("No certificates provided."));
				return;
			}

			// Catch parsing errors and put them in an error message
			try {
				var certificate = $("#editor").blackhighlighter(
					"certificate", 'decode', tidyRevealText
				);
					
				$("#editor").blackhighlighter('verify', 
					certificate.reveals, false
				);

				finalizeVerifyUI(null);

			} catch (err) {
				// do not continue to next tab
				finalizeVerifyUI(err);
			}
		}
	});

/*			var namePart = reveal.name ? (': ' + reveal.name) : '';
			accordionHeaderForId(reveal.sha256).empty().append(
				'<span>' + (server ? 'Server Certificate' : 'Local Certificate') + namePart + '</span>');
			var spanPart = $('<span></span>');
			spanPart.append($('<p>' + JSON.stringify(reveal, null, ' ') + '</p>'));
			if (!server) {
				var buttonPart = $('<input type="button" value="Remove" name="' + reveal.sha256 + '"></input>');
				buttonPart.click(function() {
					this.$div.removeBlackhighlighterReveal(this.name);
					return true;
				});
				spanPart.append(buttonPart);
			}			
			accordionContentForId(reveal.sha256).empty().append(spanPart);*/


	$("#reveal-button").on('click', function(event) {

		var finalizeRevealUI = _.debounce(function (err) {
			function absoluteFromRelativeURL(url) {
				// http://objectmix.com/javascript/352627-relative-url-absolute-url.html
				return $('<a href="' + url + '"></a>').get(0).href;
			}

			if (err) {
				notifyErrorOnTab('reveal', err);
				$('#buttons-reveal').show();
				$('#tabs').tabs('enable', tabIndexForId('tabs-verify'));
				$('#tabs').tabs('enable', tabIndexForId('tabs-show'));
				
				// we only hide the progress bar in the error case, because 
				// otherwise we want the animation to stick around until the
				// redirect has completed
				$('#progress-reveal').hide();
			} else {
				// We want to redirect to the "show" page for this letter
				// Which means we have to reload if we were already on the
				// letter's "show" URL
				if (PARAMS.tabstate == 'show') {
					// Reload semantics vary in JavaScript and browser versions
					// http://grizzlyweb.com/webmaster/javascripts/refresh.asp
					window.location.reload(true);
				} else {
					// http://stackoverflow.com/a/948242/211160
					windowlocation.href =
						blackhighlighter.makeShowUrl(
							base_url, PARAMS.commit.commit_id
						);
				}
			}
		}, 2000);

		$('#tabs').tabs('disable', tabIndexForId('tabs-verify'));
		$('#tabs').tabs('disable', tabIndexForId('tabs-show'));

		$('#progress-reveal').show();
		$('#buttons-reveal').hide();
		$('#reveal-json-accordion').hide();
		
		$('#editor').blackhighlighter(
			'reveal', base_url, finalizeRevealUI
		);
	});
});
