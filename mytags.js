require.paths.unshift('./node_modules');
var helpers = require('swig/lib/helpers');

//
// Though the documentation doesn't make it totally clear, your custom tag exports
// return code that will be evaluated.  If you want to insert in-place content
// for the template you need to append to the string variable named "_output".
// 
// https://github.com/paularmstrong/swig/blob/master/docs/custom-tags.md#custom-tags
//

// While Swig mimics Django's basic template syntax, it doesn't have the
// ability to do the "Don't-Repeat-Yourself" (DRY) principle of reversing
// a parsed URL back to the URL that originated it, as with Django's url
// template tag:
//
// https://docs.djangoproject.com/en/dev/ref/templates/builtins/#url
//
// I've added a simple substitute for the url tag, rather than hardcode
// urls into the templates.  Presumably some method for this kind of thing
// has been found.  UPDATE: found a post about it
//
//     http://stackoverflow.com/questions/10027574/express-js-reverse-url-route-django-style
//
exports.url = function (indent, parentBlock, parser) {
	/*var myArg = '';
	if (args.length == 2) {
		myArg = parser.parseVariable(this.args[1]);
	}*/
    output = []; // causes some awful nested expansion problem, don't understand it
	/* output.push(helpers.setVar('__myArg', myArg)); */
	
	var myArg = '';
    output.push('_output += "http://blackhighlighter.hostilefork.cloudfoundry.me/";'); // temporary
	switch (this.args[0]) {
		case 'blackhighlighter.views.commit':
			output.push('_output += "commit/";');
			break;
		case 'blackhighlighter.views.reveal':
			output.push('_output += "reveal/";');
			break;
		case 'blackhighlighter.views.show':
			output.push('_output += "show/";');
			myArg = parser.parseVariable(this.args[1]);
			output.push(helpers.setVar('__myArg', myArg));
			output.push('_output += __myArg + "/";');
			break;
		case 'blackhighlighter.views.verify':
			output.push('_output += "verify/";');
			myArg = parser.parseVariable(this.args[1]);
			output.push(helpers.setVar('__myArg', myArg));
			output.push('_output += __myArg + "/";');
			break;
		default:
			output.push('_output += "INCOMPLETE_MYTAGS_JS_IMPLEMENTATION/";');
			break;
	}
		
    return output.join('');
};
exports.url.ends = false;


// Paul Armstrong has said he does not want Swig to include Django's multi-line
// comment by default, due to efficiency problems Swig has in implementing this
// with a tag...instead he has in a recent branch added multi-line comments
// using the {# text of comment here #} syntax:
//
//     https://github.com/paularmstrong/swig/issues/31
//
// If one is more concerned about compatibility than efficiency, it is technically
// possible to implement a trivial comment tag by running no code.
exports.comment = function (indent, parentBlock, parser) {
    return '';
};
exports.comment.ends = true;