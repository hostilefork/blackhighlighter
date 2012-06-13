// See notes about require.paths.unshift in app.js
//
// require.paths.unshift('./node_modules');

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
// the site url into the templates.  The actual generation of derived
// URLs from that is done by shared JavaScript now in client-server-common.js
// although I don't know what the long term solution should be.  Here's
// some notes on DRY route reversal in express to be like Django:
//
//     http://stackoverflow.com/questions/10027574/express-js-reverse-url-route-django-style
//
exports.url = function (indent, parentBlock, parser) {
	// You don't output a string which represents the content you want to inject
	// into the template, rather a string that contains JavaScript code that
	// puts the content into a variable named "_output".  WHY is this variable
	// name a hardcoded implicit thing and not something provided by:
    //     https://github.com/paularmstrong/swig/blob/master/lib/helpers.js	
	var outputVarName = '_output';
    var output = [];
	
	if ((this.args.length === 1) && (this.args[0] == 'blackhighlighter.views.base')) {
		// In theory, this should get information out of the cloud foundry
		// site configuration, as with process.env.VCAP_SERVICES parsing,
		// but I'm not sure where in the environment to find this url.
		output.push(outputVarName + ' += "http://blackhighlighter.cloudfoundry.com/";');
	} else {
		// Exceptions would be ideal, but that's still getting sorted out
		// For the moment, this finds the smoking gun more quickly
		output.push(outputVarName + ' += "http://blackhighlighter.cloudfoundry.com/docs/notimplemented/";');
	}
    return output.join('');
};
exports.url.ends = false; // no ending tag


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
exports.comment.ends = true; // needs ending tag