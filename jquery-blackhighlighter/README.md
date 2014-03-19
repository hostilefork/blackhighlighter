### jquery-blackhighlighter

In 2009 the blackhighlighter system was somewhat monolithic, without any concept that you would be able to embed the widget onto sites other than blackhighlighter.com.  However, the jQuery plugin ecology blossomed, and it began to make sense to try and rope off "just the functionality" of giving the blackhighlighter behavior to a div on any page.


### Dependencies

The dependencies for the plugin have been minimized to *only* jQuery, so you should be able to put blackhighlighter widgets into any page that uses jQuery.

You can also include the plugin in environments like Node.JS that do not have jQuery available, if all you want is the common functions offered by `.exports`.  These are written in raw JavaScript and used by the blackhighlighter server.


### Minification

At time of writing this initial README, there is no automatic toolchain step for minification.  Hence `jquery-blackhighlighter.min.js` is generated manually, and may be out of date.  Making it a part of a pre-checkin build & test step is a line item in GitHub:

https://github.com/hostilefork/blackhighlighter/issues/40


### API

Initialization is always done on an existing `div`.  If your div has `id="myid"`, then starting a widget is as easy as:

    $('#myid').blackhighlighter({mode: 'edit'});

Central is that there are four "modes" for a blackhighlighter widget: `edit`, `protect`, `show`, and `reveal`.  The behaviors of these modes are laid out methodically in the sandbox demo.  However, the widget can switch modes in place, via the mode option, such as with:

    $('#myid').blackhighlighter('option', 'mode', 'protect');

The API is patterned somewhat after jQuery-UI, under the assumption that they know what they're doing.  So properties of the widget are exposed under 'option', methods are done by strings other than 'option' as the first parameter.

Details are subject to change, and feedback is welcome.
