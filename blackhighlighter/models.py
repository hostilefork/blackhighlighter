# This is a "models module" for the django framework
# http://docs.djangoproject.com/en/dev/intro/tutorial01/#id3
# http://docs.djangoproject.com/en/dev/ref/models/fields/

#
# blackhighlighter/models.py - Data model for letters with protections
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

from django.db import models

# http://www.b-list.org/weblog/2007/nov/10/unicode/
# http://code.djangoproject.com/wiki/UnicodeBranch#PortingApplicationsTheQuickChecklist
from django.utils.encoding import smart_unicode

#
# A letter is made up of a series of numbered redactions, in order
# LET = RED1 RED2 RED3 RED4 .... RED(N)
#
# Each redaction is a member of a "reveal"
# REV1 = RED1 RED4
# REV2 = RED2 RED3
# REV(N) = RED(...) RED(...) RED(...)
#
# A reveal may be published or secret
# If a reveal is published, it has an associated publication date
#
# For implementation convenience, the public portion of the text is implemented 
# as a "reveal" group whose publication date matches the date on the letter
#

class Letter(models.Model):
	# REVIEW: can we just use the audit trail?
	commit_date = models.DateTimeField('date committed')

	# Use UUIDs for all forward facing IDs
	# (Like Freebase, we do not hyphenate the 128 bit numbers)
	uuid = models.CharField(max_length=32)
	
	# TODO: track author account, recipient account, tags, etc.
	# Want to figure out how much of this could be done with other django-apps!
	
	# Unicode representation of this item.  Contents?
	def __unicode__(self):
		return 'LET[' + self.uuid + ', ' + smart_unicode(self.commit_date) + ']'


class Reveal(models.Model):

	# Every reveal belongs to exactly one letter
	letter = models.ForeignKey(Letter)
	
	# Standard is to encode as 64 sequential hash digits in hex	
	# SHA256("a") => CA978112CA1BBDCAFAC231B39A23DC4DA786EFF8147C4E72B9807785AFEE48BB
	# to generate test hashes, try http://hash-it.net/
	sha256 = models.CharField(max_length=64)
	
	# TODO: Key strengthening, currently we just support key strength 0
	# (no additional iterations)
	# http://en.wikipedia.org/wiki/Key_strengthening
	strength = models.IntegerField()

	# how big a salt is up to the client, but 32 (guid size) is standard at the moment
	# for information-theoretic limits of salt benefits w.r.t. hashing size, read:
	# http://groups.google.com/group/sci.crypt/msg/62914ca7e5f1cf9e
	salt = models.TextField()
	
	# If revealed, then we expect all associated redactions for this reveal to have
	# its "contents" field filled, and the sha256 should match the hash of the salt
	# plus those contents appended together
	revealed = models.BooleanField()	
	
	# NOTE: if the reveal_date matches the commit_date of the letter, we know it's a "root reveal"
	reveal_date = models.DateTimeField('date revealed', null=True)
	
	# REVIEW: Should we track the user who did the revelation if they wish?

	# http://docs.djangoproject.com/en/dev/ref/models/options/#unique-togethers
	class Meta:
		ordering = ['sha256']
		unique_together = (('letter', 'sha256'),) # in 1.0 this need not be a list
		
	# Unicode representation of this item
	def __unicode__(self):
		reveal_name = 'RVL[' + self.sha256 + ', '
		if self.revealed:
			reveal_name += 'revealed'
		else:
			reveal_name += 'not revealed'
		reveal_name += ']'
		return reveal_name


class Redaction(models.Model):

	# Every redaction is part of a reveal
	reveal = models.ForeignKey(Reveal)
	
	# This is the foreign key to the letter, which should be the same as
	# reveal.letter -- it is not strictly necessary to have this redundancy,
	# because you could always write:
	#
	#	for redaction in Redaction.objects.filter(reveal__letter=letter):
	#
	# instead of:
	#
	# 	for redaction in letter.redaction_set:
	#
	# However, there are two good reasons for this redundancy at the 
	# time of this writing.  One is that django has no decent way to
	# edit the case of three classes linked by foreign keys in the admin
	# interface:
	#
	# 	http://groups.google.com/group/django-developers/browse_thread/thread/7912f4871d23f985/60e33cf2fb8c4e33
	#
	# The other good reason for keeping this here is that we can add an
	# integrity check that the letter UUID and order are unique together,
	# which as far as I know can't be done across tables.
	#
	# REVIEW: See if this field can be removed at a later date when the
	# admin interface has improved.
	letter = models.ForeignKey(Letter)

	# the integer order of the segments to be displayed
	# should be contiguous values from 0...(order-1)
	order = models.IntegerField()
	
	# contents are stored here if redaction.revealed is True
	contents = models.TextField() # no max length on content

	# The display length of the redaction.  This length is up to the client
	# that submitted the letter, and it does not need to match the actual 
	# length of the contents (you can have a redaction which looks
	# longer or shorter than the actual data, in order to not give away
	# too much about the information by the length)
	length = models.IntegerField()

	# Unicode representation of this item.  Contents?
	def __unicode__(self):
		return 'RED[' + smart_unicode(self.order) + ', "' + self.contents + '"]';
		
	# http://docs.djangoproject.com/en/dev/ref/models/options/#unique-togethers
	class Meta:
		ordering = ['order']
		unique_together = (('letter', 'order'),) # in 1.0 this need not be a list
