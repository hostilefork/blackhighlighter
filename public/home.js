//
// home.js
// blackhighlighter supplemental javascript for the homepage.
// Copyright (C) 2009-2012 HostileFork.com
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//   See http://blackhighlighter.hostilefork.com for documentation.
//

// Whole-script strict mode syntax
"use strict";

define([
	// libs which return exported objects to capture in the function prototype
	'jquery',
	'underscore',

	// these libs have no results, they just add to the environment (via shims)
	'jqueryui'
], function($, _) {

	var animation_timeline = [{"delay": 3000, "blit": [[0, 0, 800, 450, 0, 0]]}, {"delay": 3000, "blit": [[542, 3693, 89, 33, 317, 200], [733, 3629, 58, 44, 409, 200]]}, {"delay": 6000, "blit": [[655, 3527, 136, 33, 493, 200], [524, 3629, 116, 44, 629, 200]]}, {"delay": 8000, "blit": [[0, 3210, 800, 68, 0, 0], [0, 2914, 782, 296, 8, 78], [577, 3489, 210, 38, 294, 392]]}, {"delay": 2000, "blit": [[781, 2814, 19, 18, 626, 339]]}, {"delay": 2000, "blit": [[782, 2786, 18, 18, 637, 339]]}, {"delay": 2000, "blit": [[755, 2814, 26, 18, 647, 339]]}, {"delay": 6000, "blit": [[783, 1190, 8, 18, 665, 339], [0, 3535, 225, 54, 294, 392]]}, {"delay": 6000, "blit": [[755, 2786, 27, 28, 387, 139], [213, 3665, 204, 22, 464, 336], [0, 3385, 507, 54, 147, 392]]}, {"delay": 2000, "blit": [[712, 3560, 81, 44, 387, 138]]}, {"delay": 2000, "blit": [[637, 3673, 77, 44, 440, 138]]}, {"delay": 4000, "blit": [[640, 3629, 93, 44, 489, 138]]}, {"delay": 4000, "blit": [[755, 2758, 28, 28, 554, 138], [460, 3570, 252, 37, 479, 352]]}, {"delay": 4000, "blit": [[0, 3589, 215, 22, 453, 336], [417, 3673, 220, 20, 511, 363]]}, {"delay": 3000, "blit": [[0, 3488, 331, 47, 24, 223], [497, 2220, 35, 36, 479, 353]]}, {"delay": 3000, "blit": [[755, 2730, 28, 28, 327, 223], [225, 3570, 235, 45, 355, 247]]}, {"delay": 6000, "blit": [[755, 2702, 28, 28, 562, 247], [444, 3439, 325, 50, 345, 392]]}, {"delay": 6000, "blit": [[0, 1559, 783, 364, 8, 78]]}, {"delay": 6000, "blit": [[378, 3629, 146, 36, 508, 2], [225, 3544, 430, 26, 74, 8], [0, 3615, 378, 15, 264, 44], [143, 3273, 146, 3, 508, 63], [0, 1923, 783, 355, 8, 78]]}, {"delay": 4000, "blit": [[755, 2665, 35, 37, 515, 410]]}, {"delay": 3000, "blit": [[0, 1190, 783, 369, 8, 78]]}, {"delay": 5000, "blit": [[0, 2591, 755, 323, 20, 94]]}, {"delay": 6000, "blit": [[0, 450, 800, 375, 0, 71]]}, {"delay": 4000, "blit": [[0, 825, 799, 365, 0, 72]]}, {"delay": 3000, "blit": [[755, 2628, 35, 37, 495, 347], [0, 3630, 177, 27, 536, 361]]}, {"delay": 3000, "blit": [[507, 3437, 204, 1, 464, 336], [0, 3679, 204, 19, 464, 340], [8, 1114, 177, 27, 536, 361]]}, {"delay": 6000, "blit": [[755, 2591, 35, 37, 495, 347], [507, 3385, 253, 52, 429, 391]]}, {"delay": 3000, "blit": [[0, 2278, 797, 313, 0, 71], [0, 3333, 797, 52, 0, 391]]}, {"delay": 3000, "blit": [[381, 2996, 169, 22, 389, 160], [16, 3084, 305, 22, 24, 248], [347, 3106, 213, 22, 355, 270]]}, {"delay": 3000, "blit": [[331, 3489, 246, 55, 384, 160], [24, 2455, 305, 22, 24, 248], [355, 2477, 213, 22, 355, 270]]}, {"delay": 3000, "blit": [[373, 3693, 169, 22, 389, 160], [16, 3084, 305, 22, 24, 248], [347, 3106, 213, 22, 355, 270]]}, {"delay": 3000, "blit": [[336, 3489, 169, 22, 389, 160], [24, 2455, 305, 22, 24, 248], [355, 2477, 213, 22, 355, 270]]}, {"delay": 3000, "blit": [[376, 2996, 246, 55, 384, 160], [16, 3084, 305, 22, 24, 248], [347, 3106, 213, 22, 355, 270], [0, 3439, 444, 49, 340, 391]]}, {"delay": 6000, "blit": [[204, 3687, 169, 22, 389, 160], [24, 2455, 305, 22, 24, 248], [355, 2477, 213, 22, 355, 270]]}, {"delay": 10000, "blit": [[177, 3630, 169, 22, 389, 160], [460, 3607, 305, 22, 24, 248], [0, 3657, 213, 22, 355, 270], [791, 1190, 6, 22, 668, 336], [0, 3278, 794, 55, 3, 391]]}, {"delay": 4000, "blit": []}];

	// Animation routines from sublimetext author
	// http://www.sublimetext.com/~jps/animated_gifs_the_hard_way.html
	var delay_scale = 0.7
	var timer = null

	var animate = function(img, timeline, element)
	{
		var i = 0

		var run_time = 0
		for (var j = 0; j < timeline.length - 1; ++j)
			run_time += timeline[j].delay

		var f = function()
		{
			var frame = i++ % timeline.length
			var delay = timeline[frame].delay * delay_scale
			var blits = timeline[frame].blit

			var ctx = element.getContext('2d')

			for (j = 0; j < blits.length; ++j)
			{
				var blit = blits[j]
				var sx = blit[0]
				var sy = blit[1]
				var w = blit[2]
				var h = blit[3]
				var dx = blit[4]
				var dy = blit[5]
				ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h)
			}

			timer = window.setTimeout(f, delay)
		}

		if (timer) window.clearTimeout(timer)
		f()
	}

	var animate_fallback = function(img, timeline, element)
	{
		var i = 0

		var run_time = 0
		for (var j = 0; j < timeline.length - 1; ++j)
			run_time += timeline[j].delay

		var f = function()
		{
			if (i % timeline.length == 0)
			{
				while (element.hasChildNodes())
					element.removeChild(element.lastChild)
			}

			var frame = i++ % timeline.length
			var delay = timeline[frame].delay * delay_scale
			var blits = timeline[frame].blit

			for (j = 0; j < blits.length; ++j)
			{
				var blit = blits[j]
				var sx = blit[0]
				var sy = blit[1]
				var w = blit[2]
				var h = blit[3]
				var dx = blit[4]
				var dy = blit[5]

				var d = document.createElement('div')
				d.style.position = 'absolute'
				d.style.left = dx + "px"
				d.style.top = dy + "px"
				d.style.width = w + "px"
				d.style.height = h + "px"
				d.style.backgroundImage = "url('" + img.src + "')"
				d.style.backgroundPosition = "-" + sx + "px -" + sy + "px"

				element.appendChild(d)
			}

			timer = window.setTimeout(f, delay)
		}

		if (timer) window.clearTimeout(timer)
		f()
	}

	function set_animation(img_url, timeline, canvas_id, fallback_id)
	{
		var img = new Image()
		img.onload = function()
		{
			var canvas = document.getElementById(canvas_id)
			if (canvas && canvas.getContext)
				animate(img, timeline, canvas)
			else
				animate_fallback(img, timeline, document.getElementById(fallback_id))
		}
		img.src = img_url
	}

	set_animation("/public/animation_packed.png", animation_timeline, 'anim_target', 'anim_fallback');

	// Bring tabs to life.
	$('#tabs').tabs();

	// Theme all the button-type-things but not the <a href="#" ..> style
	$("input:submit, button").button();

	// If they click the button, take them to the write phase
	$('button.next-step').click(function() {
		window.location.href = "/write/"
	});
});
