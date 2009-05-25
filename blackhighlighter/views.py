# This is a "view module" for the django framework
# http://docs.djangoproject.com/en/dev/intro/tutorial03/

#
# blackhighlighter/views.py - Letters view module for reading/writing/verifying
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

from django.http import HttpResponse, Http404, HttpResponseRedirect

# http://www.b-list.org/weblog/2007/nov/10/unicode/
# http://code.djangoproject.com/wiki/UnicodeBranch#PortingApplicationsTheQuickChecklist
from django.utils.encoding import smart_unicode

# http://abing.gotdns.com/posts/2008/undocumented-django-urlresolversreverse-gotcha/
from django.core.urlresolvers import reverse

#from django.template import Context
#http://www.b-list.org/weblog/2006/jun/14/django-tips-template-context-processors/
from django.template import RequestContext
from django.template import loader

from blackhighlighter.models import Letter, Reveal, Redaction

from traceback import format_exception_only

import hashlib
import datetime
import string

# http://code.activestate.com/recipes/213761/
# "A uuid module is included in python 2.5+. 
#  2.3 and 2.4 users can get the module from http://zesty.ca/python/"
import uuid

# TODO: for the moment I am not using shortcuts so I can understand what's going on
# may want to try them later:
#   render_to_response and get_object_or_404

# http://docs.python.org/library/json.html
import json


# Currently the Ajax APIs return JSON
def HttpJsonErrorForException(type, inst):
	# http://mail.python.org/pipermail/python-list/2003-December/239281.html
	exception_msg = ''
	for exception_str in format_exception_only(type, inst):
		# REVIEW: should we rstrip('\n') to get rid of newlines?
		exception_msg += exception_str
		
	# Don't serve JSON as HTML: http://jibbering.com/blog/?p=514
	return HttpResponse(json.dumps({'error': {'code' : 200, 'msg' : exception_msg}}, sort_keys=True, indent=4), 'application/json')


# Django docs say:
#
# "Always return an HttpResponseRedirect after successfully dealing
# with POST data. This prevents data from being posted twice if a
# user hits the Back button."
#
# But this is an Ajax-called API.  W.r.t. POST-REQUEST-GET pattern (PRG)
# 
# "In situations where you use AJAX the whole PRG issue becomes a 
#  new story. AJAX responses don't appear in the history, you wouldn't 
#  want to bookmark them and refreshing a web page does not re-issue 
#  any AJAX requests (except those fired on page load). Therefore I 
#  have no problem with returning entitiest (HTML fragments, JSON, XML) 
#  from AJAX POSTs - PRG is not of much use here."
#
# 	http://blog.andreloker.de/post/2008/06/Post-Redirect-Get.aspx
def HttpJsonPostResponse(response):
	# Don't serve JSON as HTML: http://jibbering.com/blog/?p=514
	return HttpResponse(json.dumps(response, sort_keys=True, indent=4), 'application/json')


# Common routine for verify and show, only difference is tabstate
def read(request, letter_uuid, tabstate):
	try:
		readLetter = Letter.objects.get(uuid=letter_uuid)
	except Letter.DoesNotExist:
		raise Http404

	# Regenerates the commit and currently revealed certificates from the tabular
	# database,..
	commitJson = {
		'url': reverse('blackhighlighter.views.show', args=[readLetter.uuid]),
		'spans': []
	}
	revealJsonMap = {}
	public_html = ''

	# iterate through segments, and for each one that has not been
	# unredacted produce some clever html that makes an appropriate
	# "blacked out bit".  

	# REVIEW: for each one that has been unredacted make
	# a hovery bit so that you can get a tip on when it was made public?
	# how will auditing be done?

	for redaction in readLetter.redaction_set.order_by('order'):
		if redaction.reveal.revealed and (redaction.reveal.reveal_date == readLetter.commit_date):
			# u'\u00A0' is the non breaking space, should be preserved in db strings via UTF8
			commitJson['spans'].append(redaction.contents)
			public_html += redaction.contents
		else:
			# using the actual length is very physical but may reveal more than we'd like
			# encourage people to pad?
			commitJson['spans'].append({
				'sha256': redaction.reveal.sha256,
				'displayLength': redaction.length
			})
			
			if redaction.reveal.revealed:
				public_html += '<span class="placeholder revealed" title="' + redaction.reveal.sha256 + '">' + redaction.contents + '</span>';
			else:
				# is this faster than appending ? a bunch of times, or not?
				placeholderText = string.replace(string.zfill("0", redaction.length), '0', '?') 
				public_html += '<span class="placeholder protected" title="' + redaction.reveal.sha256 + '">' + placeholderText + '</span>';

		if redaction.reveal.revealed and (redaction.reveal.reveal_date <> readLetter.commit_date):
			if not redaction.reveal.sha256 in revealJsonMap:
				revealJsonMap[redaction.reveal.sha256] = {
					'url': reverse('blackhighlighter.views.verify', args=[readLetter.uuid]),
					'sha256': redaction.reveal.sha256,
					'salt': redaction.reveal.salt,
					'redactions': []
				}

			revealJsonMap[redaction.reveal.sha256]['redactions'].append(redaction.contents)

	# Javascript code expects array of reveal objects, not a map
	revealJsons = []
	for key, value in revealJsonMap.iteritems():
		revealJsons.append(value)
	
	# Server-side page generation makes an HTML blob for each reveal, so we have to pass in the set
	# NOTE: no "__ne" or not equal for filter()... you use exclude
	# 	http://osdir.com/ml/python.django.devel/2006-03/msg00345.html
	# REVIEW: javascript client expects to be in hash sorted order in order to keep certificate #s 
	# consistent, since we do not currently store a "number".  Should we?  Or user-given unique names?
	revealsDb = readLetter.reveal_set.exclude(reveal_date=readLetter.commit_date).order_by('sha256')
	
	t = loader.get_template('read.html')
	c = RequestContext(request, {
		'letter_uuid': letter_uuid,
		'revealsDb': revealsDb,
		'tabstate': tabstate,
		'commit' : json.dumps(commitJson),
		'reveals' : json.dumps(revealJsons),
		'public_html': public_html,
	})
	return HttpResponse(t.render(c))


# Entry point to read view with user on the tab that lets them enter certificates
def verify(request, letter_uuid):
	return read(request, letter_uuid, 'verify')


# Entry point to read view with user on the tab that shows the letter
def show(request, letter_uuid):
	return read(request, letter_uuid, 'show')


def write(request):
	# http://zesty.ca/python/uuid.html
	letter_uuid = uuid.uuid1()

	# remove hyphens from UUID
	letter_uuid_str = smart_unicode(letter_uuid).replace('-', '')
	
	t = loader.get_template('write.html')
	c = RequestContext(request, {
		'letter_uuid' : letter_uuid_str
	})
	return HttpResponse(t.render(c))


def uuid_from_url(url):
	ret = url 
	
	# URL may end with '/', get rid of it...
	if (len(ret) > 0) and (ret[len(ret)-1] == '/'):
		ret = ret[0:len(ret)-1]
	return ret[ret.rfind('/')+1:len(ret)]


# Commit is an HTTP post callback
# We are given only the content and the redaction hashes
# Use site for up-to-date samples of incoming MSG format
def commit(request, letter_uuid):
	try:
		
		commitJson = json.loads(request.POST['commit'])
		
		uuid = uuid_from_url(commitJson['url'])
		if (uuid != letter_uuid):
			raise Exception('UUID passed in POST %s does not match UUID in envelope %s' % letter_uuid % uuid)

		# should we check to make sure the date in the request matches so we are on
		# the same page as the client?	
		postDate = datetime.datetime.now()
		commitLetter = Letter(uuid=letter_uuid, commit_date=postDate)
	
		# REVIEW: catch exceptions and delete records?  transactions?
		# http://groups.google.com/group/django-users/browse_thread/thread/3ed0984528a40409
		commitLetter.save()

		# one "reveal" is actually revealed instantly, this just smooths the implementation
		# to find this "root reveal" just look for a reveal date identical to the letter publication date
		# (I may revisit this, but it seems fairly elegant, despite being a little "weird")
		# NOTE: salt is left empty, but sha256 is computed in Finalize()
		rootReveal = Reveal(letter=commitLetter, sha256='', salt='', strength=0, revealed=True, reveal_date=postDate)
		rootReveal.save()
		
		reveals = {}
		redactions = []
		currentRedaction = None
		
		for commitSpan in commitJson['spans']:
			# http://ubuntuforums.org/showthread.php?t=913421
			# except we are using unicode not "str"
			if isinstance(commitSpan, unicode):
				# found snippet of public HTML
				
				# REVIEW: what if someone wants to mark out something nested inside the HTML?
				# does that matter, or can we always do it with a span at the "top level"?
				redactions.append(Redaction(
					letter=commitLetter,
					order=len(redactions),
					reveal=rootReveal,
					length=len(commitSpan),
					contents=commitSpan
				))
			else:
				# found placeholder for protected HTML
				shaHexDigest = commitSpan['sha256']				
				if not (shaHexDigest in reveals):
					reveals[shaHexDigest] = Reveal(letter=commitLetter, sha256=shaHexDigest, strength=0, revealed=False)
					# cannot defer save
					# http://groups.google.com/group/django-users/browse_thread/thread/3ed0984528a40409
					reveals[shaHexDigest].save()

				redactions.append(Redaction(
					letter=commitLetter,
					order=len(redactions),
					reveal=reveals[shaHexDigest],
					length=int(commitSpan['displayLength']),
					contents=""
				));
			
		rootRevealContents = ''
		for redaction in redactions:
			if redaction.reveal == rootReveal:
				rootRevealContents = rootRevealContents + redaction.contents
				
		# Make the root reveal's hash equal to the hash of the contents
		shaRootRevealContents = hashlib.sha256()
		# http://mail.python.org/pipermail/python-list/2008-November/689523.html
		shaRootRevealContents.update(rootRevealContents.encode('utf-8'))
		rootReveal.sha256 = shaRootRevealContents.hexdigest()	
		rootReveal.save()
		
		for shaHexDigest, reveal in reveals.iteritems():
			reveal.save()

		# Now that the foreign key for reveal is set up, we can save the redactions
		for redaction in redactions:
			redaction.save()

	except Exception as inst:
	
		return HttpJsonErrorForException(Exception, inst)
	
	return HttpJsonPostResponse({'show_url': reverse('blackhighlighter.views.show', args=[letter_uuid])});


# Reveal is a HTTP post callback
def reveal(request, letter_uuid):
	try:

		# should we check to make sure the date in the request matches so we are on
		# the same page as the client?
		postDate = datetime.datetime.now()
		
		revealArrayJson = json.loads(request.POST['reveals'])
		
		# Should be a JavaScript array, even if it's just one element...
		if len(revealArrayJson) == 0:
			raise Exception('Zero length reveals array in POST');

		# get the letter object for id
		try:
			revealLetter = Letter.objects.get(uuid=letter_uuid)
		except Letter.DoesNotExist:
			raise Http404

		for revealJson in revealArrayJson:
			
			uuid = uuid_from_url(revealJson['url']) 
			if (uuid != letter_uuid):
				raise Exception('UUID passed in POST %s does not match UUID in envelope %s' % letter_uuid % uuid)

			order = 1

			# get the letter object identified by this hash
			try:
				revealDb = Reveal.objects.get(sha256=revealJson['sha256'])
			except Reveal.DoesNotExist:
				raise Exception('No reveals match hex digest %s' % shaHexDigest)

			# calculate the hash of the salt followed by contents
			contents = revealJson['salt'];

			for redactionSpan in revealJson['redactions']:
				if not isinstance(redactionSpan, unicode):
					raise Exception('Unexpected string contents for redaction')
				contents += redactionSpan

			# http://mail.python.org/pipermail/python-list/2008-November/689523.html
			contentsUTF8 = contents.encode('utf-8')

			hasher = hashlib.sha256()
			hasher.update(contentsUTF8)
			digest = hasher.hexdigest()
				
			if revealDb.sha256 != digest:
				raise Exception('Hash of actual salt+contents does not match hash in reveal envelope.')
			
			redactionsInOrder = revealDb.redaction_set.filter(reveal=revealDb).order_by('order')
			numRedactions = len(redactionsInOrder)
			if numRedactions != len(revealJson['redactions']):
				raise Exception('Different number of redactions in certificate than placeholders.')

			for redactionIndex in range(0, numRedactions):
				redactionDb = redactionsInOrder[redactionIndex]
				redactionDb.contents = revealJson['redactions'][redactionIndex]
				redactionDb.save()

			revealDb.salt = revealJson['salt']
			revealDb.revealed = True
			revealDb.reveal_date = postDate
			revealDb.save()

	except Exception as inst:
	
		return HttpJsonErrorForException(Exception, inst)

	return HttpJsonPostResponse({'show_url': reverse('blackhighlighter.views.show', args=[letter_uuid])})



#
# VIEWS FOR THE "ABOUT" PAGES
# Before breaking blackhighlighter into its own app, I used to have these in
# the urls like this:
#
#   url(r'^about/credits/$', direct_to_template, {'template': 'credits.html'}, 'credits-named_url'),
# 
# However, I switched this to exposing views from blackhighlighter instead of
# templates.  The reason being there's no template loader parameterized by app,
# so the site can't say "load template about/credits.html from blackhighlighter".
# It seemed to break encapsulation to say "look for about/credits.html in all apps"
#
# See:
# http://www.djangobook.com/en/2.0/chapter11/
# http://docs.djangoproject.com/en/dev/ref/templates/api/#loading-templates
#
# These are not loaded directly via reverse, but rather by name.  This way you
# can easily override them in the urls.py -- I'm not sure if this is the right
# way to go long term so it's more of an experiment.
#

# Generic views
# http://docs.djangoproject.com/en/dev/ref/generic-views/
from django.views.generic.simple import direct_to_template

def about_credits(request):
	return direct_to_template(request, template="about/credits.html")

def about_network(request):
	return direct_to_template(request, template="about/network.html")

def about_cryptography(request):
	return direct_to_template(request, template="about/cryptography.html")

def about_certificates(request):
	return direct_to_template(request, template="about/certificates.html")

def about_legal(request):
	return direct_to_template(request, template="about/legal.html")