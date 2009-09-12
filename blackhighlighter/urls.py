# This is a "urls module" for the django framework
# http://docs.djangoproject.com/en/dev/topics/http/urls/

#
# blackhighlighter/urls.py - url module for reading, writing, and verifying letters
# Copyright (C) 2009 HostileFork.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
#   See http://hostilefork.com/blackhighlighter for documentation.
#

# Letter templates expect the following named URLs to be declared by the hosting URL scheme
#
# 	homepage-named_url
#	credits-named_url
#	network-named_url
#	cryptography-named_url
#	certificates-named-url
#	legal-named_url

from django.conf.urls.defaults import *
from django.conf import settings

urlpatterns = patterns('',
	#
	# HTTP GET
	#
	url(r'^write/$', 'blackhighlighter.views.write'),
	url(r'^verify/(?P<letter_uuid>[0-9a-f]+)/$', 'blackhighlighter.views.verify'),
	url(r'^show/(?P<letter_uuid>[0-9a-f]+)/$', 'blackhighlighter.views.show'),

	#
	# HTTP POST
	#
	url(r'^reveal/(?P<letter_uuid>[0-9a-f]+)/$', 'blackhighlighter.views.reveal'),
	url(r'^commit/(?P<letter_uuid>[0-9a-f]+)/$', 'blackhighlighter.views.commit'),
)