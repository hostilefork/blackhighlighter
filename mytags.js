// See notes about require.paths.unshift in app.js
//
// require.paths.unshift('./node_modules');

var utils = require('swig/lib/utils');


//
// There is a rather thin overview page documenting how to extend Swig tags:
//
//     http://paularmstrong.github.io/swig/docs/extending/#tags
//
// Mostly you are expected to click through to the source of how the tags
// that are included by default are implemented, as they work the same way.
//
//     https://github.com/paularmstrong/swig/tree/master/lib/tags
//
// It doesn't make clear what the division of responsibility is, but in the
// case of something like:
//
//     {% footag blah 10 20 %}
//     some stuff
//     {% end footag %}
//
// The "parse" function that sees "blah 10 20", but not "some stuff".  It
// is supposed to take an action sequence of calls to this.out.push() which
// would in this case likely be called three times, to produce an array
// like ["blah" 10 20].
//
// By contrast, the "compile" function can see "some stuff" in-between the
// tags...but not the input string.  Instead it gets what "parse" had pushed
// passed in as the "args" parameter.
//
// Offhand I'm not sure exactly what the consequences would be of using a
// parse function that just wrote "this.out.push(str);" and returned true,
// then putting all the work in the compile function.  It is presumably
// for some kind of caching or memoization, but I don't know the shape of
// that or what it buys. 
// 
// If rather than just looking at the str passed to "parse" yourself, you
// choose to utilize the parser that is passed in... you should know that
// the fields of the captured tokens are:
//
// * "match" - the matched data
//
// * "type" - something from this list:
// 
//     https://github.com/paularmstrong/swig/blob/87bc42b53d9e9a7c035ce0c9dd49916e685285f5/lib/lexer.js#L16
//
// * "length" - length of matched data (presumably redundant, to avoid recalc)
//
// When it says types.STRING it means something literally enclosed in quotes.
// An unquoted token will be presented as types.VAR
//


//
// This implements things of the form:
//
// {% url arg %}
//
// While Swig mimics Django's basic template syntax, it doesn't have the
// ability to do the "Don't-Repeat-Yourself" (DRY) principle of reversing
// a parsed URL back to the URL that originated it, as with Django's url
// template tag:
//
// https://docs.djangoproject.com/en/dev/ref/templates/builtins/#url
//
// I've started a simple substitute for the url tag, rather than hardcode
// the site url into the templates.  The actual generation of derived
// URLs from that is done by shared JavaScript now in client-server-common.js
// although I don't know what the long term solution should be.  Here's
// some notes on DRY route reversal in express to be like Django:
//
// http://stackoverflow.com/questions/10027574/
//
exports.url = {
	parse: function (str, line, parser, types, options) {
		parser.on('start', function() {
			// Don't technically need this, just leaving it in as a
			// reminder that the start method exists
		});

		parser.on("*", function(token) {
			if (token.type != types.VAR) {
				utils.throwError(
					"{% url %} bad token in " + str +
					": " + JSON.stringify(token)
				);
			}
			this.out.push(token.match);
		});

		parser.on('end', function() {
			// Don't technically need this, just leaving it in as a
			// reminder that the end method exists
		});

		return true;
	},

	compile: function (compiler, args, content, parents, options, blockName) {
		if (args.length == 0) {
			utils.throwError("url tag requires an argument");
		}

		// In theory, this should get information out of process.env
		// Revisit when it's time to fix
		var baseUrl = "http://blackhighlighter.nodejitsu.com";
		var needsLetterId = false;

		switch (args[0]) {
		case 'blackhighlighter.views.base':
			if (args.length != 1) {
				utils.throwError(args[0] + " has no captures");
			}
			break;

		case 'blackhighlighter.views.show':
			if (args.length != 1) {
				utils.throwError(args[0] + " requires a letter_uuid");
			}

			baseUrl += "/show/";
			needsLetterId = true;
			break;

		case 'blackhighlighter.views.verify':
			if (args.length != 1) {
				utils.throwError(args[0] + " requires a letter_uuid");
			}

			baseUrl += "/verify/";
			needsLetterId = true;
			break;

		case 'blackhighlighter.views.commit':
			if (args.length != 1) {
				utils.throwError(args[0] + " requires a letter_uuid");
			}

			baseUrl += "/commit/";
			needsLetterId = true;
			break;

		default:
			baseUrl += "/not/implemented/yet/see/mytag.js/" + args[0];
			break;

		}

		var codeString = '_output += "' + baseUrl + '";';
		if (needsLetterId) {
			codeString += '_output += letter_uuid;';
		}

		return codeString;
	},

	ends: false // no ending tag
};


//
// This implements things of the form:
//
// {% comment %}
//     multi
//     line
// {% end comment %}
//
// Paul Armstrong has said he does not want Swig to include Django's multi-line
// comment by default, due to efficiency problems Swig has in implementing this
// with a tag.  Instead he has in a recent branch added multi-line comments
// using the {# text of comment here #} syntax:
//
//     https://github.com/paularmstrong/swig/issues/31
//
// Because I was trying to keep the Django variant of blackhighlighter running,
// and already had another custom tag, I decided to go ahead and take a crack
// at implementing this simple one.
//
exports.comment = {
	parse: function (str, line, parser, types, options) {
		parser.on("*", function(token) {
			utils.throwError("{% comment %} tag takes no arguments");
		});

		return true;
	},

	compile: function (compiler, args, content, parents, options, blockName) {
		// No code to add to affect _output, so empty string
		return '';
	},

	ends: true // needs ending tag
};
