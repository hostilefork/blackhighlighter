# This is a django context processing module
# http://www.b-list.org/weblog/2006/jun/14/django-tips-template-context-processors/
# http://docs.djangoproject.com/en/dev/ref/templates/api/#id1

#
# context_processors.py - Adds python parameters that can be read in templates
# Copyright (C) 2009 HostileFork.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
#   See http://hostilefork.com/blackhighlighter for documentation.
#

# "def media(request):" was obsoleted by django.core.context_processors.media_url
# http://code.djangoproject.com/changeset/5379

from django.conf import settings


# For reasons of security it is not advised to serve pages out of your 
# code directory, so you are supposed to copy (or symlink) all of the 
# media that ships with a django app to underneath your MEDIA_URL 
# directory hierarchy
#
# To keep things clean, you can put the media that ships with the 
# app in /blackhighlighter/media/ to MEDIA_URL/blackhighlighter/
# This is the default, although you can set it to anything you want
# via BLACKHIGHLIGHTER_MEDIA_URL...
def blackhighlighter_media(request):
	# http://stackoverflow.com/questions/610883/how-to-know-if-an-object-has-an-attribute-in-python
	# I disagree that this is an appropriate case for exception handling
	if hasattr(settings, 'BLACKHIGHLIGHTER_MEDIA_URL'):
		return {'BLACKHIGHLIGHTER_MEDIA_URL' : settings.BLACKHIGHLIGHTER_MEDIA_URL}
	return {'BLACKHIGHLIGHTER_MEDIA_URL': settings.MEDIA_URL + 'blackhighlighter/'}


# Because they are not part of the distribution I like to serve JavaScript
# libs from a separate directory.  If you do not configure this, it will
# default to just being the MEDIA_URL.
def libs(request):
	# http://stackoverflow.com/questions/610883/how-to-know-if-an-object-has-an-attribute-in-python
	# I disagree that this is an appropriate case for exception handling
	if hasattr(settings, 'LIBS_URL'):
		return {'LIBS_URL': settings.LIBS_URL}
	return {'LIBS_URL': settings.MEDIA_URL }