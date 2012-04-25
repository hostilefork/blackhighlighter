/* 
 * nicEditOverrides.js
 * modifications for nicEdit needed by django-blackhighlighter project 
 * http://hostilefork.com/blackhighlighter
 *
 * NicEdit is a Micro Inline WYSIWYG
 * Copyright 2007-2008 Brian Kirchoff
 *
 * NicEdit (and these changes) are distributed under the terms of the MIT license
 * For more information visit http://nicedit.com/
 * Do not remove this copyright message
 */

define(['nicedit'], function () {

	// So nicEdit's general strategy is to incarnate on top of an existing text area on
	// your document, and inherit that text area's size and style.
	//
	// Although you can specify a width in terms of percentages or "auto" css styles on 
	// that TextArea, nicEdit will throw this away and become statically sized based on
	// the client size it sees at the moment you instantiate it.
	//
	// In other words, if you started out with an abstract measurement like "100%"
	// nicEdit will convert this into a pixel size (e.g. 300px) and become fixed on that 
	// even if your page is resized.  It needs to know the size in pixels because its
	// visual effects, such as putting an interior dotted line inside the text area, rely
	// on absolute positioning.
	//
	// I had figured out how to hack around this in a way that worked well enough for
	// my purposes.  Since it is a small amount of code, I decided the best way to 
	// apply it would be as a "dynamic patch" to the nicEdit JavaScript.
	if (true) {
		nicEditor.prototype.panelInstance = function(e,o) {
			e = this.checkReplace($BK(e));
			var widthString;
			if (e.style.width) {
				widthString = e.style.width;
			} else {
				widthString = e.clientWidth + 'px';
			}
			var panelElm = new bkElement('DIV').setStyle({width : widthString}).appendBefore(e);
			this.setPanel(panelElm);
			return this.addInstance(e,o);
		};
	
/* ORIGINAL CODE IN nicCore.js */
/*
	panelInstance : function(e,o) {
		e = this.checkReplace($BK(e));
		var panelElm = new bkElement('DIV').setStyle({width : (parseInt(e.getStyle('width')) || e.clientWidth)+'px'}).appendBefore(e);
		this.setPanel(panelElm);
		return this.addInstance(e,o);	
	},
*/
	}


	if (true) {

	// One problem with the old method was mixture of pixel margins with percent based sizes
	// A better solution might involve the following:
	// http://www.cssplay.co.uk/boxes/outside.html

		nicEditorInstance.prototype.construct = function(e,options,nicEditor) {
			var marginPx = 4; // the dotted interior line of an active nicEditor is 4pixels inside
			this.ne = nicEditor;
			this.elm = this.e = e;
			this.options = options || {};

			var widthString;
			if (e.style.width) {
				widthString = e.style.width;
			} else {
				widthString = e.clientWidth + 'px';
			}
			var newX = widthString;
			var newY = parseInt(e.getStyle('height'), 10) || e.clientHeight;
			this.initialHeight = newY-(marginPx*2);
			
			var isTextarea = (e.nodeName.toLowerCase() == 'textarea');
			if(isTextarea || this.options.hasPanel) {
				var ie7s = (bkLib.isMSIE && !((typeof document.body.style.maxHeight != 'undefined') && document.compatMode == 'CSS1Compat'));
				var s = {
					width: newX,
					border : '1px solid #ccc',
					borderTop : 0,
					overflowY : 'auto',
					overflowX: 'hidden'
				};
				s[(ie7s) ? 'height' : 'maxHeight'] = (this.ne.options.maxHeight) ? this.ne.options.maxHeight+'px' : null;
				this.editorContain = new bkElement('DIV').setStyle(s).appendBefore(e);
				var editorElm = new bkElement('DIV').setStyle({
					width : "auto",
					margin: marginPx + 'px',
					minHeight : newY + 'px'
				}).addClass('main').appendTo(this.editorContain);

				e.setStyle({display : 'none'});
					
				editorElm.innerHTML = e.innerHTML;
				if(isTextarea) {
					editorElm.setContent(e.value);
					this.copyElm = e;
					var f = e.parentTag('FORM');
					if(f) { 
						bkLib.addEvent( f, 'submit', this.saveContent.closure(this)); 
					}
				}
				editorElm.setStyle((ie7s) ? {height : newY+'px'} : {overflow: 'hidden'});
				this.elm = editorElm;
			}
			this.ne.addEvent('blur',this.blur.closure(this));

			this.init();
			this.blur();
		};
		
	/* ORIGINAL CODE IN nicInstance.js */
	/*
		construct : function(e,options,nicEditor) {
			this.ne = nicEditor;
			this.elm = this.e = e;
			this.options = options || {};
			
			newX = parseInt(e.getStyle('width')) || e.clientWidth;
			newY = parseInt(e.getStyle('height')) || e.clientHeight;
			this.initialHeight = newY-8;
			
			var isTextarea = (e.nodeName.toLowerCase() == "textarea");
			if(isTextarea || this.options.hasPanel) {
				var ie7s = (bkLib.isMSIE && !((typeof document.body.style.maxHeight != "undefined") && document.compatMode == "CSS1Compat"))
				var s = {width: newX+'px', border : '1px solid #ccc', borderTop : 0, overflowY : 'auto', overflowX: 'hidden' };
				s[(ie7s) ? 'height' : 'maxHeight'] = (this.ne.options.maxHeight) ? this.ne.options.maxHeight+'px' : null;
				this.editorContain = new bkElement('DIV').setStyle(s).appendBefore(e);
				var editorElm = new bkElement('DIV').setStyle({width : (newX-8)+'px', margin: '4px', minHeight : newY+'px'}).addClass('main').appendTo(this.editorContain);

				e.setStyle({display : 'none'});
					
				editorElm.innerHTML = e.innerHTML;		
				if(isTextarea) {
					editorElm.setContent(e.value);
					this.copyElm = e;
					var f = e.parentTag('FORM');
					if(f) { bkLib.addEvent( f, 'submit', this.saveContent.closure(this)); }
				}
				editorElm.setStyle((ie7s) ? {height : newY+'px'} : {overflow: 'hidden'});
				this.elm = editorElm;	
			}
			this.ne.addEvent('blur',this.blur.closure(this));

			this.init();
			this.blur();
		},
	*/
	}



	if (true) {

	// The XHTML compliant nicEdit produces text, not nodes.  And blackhighlighter needs to
	// operate on the rich text node structure of what you've been editing:
	//
	// 	http://wiki.nicedit.com/XHTML-Compliant-Output
	//
	// Going to text and then back to nodes again is inefficient and creates a lot of
	// opportunity for errors.  Beyond that problem, jQuery adds custom properties 
	// known as "expandos" via the data API as part of its internals:
	//
	// 	http://docs.jquery.com/Internals/jQuery.data
	//
	// nicXHTML's get method doesn't handle these transparently, and thus returns 
	// attributes like:
	//
	// '<span class="protected protected_readonly" jquery1241723087763="47">foo</span>'
	//
	// This crashes innerXHTML for some reason, and are not what we want anyway.  I
	// took the basic functionality that nicXHTML seemed to be doing and rewrote it 
	// here but haven't gotten around to testing the cases it is checking for.
	//
	// REVIEW: Test this or replace it using a different rich editor functionality!

		nicEditorInstance.prototype.getElmCloneClean = function() {

			// As tagName is read only, there is no way to change a node in place
			// to have a new tagName.  You must create a new element.  Unfortunately,
			// that element will not have any of the original attributes.  Iterating
			// over attribute nodes and copying them to new node types is somewhat
			// dodgy.
			//
			// Yet since we are making XHTML, at least we know what attributes are 
			// legal to pass on...so if we have to rebind the tag then we can do
			// just those attributes...
			function copyLegalAttributes(src, dest, attrNames) {
				for (var attrNameIndex = 0; attrNameIndex < attrNames.length; attrNameIndex++) {
					var attrValue = src.attr(attrNames[attrNameIndex]); 
					if (attrValue !== undefined) {
						dest.attr(attrNames[attrNameIndex], attrValue);
					}
				}
			}
			
			function cleanRichTextXHTML(n) {
				var nType = n.nodeType === undefined ? Node.ATTRIBUTE_NODE : n.nodeType;

				if (nType == Node.ELEMENT_NODE) { 
					var stripAttributes = ['_moz_dirty', '_moz_resizing', '_extended'];
					for(var i = 0; i< stripAttributes.length; i++) {
						if (n.attr(stripAttributes[i]) !== undefined) {
							n.removeAttr(stripAttributes[i]);
						}
					}
						
					// Do CSS style replacements with wrapping nodes
					var cssReplace = {
						'font-weight:bold;' : 'strong',
						'font-style:italic;' : 'em'
					};
					var css = n.attr('style');
					if (css !== undefined) {
						css.replace(/ /g,"");
						for(var itm in cssReplace) {
							if (cssReplace.hasOwnProperty(itm) && (css.indexOf(itm) != -1)) {
								var wrappingNode = $("<" + cssReplace[itm] + "></" + cssReplace[itm] + '>');
								n.replaceWith(wrappingNode);
								wrappingNode.append(n);
								css = css.replace(itm,'');
							}
						}
						if (css !== '') {
							n.attr('style', css);
						} else {
							n.removeAttr('style');
						}
					}
					
					// Remove this Random Safari class the editor puts on
					// http://dev.fckeditor.net/ticket/2113
					if (n.hasClass('Apple-style-span')) {
						n.removeClass('Apple-style-span');
					}
					
					// Do size substitutions to XHTML "font-size" attribute
					var sizes = {1 : 'xx-small', 2 : 'x-small', 3 : 'small', 4 : 'medium', 5 : 'large', 6 : 'x-large'};
					var size = n.attr('size');
					if (size !== undefined) {
						n.attr('font-size', sizes[size]);
						n.removeAttr('size');
					}
					
					// http://www.zvon.org/xxl/xhtmlReference/Output/Strict/el_strong.html
					// http://www.zvon.org/xxl/xhtmlReference/Output/Strict/el_em.html					
					// http://www.zvon.org/xxl/xhtmlReference/Output/Strict/el_span.html
					var legalAttributes = [
								'class',
								'dir',
								'id',
								'lang',
								'onclick',
								'ondblclick',
								'onkeydown',
								'onkeypress',
								'onkeyup',
								'onmousedown',
								'onmousemove',
								'onmouseout',
								'onmouseover',
								'onmouseup',
								'style',
								'title',
								'xml:lang'];

					switch(n.tagName.toLowerCase()) {
						case 'b':
							var strongNode = $('<strong></strong>').append();
							copyLegalAttributes(n, strongNode, legalAttributes);
							strongNode.append(n.contents().remove());
							n = strongNode;
							break;
							
						case 'i':
							var emNode = $('<em></em>');
							copyLegalAttributes(n, emNode, legalAttributes);
							emNode.append(n.contents().remove());
							n = emNode;
							break;
							
						case 'font':
							var spanNode = $('<span></span>'); 
							copyLegalAttributes(n, spanNode, legalAttributes);
							spanNode.append(n.contents().remove());
							n = spanNode;
							break;
					}

					for(var childIndex = 0; childIndex < n.childNodes.length; childIndex++) {
						cleanRichTextXHTML(n.childNodes[childIndex]);
					}
				}
			}
			
			// Content are not wrapped by a containing element, need an aggregator.
			// NOTE: Could use a "document fragment", but a div is expedient
			// http://ejohn.org/blog/dom-documentfragments/
			var elmOriginal = $(this.getElm());
			var elmClone = elmOriginal.clone();
			cleanRichTextXHTML(elmClone);		
			return elmClone;
		};
		
	/* ORIGINAL CODE IN nicXHTML.js */
	/*
	var nicXHTML = bkClass.extend({
		stripAttributes : ['_moz_dirty','_moz_resizing','_extended'],
		noShort : ['style','title','script','textarea','a'],
		cssReplace : {'font-weight:bold;' : 'strong', 'font-style:italic;' : 'em'},
		sizes : {1 : 'xx-small', 2 : 'x-small', 3 : 'small', 4 : 'medium', 5 : 'large', 6 : 'x-large'},
		
		construct : function(nicEditor) {
			this.ne = nicEditor;
			if(this.ne.options.xhtml) {
				nicEditor.addEvent('get',this.cleanup.closure(this));
			}
		},
		
		cleanup : function(ni) {
			var node = ni.getElm();
			var xhtml = this.toXHTML(node);
			ni.content = xhtml;
		},
		
		toXHTML : function(n,r,d) {
			var txt = '';
			var attrTxt = '';
			var cssTxt = '';
			var nType = n.nodeType;
			var nName = n.nodeName.toLowerCase();
			var nChild = n.hasChildNodes && n.hasChildNodes();
			var extraNodes = new Array();
			
			switch(nType) {
				case 1:
					var nAttributes = n.attributes;
					
					switch(nName) {
						case 'b':
							nName = 'strong';
							break;
						case 'i':
							nName = 'em';
							break;
						case 'font':
							nName = 'span';
							break;
					}
					
					if(r) {
						for(var i=0;i<nAttributes.length;i++) {
							var attr = nAttributes[i];
							
							var attributeName = attr.nodeName.toLowerCase();
							var attributeValue = attr.nodeValue;
							
							if(!attr.specified || !attributeValue || bkLib.inArray(this.stripAttributes,attributeName) || typeof(attributeValue) == "function") {
								continue;
							}
							
							switch(attributeName) {
								case 'style':
									var css = attributeValue.replace(/ /g,"");
									for(itm in this.cssReplace) {
										if(css.indexOf(itm) != -1) {
											extraNodes.push(this.cssReplace[itm]);
											css = css.replace(itm,'');
										}
									}
									cssTxt += css;
									attributeValue = "";
								break;
								case 'class':
									attributeValue = attributeValue.replace("Apple-style-span","");
								break;
								case 'size':
									cssTxt += "font-size:"+this.sizes[attributeValue]+';';
									attributeValue = "";
								break;
							}
							
							if(attributeValue) {
								attrTxt += ' '+attributeName+'="'+attributeValue+'"';
							}
						}

						if(cssTxt) {
							attrTxt += ' style="'+cssTxt+'"';
						}

						for(var i=0;i<extraNodes.length;i++) {
							txt += '<'+extraNodes[i]+'>';
						}
					
						if(attrTxt == "" && nName == "span") {
							r = false;
						}
						if(r) {
							txt += '<'+nName;
							if(nName != 'br') {
								txt += attrTxt;
							}
						}
					}
					

					
					if(!nChild && !bkLib.inArray(this.noShort,attributeName)) {
						if(r) {
							txt += ' />';
						}
					} else {
						if(r) {
							txt += '>';
						}
						
						for(var i=0;i<n.childNodes.length;i++) {
							var results = this.toXHTML(n.childNodes[i],true,true);
							if(results) {
								txt += results;
							}
						}
					}
						
					if(r && nChild) {
						txt += '</'+nName+'>';
					}
					
					for(var i=0;i<extraNodes.length;i++) {
						txt += '</'+extraNodes[i]+'>';
					}

					break;
				case 3:
					//if(n.nodeValue != '\n') {
						txt += n.nodeValue;
					//}
					break;
			}
			
			return txt;
		}
	});
	*/
	}
		


	if (true) {

	// This hack is necessary because the IE compatibility layer for W3C ranges
	// returns nulls at times nicEdit did not expect.  I'm not very confident that
	// the existing invariants were correct in any case, but this works around
	// the crashes.
	// (selElm can't handle "null" ranges, but tests startContainer, so given a
	// startContainer of null we can keep things going...)

		nicEditorInstance.prototype.getRng = function() {
			var nullRange = {
					'toString': function() { return "";},
					'startContainer': null, 
					'endContainer': null, 
					'parentElement': function() { return null;},
					'note': 'This is a FAKE RANGE, see nicEditorPatches.js getRng()'
			};
			var s = this.getSel();
			if(s === null) {
				return nullRange;
			}
				
			if (s.rangeCount > 0) {
				var rangeAt = s.getRangeAt(0);
				if (rangeAt === null) {
					return nullRange;
				}
				return rangeAt;
			}

			var rangeNew = null;
			if('createRange' in s) {
				rangeNew = s.createRange();
			}
			if (rangeNew === null) {
				return nullRange;
			}
			
			return rangeNew;
		};
		
	/* ORIGINAL CODE IN nicInstance.js */
	/*
		getRng : function() {
			var s = this.getSel();
			if(!s) { return null; }
			return (s.rangeCount > 0) ? s.getRangeAt(0) : s.createRange();
		},
	*/
	}
	
	return {};
});