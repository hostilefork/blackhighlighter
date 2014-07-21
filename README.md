![Blackhighlighter logo](https://raw.github.com/hostilefork/blackhighlighter/master/blackhighlighter-logo.png)

Blackhighlighter combines novel editing with in-browser cryptography to facilitate new ways of communicating.  It is packaged as a jQuery widget *(with no other dependencies)*, along with a server library that can be integrated into Node.JS projects as an [npm module](https://www.npmjs.org/package/blackhighlighter).

The best way to understand the idea is to see a running demo of a site that incorporates it.  So please visit:

http://blackhighlighter.org

For philosophy, videos, and more articles about the project, see [http://blackhighlighter.hostilefork.com/](http://blackhighlighter.hostilefork.com).


# THIS PACKAGE

This package contains two key source files:

* `blackhighlighter.js` - The server side logic for committing, retreiving, and revealing blackhighlighter commits.  Commits are stored in a MongoDB database.

* `jquery-blackhighlighter/jquery-blackhighlighter.js` - Code implementing the jQuery widget, as well as shared code loaded as a dependency by blackhighlighter.js.  In order to avoid an *actual* dependency on jQuery in the Node code, a "fake" stub is loaded server-side (jquery-fake.js).

The 1.0 goal is to release a functional letter-writing service built on the blackhighlighter package.  That is currently the demo service at blackhighlighter.org; which has a GitHub repository here:

https://github.com/hostilefork/blackhighlighter.org


# USAGE

To include and configure blackhighlighter on the server side, you will need a [MongoDB database URI](http://api.mongodb.org/java/current/com/mongodb/MongoURI.html) where commits and reveals will be read/written:

    var blackhighlighter = require('blackhighlighter');

    blackhighlighter.configure({
        mongoConnectURI: "http://..."
    });

You can serve the `jquery-blackhighlighter.js` and `jquery-blackhighlighter.css` files from directly inside of `./node_modules/blackhighlighter`.  The path to those files is given with `blackhighlighter.pathForJqueryBlackhighlighter()`.  So for instance:

    app.use("/public/js/jquery-blackhighlighter",
        express.static(blackhighlighter.pathForJqueryBlackhighlighter())
    );

For the moment, there are expectations on the URL suffixes of the REST services hardcoded in the widget (relative to a `base_url` you pass it).  See this issue for discussion:

https://github.com/hostilefork/blackhighlighter/issues/57

Thus the way to try using blackhighlighter in your project is essentially "do what the demo does".  A good first start would be to get the demo working and understand it.

Going forward past 1.0, the API is adapting so that the widget can integrate more easily into other applications with a different workflow from blackhighlighter.org.  Feedback is  welcome.
