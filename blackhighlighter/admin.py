# This is an "admin module" for the django framework
# http://docs.djangoproject.com/en/dev/intro/tutorial02/
# http://docs.djangoproject.com/en/dev/ref/contrib/admin/

#
# blackhighlighter/admin.py - letters administration module
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

from django.contrib import admin

from blackhighlighter.models import Letter, Reveal, Redaction

# Ideal interface would be Nested Inlines, not currently supported
# http://groups.google.com/group/django-developers/browse_thread/thread/7912f4871d23f985/60e33cf2fb8c4e33 

class RedactionInline(admin.StackedInline):
	model = Redaction
	extra = 0

class RevealInline(admin.StackedInline):
	model = Reveal
	extra = 0

class LetterAdmin(admin.ModelAdmin):
	model = Letter
	fieldsets = [
		('Date information', {'fields': ['commit_date']}),
	]
	inlines = [RevealInline, RedactionInline,]

admin.site.register(Letter, LetterAdmin)
