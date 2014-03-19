//
// We want the shared exports code in jquery.blackhighlighter,
// but we don't want to introduce a dependency on jQuery on the
// server-side to get it.  A "fake" jQuery is the path of least
// resistance, as far as I can tell -- no reason to install the
// whole jQuery NPM package!
//
// http://stackoverflow.com/a/22474864/211160
//

define(function() {
    return {isFakeJquery: true};
});
