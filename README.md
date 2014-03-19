![Blackhighlighter logo](https://raw.github.com/hostilefork/blackhighlighter/master/blackhighlighter-logo.png)

Black Highlighter is a tool for composing public posts on the Internet, which have some portions "blacked out" and blocked from view (e.g. ["redacted"](http://en.wikipedia.org/wiki/Redaction)).  During the composition process, no information is transmitted to the server where the message is to be posted.  The only plaintext it receives is the parts that have not been blacked out.

*But* the server does receive cryptographic signatures which "commit" to the content of the hidden portions (implemented via a ["commitment scheme"](http://en.wikipedia.org/wiki/Commitment_scheme)).  These signatures are calculated by unobfuscated JavaScript source that runs in the user's browser.  This again removes the reliance on trusting the server--which only receives enough information to verify the missing information is what was posted... *if* it is ever revealed.

When the posting process has been completed, the user receives the URL where their post has been made, as well as a textual "certificate" they must save.  The link is public, but the certificiate they can send to whatever specific recipients they wish.  Someone with the certificate who visits a link will be taken to the Black Highlighter server, where they may enter it to read the entire message.

Reading the missing portions and verifying they were the ones posted is done without sending the certificate to the server.  Once again, it is done entirely in client JavaScript in the browser.  However, Black Highlighter servers offer the opportunity for anyone with a valid certificate to reveal it publicly--with a warning that doing so is generally an etiquette violation for anyone but the original sender to do.

*(Note: Revealing a certificate for a message someone sends you shouldn't be the first resort of what to do with it.  Yet nevertheless, the ability for a recipient to do this is key to the accountability built-in to the Blackhighlighter protocol.)*

As an additional security step, the URL which is used to share Blackhighighter posts does not use a random number to identify it.  Rather, a cryptographic signature that is intimately tied to the committed content is contained in the URL.  This prevents a server operator from slipping in fake commitment signatures.

*(Note: Forging signatures wouldn't allow them to know the original missing content if it hadn't been revealed.  However if the link to the post were shared, and they manipulated the data at that link, it would let them make a fake revelation of the missing content appear legitimate to a reader.)*

Please see [http://blackhighlighter.hostilefork.com/](http://blackhighlighter.hostilefork.com) for philosophy, videos, and more articles about this project.


### NOTE ABOUT THE LICENSE

I'm a pretty strong believer in the Stallman-style of "Software Freedom".  It would be a better world if those who adapted free software (and then deployed it to users) would share their adaptations back with the community.  His arguments have always seemed pretty solid to me:

http://www.gnu.org/philosophy/shouldbefree.html

When this project was first started in 2009, I tended to err on the side of conservatism in using GPL-style licenses.  The AGPL closes the "hole" in the GPL so that giving access to a program running GPL code on a server requires provision of any source adaptations made in that case.

Yet at the same time, being able to borrow and recombine code without worrying about where it comes from is empowering to programmers.  Black Highlighter owes its existence to code from which copying and pasting could be done.  So being "unfriendly" about the license, in the sense of imposing concerns on people trying to solve a problem... is not my intention.  I just would like to be a little bit of a social agitator, so my own contributions are AGPL; for the moment.

But I'll back off if anyone writes me about it.  I don't have a legal department, and I don't sue anyone anyway.  So if you are interested in applying Blackhighlighter in your project--and the license is too restrictive and a barrier to doing so, please contact me.  I'd loosen it if there was a good reason to.  Note that as people like Jack Slocum have learned, it's better to relax a license than tighten it after you've set expectations in your community:

http://blog.hostilefork.com/extjs-licensing-fiasco/


### CONVENTIONS

Node.js directory structure chosen to follow this suggestion:

http://stackoverflow.com/questions/5178334/folder-structure-for-a-nodejs-project

Where I am given a choice, filenames use dashes for spaces:

http://www.codinghorror.com/blog/2006/04/of-spaces-underscores-and-dashes.html

JSON properties use underscores, consistent with the majority of popular APIs:

http://elasticsearch-users.115913.n3.nabble.com/JSON-API-CamelCase-or-td695216.html

At the moment I'm working on the Node.JS side with using the "comma first" convention.  To me, programs should be semantic graphs...and if they're textual then I think better ideas than commas exist (e.g. Rebol and Red).  But due to reasonings given here, I'm trying it out:

https://gist.github.com/isaacs/357981
