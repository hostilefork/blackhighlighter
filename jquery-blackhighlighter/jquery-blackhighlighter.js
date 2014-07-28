//
// jquery-blackhighlighter.js
// Copyright (C) 2009-2014 HostileFork.com
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


////////////////////////////////////////////////////////////////////////////////


    //
    // REQUIREJS AND MODULE PATTERN FOR WIDGET
    //
    // Basic structure borrowed from:
    //
    // https://github.com/bgrins/ExpandingTextareas

(function(factory) {
    // Add jQuery via AMD registration or browser globals

    if (typeof define === 'function' && define.amd) {
        define([ 'jquery'], factory);
    }
    else {
        factory(jQuery);
    }
}(function ($) {

    // http://stackoverflow.com/questions/1335851/
    // http://stackoverflow.com/questions/4462478/

    "use strict";

    // Mask global underscore library in browser in order to avoid any
    // underscore-dependent code creeping in.

    var _ = null;


////////////////////////////////////////////////////////////////////////////////


    //
    // BASE64 ENCODE AND DECODE
    //
    // To reduce dependencies, we include this safe and suggested Base64
    // implementation directly into the file.  There are functions btoa() and
    // atob() in most major browsers, and a "polyfill" available:
    //
    //     https://github.com/davidchambers/Base64.js
    //
    // "it's best to use the native functions and polyfill rather than include
    // a library that introduces a new API."
    //
    //     http://stackoverflow.com/questions/246801/#comment34178292_247261
    //
    // However the mozilla docs emphasize there are some bugs ("issues") in
    // the standard anyway.  So given that it's very little code, having a
    // copy embedded gives browser compatibility and takes care of those bugs.
    //

    // Uint8Array shim for IE
    // http://stackoverflow.com/a/12047504/211160
    (function() {
        try {
            var a = new Uint8Array(1);
            return; //no need
        } catch(e) { }

        function subarray(start, end) {
            return this.slice(start, end);
        }

        function set_(array, offset) {
            if (arguments.length < 2) offset = 0;
            for (var i = 0, n = array.length; i < n; ++i, ++offset)
                this[offset] = array[i] & 0xFF;
        }

        // we need typed arrays
        function TypedArray(arg1) {
            var result;
            if (typeof arg1 === "number") {
                result = new Array(arg1);
            for (var i = 0; i < arg1; ++i)
                result[i] = 0;
            } else
                result = arg1.slice(0);
            result.subarray = subarray;
            result.buffer = result;
            result.byteLength = result.length;
            result.set = set_;
            if (typeof arg1 === "object" && arg1.buffer)
                result.buffer = arg1.buffer;

            return result;
        }

        window.Uint8Array = TypedArray;
        window.Uint32Array = TypedArray;
        window.Int32Array = TypedArray;
    })();

    /*\
    |*|
    |*|  Base64 / binary data / UTF-8 strings utilities
    |*|
    |*|  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
    |*|
    \*/

    /* Array of bytes to base64 string decoding */

    function b64ToUint6 (nChr) {

      return nChr > 64 && nChr < 91 ?
          nChr - 65
        : nChr > 96 && nChr < 123 ?
          nChr - 71
        : nChr > 47 && nChr < 58 ?
          nChr + 4
        : nChr === 43 ?
          62
        : nChr === 47 ?
          63
        :
          0;

    }

    function base64DecToArr (sBase64, nBlocksSize) {

      var
        sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
        nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

      for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3;
        nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
          for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
            taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
          }
          nUint24 = 0;

        }
      }

      return taBytes;
    }

    /* Base64 string to array encoding */

    function uint6ToB64 (nUint6) {

      return nUint6 < 26 ?
          nUint6 + 65
        : nUint6 < 52 ?
          nUint6 + 71
        : nUint6 < 62 ?
          nUint6 - 4
        : nUint6 === 62 ?
          43
        : nUint6 === 63 ?
          47
        :
          65;

    }

    function base64EncArr (aBytes) {

      var nMod3 = 2, sB64Enc = "";

      for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3;
        if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
        nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
        if (nMod3 === 2 || aBytes.length - nIdx === 1) {
          sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
          nUint24 = 0;
        }
      }

      return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');

    }

    /* UTF-8 array to DOMString and vice versa */

    function UTF8ArrToStr (aBytes) {

      var sView = "";

      for (var nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
        nPart = aBytes[nIdx];
        sView += String.fromCharCode(
          nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */
            /* (nPart - 252 << 32) is not possible in ECMAScript! So...: */
            (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
          : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */
            (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
          : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */
            (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
          : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */
            (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
          : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */
            (nPart - 192 << 6) + aBytes[++nIdx] - 128
          : /* nPart < 127 ? */ /* one byte */
            nPart
        );
      }

      return sView;

    }

    function strToUTF8Arr (sDOMStr) {

      var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0;

      /* mapping... */

      for (var nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
        nChr = sDOMStr.charCodeAt(nMapIdx);
        nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
      }

      aBytes = new Uint8Array(nArrLen);

      /* transcription... */

      for (var nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx++) {
        nChr = sDOMStr.charCodeAt(nChrIdx);
        if (nChr < 128) {
          /* one byte */
          aBytes[nIdx++] = nChr;
        } else if (nChr < 0x800) {
          /* two bytes */
          aBytes[nIdx++] = 192 + (nChr >>> 6);
          aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x10000) {
          /* three bytes */
          aBytes[nIdx++] = 224 + (nChr >>> 12);
          aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
          aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x200000) {
          /* four bytes */
          aBytes[nIdx++] = 240 + (nChr >>> 18);
          aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
          aBytes[nIdx++] = 128 + (nChr & 63);
        } else if (nChr < 0x4000000) {
          /* five bytes */
          aBytes[nIdx++] = 248 + (nChr >>> 24);
          aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
          aBytes[nIdx++] = 128 + (nChr & 63);
        } else /* if (nChr <= 0x7fffffff) */ {
          /* six bytes */
          aBytes[nIdx++] = 252 + /* (nChr >>> 32) is not possible in ECMAScript! So...: */ (nChr / 1073741824);
          aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
          aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
          aBytes[nIdx++] = 128 + (nChr & 63);
        }
      }

      return aBytes;
    }


////////////////////////////////////////////////////////////////////////////////


    //
    // SHA256 DIGEST CALCULATION
    //
    // To reduce dependencies, we include this SHA256 implementation which
    // is... um... I guess it's okay.  It seems to agree with the Node.JS
    // crypto calculations anyway; and it's small.
    //

    /* A JavaScript implementation of the Secure Hash Algorithm, SHA-256
     * Version 0.3 Copyright Angel Marin 2003-2004 - http://anmar.eu.org/
     * Distributed under the BSD License
     * Some bits taken from Paul Johnston's SHA-1 implementation
     */
    var chrsz = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode  */
    function safe_add (x, y) {
      var lsw = (x & 0xFFFF) + (y & 0xFFFF);
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    }
    function S (X, n) {return ( X >>> n ) | (X << (32 - n));}
    function R (X, n) {return ( X >>> n );}
    function Ch(x, y, z) {return ((x & y) ^ ((~x) & z));}
    function Maj(x, y, z) {return ((x & y) ^ (x & z) ^ (y & z));}
    function Sigma0256(x) {return (S(x, 2) ^ S(x, 13) ^ S(x, 22));}
    function Sigma1256(x) {return (S(x, 6) ^ S(x, 11) ^ S(x, 25));}
    function Gamma0256(x) {return (S(x, 7) ^ S(x, 18) ^ R(x, 3));}
    function Gamma1256(x) {return (S(x, 17) ^ S(x, 19) ^ R(x, 10));}
    function core_sha256 (m, l) {
        var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
        var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
        var W = new Array(64);
        var a, b, c, d, e, f, g, h, i, j;
        var T1, T2;
        /* append padding */
        m[l >> 5] |= 0x80 << (24 - l % 32);
        m[((l + 64 >> 9) << 4) + 15] = l;
        for ( var i = 0; i<m.length; i+=16 ) {
            a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
            for ( var j = 0; j<64; j++) {
                if (j < 16) W[j] = m[j + i];
                else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
                T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
                T2 = safe_add(Sigma0256(a), Maj(a, b, c));
                h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
            }
            HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]); HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
        }
        return HASH;
    }
    function str2binb (str) {
      var bin = Array();
      var mask = (1 << chrsz) - 1;
      for(var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i%32);
      return bin;
    }
    function binb2hex (binarray) {
      var hexcase = 0; /* hex output format. 0 - lowercase; 1 - uppercase */
      var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
      var str = "";
      for (var i = 0; i < binarray.length * 4; i++) {
        str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) + hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
      }
      return str;
    }
    function hex_sha256(s){return binb2hex(core_sha256(str2binb(s),s.length * chrsz));}


////////////////////////////////////////////////////////////////////////////////


    //
    // BASE64 + SHA256
    //
    // The strange internal format used by the SHA256 calculation represents
    // the hash as an array of 8 integers.  We want to turn that into an
    // array of bytes so we can Base64 encode it.
    //
    // Also, the default encoding for Base64 is not safe to use in URLs.
    // This does the suggested substitutions:
    //
    //     '+' => '-'
    //     '/' => '_'
    //     '=' => '~'
    //
    // http://stackoverflow.com/a/5835352/211160
    //

    function intToByteArray(/*int*/num) {
        if ((num & 0xFFFFFFFF) != num) {
            throw Error("Integer out of range for intToByteArray");
        }
        var data = [];
        for (var i = 0; i < 4; i++) {
            data[i] = (num >> (i * 8)) & 0xff;
        }
        return data;
    }

    function urlencode_base64_sha256(s) {
        var binb = core_sha256(str2binb(s),s.length * chrsz);
        var bytes = [];
        for (var i = 0; i < binb.length; i++) {
            // http://stackoverflow.com/a/1374131/211160
            bytes.push.apply(bytes, intToByteArray(binb[i]));
        }
        var str = base64EncArr(bytes);
        str = str.replace(/\+/g, '-');
        str = str.replace(/\//g, '_');
        str = str.replace(/=/g, '~');
        return str;
    }


////////////////////////////////////////////////////////////////////////////////


    //
    // HTML ESCAPING
    //
    // Was using _.escape() from underscore.js, but when that dependency was
    // removed for the widget, no equivalent exists in jQuery.
    //
    // http://stackoverflow.com/a/12034334/211160
    //

    var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };

    function escapeHtml(string) {
        return String(string).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }


////////////////////////////////////////////////////////////////////////////////


    // Better to use these constants than test against "magic numbers"
    //
    // http://safalra.com/web-design/javascript/dom-node-type-constants/
    //
    // http://en.wikipedia.org/wiki/Document_Object_Model

    var Node = {
        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3,
        CDATA_SECTION_NODE: 4,
        ENTITY_REFERENCE_NODE: 5,
        ENTITY_NODE: 6,
        PROCESSING_INSTRUCTION_NODE: 7,
        COMMENT_NODE: 8,
        DOCUMENT_NODE: 9,
        DOCUMENT_TYPE_NODE: 10,
        DOCUMENT_FRAGMENT_NODE: 11,
        NOTATION_NODE: 12
    };


////////////////////////////////////////////////////////////////////////////////


    //
    // EXPORTED API
    //
    // What we return from this RequireJS "module function" is an object
    // whose contents represent that which we wish to export to the browser
    // or to NodeJS.  Though blackhighlighter can be loaded in the browser
    // with a jQuery dependency, it can also be loaded in Node.JS passing in
    // jQuery of null just to get the common non-UI functions.
    //
    // It should be noted that for the blackhighlighter widget itself, the
    // functionality is exported by adding onto the jQuery ($) entity
    // a .blackhighlighter() function.  That is not an option for exporting
    // common routines to Node.JS as there is no jQuery, and the
    // require("jquery.blackhighlighter") has to return something AND not
    // trigger any calls to jQuery because it will be null.
    //
    // Note that because the server-side doesn't use jQuery, and the client
    // side doesn't require underscore:
    //
    //       **** THIS SECTION MUST BE NATIVE JAVASCRIPT! ****
    //       **** THAT MEANS NO CALLS TO $() OR _.xxxxx() ****
    //
    // Although there is a forEach in ECMAscript 5, there's no real reason
    // to use it until warranted... just a simple old FOR will do.
    //
    // http://stackoverflow.com/a/9329476/211160
    //

    var exports = {

        // These are URLs that get exposed to end users, and as they are
        // already very long (base64 encodings of sha256) we try to keep
        // them brief as possible.

        makeVerifyUrl: function(base_url, commit_id) {
            return base_url + 'v/' + commit_id;
        },

        makeShowUrl: function(base_url, commit_id) {
            return base_url + 's/' + commit_id;
        },

        // These are API points under the hood; no need to shorten them

        makeCommitUrl: function(base_url) {
            return base_url + 'commit/';
        },

        makeRevealUrl: function(base_url) {
            return base_url + 'reveal/';
        },

        //
        // UUID
        // http://en.wikipedia.org/wiki/UUID
        //

        generateRandomUUID: function() {
            // 128 bits of random data is the size of a Uuid
            // http://bytes.com/groups/javascript/523253-how-create-Uuid-javascript

            function fourHex(count) {
                if (count === 0) {
                    return '';
                }

                // if count is null or undefined, assume 1

                var ret = '';
                for (var index = 0; index < (count ? count : 1); index++) {
                    ret += (((1 + Math.random()) * 0x10000) | 0)
                        .toString(16)
                        .substring(1);
                }
                return ret;
            }

            return (
                fourHex(2) + '-'
                + fourHex() + '-'
                + fourHex() + '-'
                + fourHex() + '-'
                + fourHex(3)
            );
        },

        stripHyphensFromUUID: function(uuid) {
            // standard Uuid format contains hyphens to improve readability
            // freebase and other systems that use Uuids in URLs don't have
            // the hyphens

            return uuid.replace(/-/g, '');
        },


        //
        // TYPE DETECTION
        //
        // REVIEW: Use better approaches?  Something like this?
        //  http://mattsnider.com/javascript/type-detection/
        //  http://mattsnider.com/core/type-detection-revisited/
        //

        isWhitespace: function(charToCheck) {
            // http://www.somacon.com/p355.php
            // added non-breaking space

            var whitespaceChars = ' \t\n\r\f\u00A0';
            return (whitespaceChars.indexOf(charToCheck) != -1);
        },

        //
        // JAVASCRIPT HELPERS
        //

        escapeNonBreakingSpacesInString: function(str) {
            // UNICODE \u00A0 is not escaped by JSON.stringify

            var nbspSplit = str.split('\u00A0');
            if (nbspSplit.length == 1) {
                return str;
            }

            var ret = nbspSplit[0];
            for (
                var nbspSplitIndex = 1;
                nbspSplitIndex < nbspSplit.length;
                nbspSplitIndex++
            ) {
                ret += '\\' + 'u00A0';
                ret += nbspSplit[nbspSplitIndex];
            }

            return ret;
        },

        // http://www.somacon.com/p355.php

        trimLeadingWhitespace: function(str) {
            var k = 0;
            while ((k < str.length) && this.isWhitespace(str.charAt(k))) {
                k++;
            }
            return str.substring(k, str.length);
        },

        trimTrailingWhitespace: function(str) {
            var j = str.length-1;
            while ((j >= 0) && this.isWhitespace(str.charAt(j))) {
                j--;
            }
            return str.substring(0, j + 1);
        },

        trimAllWhitespace: function(str) {
            return this.trimLeadingWhitespace(this.trimTrailingWhitespace(str));
        },


        //
        // DATA FORMAT NOTES
        //
        // "PublicOne PublicTwo [HiddenOne] PublicThree [HiddenTwo] PublicFour"
        //
        // The commit looks like this, and when put into the database it will
        // have added to it a MongoDB _id as well as a commit_date
        //
        // { "spans": [
        //      "PublicOne PublicTwo ",
        //      { "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
        //      " PublicThree ",
        //      { "display_length": 11, "sha256": "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce" },
        //      " PublicFour"
        //  ] }
        //
        // We must be able to check that the server doesn't change the content
        // of the commit out from under you.  Additionally, a client who *only*
        // has been given a URL needs to be able to do this check.  That means
        // the URL must encode enough information to test an unrevealed commit.
        // To do this, we make a cryptographic hash of a string made by
        // appending together the spans along with the commit_date.
        //
        // (Note: Because letters without redactions do not have reveal
        // certificates, the only thing differentiating two unredacted letters
        // is the commit_date.  Hence the client cannot know the actual URL
        // until after the server has decided the commit time.)
        //
        // A single revealJson looks like this, and when put into the database
        // it will have added to it a mongodb _id as well as a commit_date
        //
        // {
        //     "commit_id": "4f89521b67032a424a000002",
        //     "reveals": [
        //          [
        //              value: "HiddenOne",
        //              salt: "26716853c86b247fc81834822b0ca058",
        //              sha256: "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce"
        //          ], [
        //              value: "HiddenTwo",
        //              salt: "26716853c86b247fc81834822b0ca058",
        //              sha256: "c7363c3e5fb8fab684146fbb22cd0ef462e1f90e7fd52ef65c43c71da44435ce"
        //          ]
        //      ]
        // }
        //
        // (Note: Hash values are made up, will fix in real documentation.)

        canonicalJsonFromCommit: function(commit) {
            // There are some things to consider here regarding Unicode
            // Normalization and "Canonical JSON":
            // 
            // https://github.com/hostilefork/blackhighlighter/issues/56

            var result = '{"commit_date":';
            result += JSON.stringify(commit.commit_date);
            result += ',';

            var isFirstSpan = true;
            result += '"spans":[';
            for (var index = 0; index < commit.spans.length; index++) {
                var span = commit.spans[index];

                if (isFirstSpan) {
                    isFirstSpan = false;
                }
                else {
                    result += ',';
                }

                // Native test for string, no libraries
                // http://stackoverflow.com/a/9436948/211160

                if (typeof span == 'string' || span instanceof String) {
                    // We want to turn single quotes into \", etc.
                    // for our canonical representation

                    result += JSON.stringify(span);
                }
                else {
                    result += '["display_length":';
                    result += span.display_length.toString(10);
                    result += ',';
                    result += '"sha256":';
                    result += JSON.stringify(span.sha256);
                    result += ']';
                }
            }
            result += ']}';
            return result;
        },

        commitIdFromCommit: function(commit) {
            return urlencode_base64_sha256(this.canonicalJsonFromCommit(commit));
        },

        hashOfReveal: function(reveal) {
            return urlencode_base64_sha256(reveal.salt + reveal.contents);
        },

        generateHtmlFromCommitAndReveals: function (commit, reveal_array) {
            // https://github.com/hostilefork/blackhighlighter/issues/53

            // u'\u00A0' is the non breaking space
            // ...it should be preserved in db strings via UTF8
            
            // REVIEW: for each one that has been unredacted make
            // a hovery bit so that you can get a tip on when it was made public?
            // how will auditing be done?

            // http://documentcloud.github.com/underscore/#groupBy

            var revealsByHash = {};
            for (var index = 0; index < reveal_array.length; index++) {
                var reveal = reveal_array[index];

                if (revealsByHash[reveal.sha256] != null)
                    throw Error("More than one reveal for the same hash.");

                revealsByHash[reveal.sha256] = reveal_array[index];
            }
                
            var result = '';

            // The commits and reveals contain just ordinary text as
            // JavaScript strings, so "a < b" is legal.  But what we're
            // making here needs to be raw HTML in the template, to get
            // the spans and divs and such for the redaction in the
            // blacked-out bits.  We have to escape the span using
            // native JavaScript in this set of common exports.
            //
            // http://stackoverflow.com/a/12034334/211160

            var entityMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': '&quot;',
                "'": '&#39;',
                "/": '&#x2F;'
            };

            function escapeHtmlNativeJS (string) {
                return String(string).replace(/[&<>"'\/]/g, function (s) {
                    return entityMap[s];
                });
            }

            for (var index = 0; index < commit.spans.length; index++) {
                var commitSpan = commit.spans[index];

                if (
                    typeof commitSpan == 'string'
                    || commitSpan instanceof String
                ) {
                    commitSpan = escapeHtmlNativeJS(commitSpan);

                    // Also, line breaks must be converted to br nodes

                    result += commitSpan.split('\n').join('<br />');
                }
                else {
                    if (revealsByHash[commitSpan.sha256]) {
                        var reveal = revealsByHash[commitSpan.sha256];
                        result += '<span class="placeholder revealed">'
                            + '<span class="placeholder-sha256">'
                            + commitSpan.sha256
                            + '</span>'
                            + reveal.value
                            + '</span>';
                    }
                    else {                
                        var display_length = parseInt(
                            commitSpan.display_length, 10
                        );

                        // http://stackoverflow.com/a/1877479/211160

                        var placeholderString = Array(
                            display_length + 1
                        ).join('?');
                        
                        // REVIEW: use hex digest as title for query, or do
                        // something more clever?  we could add a method onto
                        // the element or keep a sidestructure

                        var placeholder = 
                            '<span class="placeholder protected">'
                            + '<span class="placeholder-sha256">'
                            + commitSpan.sha256
                            + '</span>'
                            + placeholderString 
                            + '</span>';

                        result += placeholder;
                    }
                }
            }

            return result;
        }
    };

    // Stop here if we don't have jQuery - all we want is the exports

    if ($.isFakeJquery) {
        return exports;
    }


////////////////////////////////////////////////////////////////////////////////


    //
    // INSTANCE INITIALIZATION
    //
    // While there is a DOM element in the tree representing the
    // contenteditable div, there is also a separate object representing the
    // properties of a blackhighlighter instance attached to that div.  I'm
    // not entirely sure about the advantages or disadvantages of this vs.
    // using jQuery .data() attached to the element (is that always cleared
    // when you unplug an element from the DOM?) but it works.
    //
    // One of these objects is instantiated whenever you call something like
    // $el.blackhighlighter({option: value}); and the instance lasts until
    // you call $el.blackhighlighter("destroy");
    //

    var Blackhighlighter = function($div, opts) {
        Blackhighlighter._registry.push(this);

        this.$div = $div;

        // Grab a copy of whatever was in the div at the time of initialization

        this.initialContent = $div.contents().clone();

        // keep track of if we added it to take it off?

        $div.addClass("blackhighlighter");

        // Event delegation sounds like a good idea; to handle elements that
        // are added dynamically with CSS selectors.  Problem is, the CSS
        // selectors have a pecking order based on "specificity":
        //
        // http://htmldog.com/guides/css/intermediate/specificity/
        //
        // In the end, it's safer to put the functions directly onto the
        // elements they want to act on.  jQuery UI was overriding
        // "div.blackhighlighter-protect span.protected" but not
        // when the div wasn't specified, but just saying span.protected
        // would be too broad.  Would be nice if it worked; it doesn't.
        //
        /* $div.on('click', 'div.blackhighlighter-protect span.suggested',
            $.proxy(this._takeSuggestionListener, this)
        );
        $div.on('click', 'div.blackhighlighter-protect span.protected',
            $.proxy(this._unprotectSpanListener, this)
        ); */

        if (opts.mode === 'show') {
            if (opts.commit) {
                this.commit = opts.commit;
            }
            else {
                throw "Starting a blackhighlighter in show mode requires a commit in the options";
            }
        }
        else {
            if (opts.commit) {
                throw "Can't start a compose/protect blackhighlighter with a commit";
            }
        }

        // Protections are local reveals in the show/reveal modes

        this.protections = {};

        // We want to set up the reveals and check that their hashes match

        this.reveals = {};
        if (opts.reveals) {
            this.seeProtections(opts.reveals, true);
        }

        // Set the mode (needs the commit/protections to update titles)

        this.setMode(opts.mode, true);

        // When the content of the text area is modified, we want to give
        // an update notification to clients of the widget.
        //
        // REVIEW: Should we use the .trigger mechanism to offer all
        // of our events, or is it better to pass the functions in as
        // parameters to the config?
        //
        // http://stackoverflow.com/a/6263537/211160
        
        this.$div.on('focus', function() {
            var $this = $(this);
            $this.data('before', $this.html());
            return $this;
        });

        this.$div.on('blur keyup paste input', function() {
            var instance = Blackhighlighter.getInstance(this);
            var $this = $(this);
            if ($this.data('before') !== $this.html()) {
                $this.data('before', $this.html());
                $this.trigger('change');
            }
            return $this;
        });

        // We need some kind of updating/event model so that clients can
        // know at least if someone has redacted or unredacted...or typed
        // into the widget.

        this.$div.on('change', function() {
            var instance = Blackhighlighter.getInstance(this);
            instance.update();
            return true;
        });

        if (opts.update) $div.bind("update.blackhighlighter", opts.update);
    };

    // Stores (active) `Blackhighlighter` instances
    // Destroyed instances are removed

    Blackhighlighter._registry = [];

    // Returns the `Blackhighlighter` instance given a DOM node

    Blackhighlighter.getInstance = function(div) {
        var $divs = $.map(Blackhighlighter._registry, function(instance) {
                return instance.$div[0];
            }),
            index = $.inArray(div, $divs);
        return index > -1 ? Blackhighlighter._registry[index] : null;
    };


////////////////////////////////////////////////////////////////////////////////


    Blackhighlighter.prototype = {

        // Attaches input events
        // Only attaches `keyup` events if `input` is not fully suported

        /* attach: function() {
            var events = 'input.blackhighlighter change.blackhighlighter',
                _this = this;
            if(!inputSupported) events += ' keyup.blackhighlighter';
            this.$textarea.bind(events, function() { _this.update(); });
        },*/

        // In "expanding" (the plugin I modeled after), this would update the
        // clone and trigger an event.  I'm using it just to say when things
        // get protected or unprotected.  Enhance event model later when I
        // understand it better

        update: function() {

            // Use `triggerHandler` to prevent conflicts with `update`
            // in Prototype.js

            this.$div.triggerHandler("update.blackhighlighter");
        },

        // Tears down the plugin on the object

        destroy: function() {
            var index = $.inArray(this, Blackhighlighter._registry);
            if (index > -1) Blackhighlighter._registry.splice(index, 1);

            // REVIEW: clean up any contenteditable or events?
            // version of setMode for targeting an undefined mode to help?

            // can pass more in string, space-delimited

            this.$div.unbind('update.blackhighlighter');
        },

////////////////////////////////////////////////////////////////////////////////


        //
        // MODE TRANSITIONS
        //

        _addSuggestionsRecursive: function(node) {

            var lastPushWasText = false;

            // re-interleave the splits and matches...which goes first depends
            // on whether the match was at the first position.

            function pushSuggestSpan(str) {
                var $span = $('<span class="placeholder suggested"></span>');
                $span.append($(document.createTextNode(str)));
                $(node).before($span);
                $span.on('click', $.proxy(this._takeSuggestionListener, this));
                lastPushWasText = false;
            }

            function pushTextNode(str) {
                if (lastPushWasText) {
                    throw "Pushed two text nodes in a row, need normalization for that.";
                }
                if (str !== '') {
                    $(node).before(document.createTextNode(str));
                    lastPushWasText = true;
                }
            }

            // This is just a simple demonstration of the concept that the
            // editor could be looking for things you might want to protect
            // and suggest them for you.  While there are limits to how good
            // a job a browser client can do without talking to *some* server
            // to analyze for you, one could use a local/trusted server to
            // do it.
            //
            // NOTE: Blackhighlighter should only implement the suggestion
            // offering interface, not scan for the suggestions itself.
            // This needs to be broken out as an API.  At minimum, put the
            // suggest regexes in the options for now.

            var nodeType = $.type(node.nodeType) === undefined
                ? Node.ATTRIBUTE_NODE
                : node.nodeType;

            // search all textnodes that aren't under protected spans

            switch (nodeType) {
                case Node.TEXT_NODE:
                    var strData = node.data;

                    // http://development.thatoneplace.net/2008/05/bug-discovered-in-internet-explorer-7.html
                    /* var regexEmail = /[0-9a-zA-Z]+@[0-9a-zA-Z]+[\.]{1}[0-9a-zA-Z]+[\.]?[0-9a-zA-Z]+/g; */
                    // using /g option does a global search

                    var regexEmail = /[0-9a-zA-Z]+@[0-9a-zA-Z]+[\.][0-9a-zA-Z]+[\.]?[0-9a-zA-Z]+/g;
                    var firstMatchPos = strData.search(regexEmail);

                    if (firstMatchPos == -1) {
                        // no matches, leave node alone

                        break;
                    }

                    var splitArray = strData.split(regexEmail);

                    // NOTE: Inconsistent cross-browser behavior led me to
                    // switch from RegExp.exec() to using String.match() --
                    // sometimes exec() did not reset the lastIndex
                    // for the next time this procedure is called (Firefox) and
                    // in IE there were even weirder problems where the first
                    // call would return null but the second would not
                    // (even with regexEmail.lastIndex = 0).

                    // reset lastIndex so we find first match again

                    regexEmail.lastIndex = 0;

                    var matchArray = strData.match(regexEmail);

                    var matchIndex = 0;
                    var splitIndex = 0;

                    // internet explorer does not return empty spans at start
                    // and end of match array, so we can prune them off for
                    // firefox...

                    if (splitArray[0] === '') {
                        splitIndex++;
                    }

                    while (
                        (matchIndex < matchArray.length)
                        && (splitIndex < splitArray.length)
                    ) {
                        if (firstMatchPos == 0) {
                            pushSuggestSpan.call(this, matchArray[matchIndex++]);
                            pushTextNode.call(this, splitArray[splitIndex++]);
                        }
                        else {
                            pushTextNode.call(this, splitArray[splitIndex++]);
                            pushSuggestSpan.call(this, matchArray[matchIndex++]);
                        }
                    }

                    if (firstMatchPos === 0) {
                        if (matchIndex < matchArray.length) {
                            pushSuggestSpan(matchArray[matchIndex++]);
                        }
                    }
                    else {
                        if (splitIndex < splitArray.length) {
                            pushTextNode(splitArray[splitIndex++]);
                        }
                    }

                    if (
                        (splitIndex != splitArray.length)
                        || (matchIndex != matchArray.length)
                    ) {
                        throw "Unreachable condition in regular expression matcher for addProtectSuggestions.";
                    }

                    $(node).remove();
                    break;

                case Node.ELEMENT_NODE:
                    if (
                        (node.tagName.toLowerCase() != 'span')
                        || (!$(node).hasClass('protected'))
                    ) {
                        var child = node.firstChild;
                        while (child) {
                            var next = child.nextSibling;
                            this._addSuggestionsRecursive(child);
                            child = next;
                        }
                    }
                    break;

                default:
                    break;
            }
        },

        // IE does strange behaviors for the DOM element's normalize() function
        // such as wrapping text nodes in divs sometimes (?)  This
        // re-implementation is more explicit and avoids bugs with that.
        //
        // http://stackoverflow.com/a/22339405/211160

        _safeNormalize: function (element) {
            function collectTextNodes(textNode) {
                // while there are text siblings, concatenate into the first

                while (textNode.nextSibling) {
                    var next = textNode.nextSibling;
                    if (
                        next.nodeType == Node.TEXT_NODE
                        || next.nodeType == Node.CDATA_SECTION_NODE
                    ) {
                        textNode.nodeValue += next.nodeValue;
                        textNode.parentNode.removeChild(next);
                    }
                    else {
                        // Stop if not a text node

                        return;
                    }
                }
            }

            var node = element.firstChild;

            // Traverse siblings, call normalise for elements and
            // collectTextNodes for text nodes

            while (node && node.nextSibling) {
                if (node.nodeType == 1) {
                    this._safeNormalize(node);
                }
                else if (node.nodeType == 3) {
                    collectTextNodes(node);
                }
                node = node.nextSibling;
            }
        },

        _removeSuggestions: function() {
            var instance = this;
            this.$div.find('span.suggested').each(function(idx, span) {
                var $span = $(span);
                var $parent = $span.parent();
                $span.replaceWith($span.contents().remove());
                instance._safeNormalize.call(instance, $parent.get(0));
            });
        },

        _canonizeContent: function() {
            var instance = this;

            // First canonize all the <p> tags for browsers that make them into
            // <div> instead. As you might expect, an easy thing to change is
            // hard; tags on elements can't change without disrupting content.
            //
            // Note we lose any attributes that may have been attached to the
            // paragraph.  As we're going for canon, that's not a bad thing in
            // this case...in fact we should probably strip *more* information!
            //
            // http://stackoverflow.com/a/1695200/211160

            this.$div.find("p").each(function(idx, el) {
                var oldP = $(el);
                var newDiv = $('<div></div>');
                oldP.before(newDiv);
                newDiv.append(oldP.contents());
                oldP.remove();
            });

            // If there are no divs or br at all, then wrap the whole thing up
            // into one single div.

            if (!this.$div.find("div, br").length) {
                var $newDiv = $("<div></div>").append(
                    this.$div.contents().remove()
                );
                this.$div.append($newDiv);
            }

            // Due to wacky behavior of the ::selection pseudoclass, a custom
            // selection color will not apply to any *empty space* that crosses
            // line breaks.  This looks ugly.  There are other reasons for
            // canonizing the input so there are only <div></div> sections
            // with no <br> (simplifies later processing), so it's worth
            // doing regardless of this quirk.

            // Hard to canonize any arbitrary input here, because you can't
            // (for instance) blindly transform all <div>foo</div> into foo<br>
            // So this is an attempt to "make it work".  Common pattern in the
            // contenteditable implementions looks to begin the container
            // with something not in a div, with things after that put into
            // divs...which causes a break similar to as if it was in a div.
            // So account for that one, at least.

            if (
                (this.$div.contents().length >= 2)
                && (!this.$div.contents().eq(0).is("div"))
                && (this.$div.contents().eq(1).is("div"))
            ) {
                this.$div.contents().eq(0).wrapAll("<div></div>");
            }

            // After that let's flatten, and hope for the best.

            this.$div.find("div").each(function(idx, el) {
                var $el = $(el);

                // Flatten by putting content before, break after, and remove

                if (
                    ($el.contents().length == 1)
                    && ($el.contents().first().is("br"))
                ) {
                    $el.after($('<br>'));
                    $el.remove();
                }
                else {
                    $el.after($('<br>'));
                    $el.before($el.contents());
                    $el.remove();
                }
            });

            // Now we recover the structure adapting code from StackOverflow
            //
            // http://stackoverflow.com/q/18494385/211160

            var $contents = this.$div.contents();
            var $cur, $set, i;
            $set = $();
            for (i = 0; i < $contents.length; i++) {
                $cur = $contents.eq(i);

                if ($cur.is("br")) {
                    if ($set.length > 0) {
                        $set.wrapAll("<div></div>");
                        $cur.remove();
                    }
                    else {
                        // An actual line break.  Wrap in a span so that we
                        // don't have content as a direct child of the
                        // contenteditble (causes ugly selection UI)

                        $cur.replaceWith(
                            $('<div class="nbsp-spacing-hack">&nbsp;</div>')
                        );
                    }
                    $set = $();
                }
                else {
                    $set = $set.add($cur);
                }
            }
            $set.wrapAll("<div></div>");

            // We want only text nodes or to preserve any protection spans.
            // There may be things other than these that made it into
            // the contenteditable, even with our pasting filter.  Example:
            // IE has a "feature" where it will always turn things that
            // look like hyperlinks or email addresses into anchors.  Seems
            // you can't turn it off.
            //
            //   http://drupal.org/node/191644

            this.$div.contents().each(function () {
                var $subDiv = $(this);
                if (!$subDiv.is('div')) {
                    throw Error("Canonization produced non-div toplevel elem");
                }

                // Only look at the non-text nodes...

                $subDiv.children().each(function () {
                    var $child = $(this);
                    if (
                        !$child.is('span')
                        && !$child.hasClass('placeholder')
                    ) {
                        $child.replaceWith(
                            $(document.createTextNode($child.text()))
                        );
                    }
                });

                instance._safeNormalize.call(instance, $subDiv.get(0));
            });


            // HTML collapses all whitespace as not being visually significant
            // but if the content is in a text node, it's not a problem.  We
            // may need to do some processing on the text nodes, but leaving
            // it out for now.
            //
            // http://stackoverflow.com/a/4399718/211160
            //
/*
            var getTextNodesIn = function(el) {
                return $(el).find(":not(iframe)")
                    .addBack().contents().filter(function() {
                        return this.nodeType == Node.TEXT_NODE;
                    });
            };
            getTextNodesIn(this.$div).each(function(idx, el) {
                // http://stackoverflow.com/questions/7635952/
                var str = el.nodeValue;
                str = str.replace(/\s+/g, " ");
                str = str.replace(/^\s+|\s+$/g, "");
                // should we also do something with zero-no-width joiners?
                el.nodeValue = str;
            });
*/
        },

        _decanonizeContent: function() {
            var instance = this;

            // One simple way to decanonize is just to leave the first element
            // outside of a div, with all the successive elements keeping their
            // divs and wrapping actual breaks in divs.  This is what webkit
            // seems to do, and if it weren't for the selection stuff I'd have
            // left it be.
            //
            // If only custom selection color wasn't so fickle :-/

            this.$div.children().each(function(idx, el) {
                var $el = $(el);
                if ($el.is("div") && $el.hasClass("nbsp-spacing-hack")) {
                    $el.html($('<br>'));
                    $el.removeClass("nbsp-spacing-hack");
                }
                if ($el.is("div") && (idx == 0)) {
                    $el.before($el.contents());
                    $el.remove();
                }
                instance._safeNormalize.call(instance, $el.get(0));

                // Just leave it otherwise.
            });
        },

        setMode: function(newMode, initializing) {
            var oldMode = undefined;

            if (!initializing) {
                oldMode = this.mode;
                if (oldMode == newMode) {
                    return;
                }

                switch (oldMode) {
                    case 'compose': {
                        this.$div
                            .attr("contenteditable", false)
                            .removeClass("blackhighlighter-compose");
                        break;
                    }

                    case 'protect': {
                        this.$div
                            .removeClass("blackhighlighter-protect")
                            .off("mousedown", this._inkOnListener, this)
                            .off("mouseup mouseleave",
                                this._inkOffListener, this
                            );

                        // Just in case it got stuck somehow :-/

                        this.$div.removeClass("blackhighlighter-ink");

                        // See notes on why I'm doing it this way.
                        // Using less-specificity in selectors, or delegates,
                        // led events to be snapped up by jQuery UI

                        this.$div.find("span.protected").off(
                            'click', this._unprotectSpanListener
                        );

                        this._removeSuggestions();
                        this._decanonizeContent();
                        break;
                    }

                    case 'show': {
                        this.$div
                            .removeClass("blackhighlighter-show");
                        break;
                    }

                    case 'reveal': {
                        this.$div
                            .removeClass("blackhighlighter-reveal");

                        clearInterval(this.blinkTimer);

                        this.$div.find('.placeholder.verified.unmasked')
                            .css('background-color', '');
                        break;
                    }

                    default:
                        throw "Internal blackhighlighter error: bad mode found.";
                }
            }

            // Invariant: no classes we've added here should be applied
            // If we use this routine to cleanup, we may need to tolerate
            // a shutdown where we don't apply anything.  Content is
            // decanonized from our internal form to whatever the browser
            // likes best for non-blackhighlighter divs.

            function blinker() {
                this.$div.find('.placeholder.verified.unmasked')
                    .css('background-color',
                        blinker.isRed ? '' : 'transparent');
                blinker.isRed = !blinker.isRed;
            }
            blinker.isRed = false;

            switch (newMode) {
                case 'compose': {
                    if (!initializing && (oldMode !== 'protect')) {
                        throw "Can only go from protect to compose.";
                    }

                    this.$div
                        .attr("contenteditable", true)
                        .addClass("blackhighlighter-compose");
                    break;
                }

                case 'protect': {
                    if (!initializing && (oldMode !== 'compose')) {
                        throw "Can only go from compose to protect.";
                    }

                    this.$div.addClass("blackhighlighter-protect");
                    this._canonizeContent();

                    // See notes on why I'm doing it this way.
                    // Using less-specificity in selectors, or delegates,
                    // led events to be snapped up by jQuery UI

                    this.$div.find("span.protected").on('click',
                        $.proxy(this._unprotectSpanListener, this)
                    );

                    // Selection changes are finalized by selected, or mouseup?
                    // What do we really want to capture here?

                    this.$div.on("mousedown",
                        $.proxy(this._inkOnListener, this)
                    );

                    // We have to track leaves, because mouseups get lost if
                    // you leave the area, even briefly.  Better solution?
                    //
                    // http://stackoverflow.com/a/12348816/211160

                    this.$div.on("mouseup mouseleave",
                        $.proxy(this._inkOffListener, this));

                    this._addSuggestionsRecursive(this.$div.get(0));
                    break;
                }

                case 'show':
                    // If we came from the old mode that was either a "compose"
                    // or a "protect", then we're doing this in an "Ajax" way
                    // vs. the "Noscript compatible search-engine-friendly"
                    // way, and have to generate the HTML client side.

                    // REVIEW: Should we be alerting if this.protections is not
                    // empty right after a commit?

                    if ((oldMode == 'compose') || (oldMode == 'protect')) {
                        this.$div.html(
                            exports.generateHtmlFromCommitAndReveals(
                                this.commit, []
                            )
                        );
                    }

                    this.$div.addClass("blackhighlighter-show");
                    break;

                case 'reveal':
                    if (oldMode !== 'show') {
                        throw "Can only go from show to reveal.";
                    }
                    this.$div.addClass("blackhighlighter-reveal");
                    this.blinkTimer = setInterval($.proxy(blinker, this), 800);
                    break;

                default:
                    throw "Invalid mode passed to setBlackhighlighterMode: " + newMode;
            }

            this.mode = newMode;

            this._updateSpanTitles(this.$div.find('span').filter('.placeholder'));
        },


////////////////////////////////////////////////////////////////////////////////


        //
        // PROTECT MODE
        //

        // We seem to get empty text nodes for some reason, at least in Firefox
        // Jquery is not good at dealing with text nodes so best to use DOM
        // to kill them
        //
        // REVIEW: Why are these showing up?  Is it this?
        //
        // http://markmail.org/message/uuoieaafwn6h6gxz
        // http://reference.sitepoint.com/javascript/Node/normalize

        _killEmptyTextNodesRecursivePreorder: function($node) {
            var instance = this;

            // http://www.jslab.dk/articles/non.recursive.preorder.traversal.part2

            if (
                ($node.get(0).nodeType == Node.TEXT_NODE)
                && !$node.text()
            ) {
                $node.remove();
            }
            else {
                $.each($node.contents(), function(idx, child) {
                    var $child = $(child);
                    instance._killEmptyTextNodesRecursivePreorder($child);
                });
            }
        },

        _normalizeProtectionsInSubtree: function(elm) {
            var instance = this;

            // Normalize protected spans so that ones sitting adjacent to each
            // other are unified into a single protected span

            var deleteSpans = [];
            $(elm).find('span').filter('.protected').each(function(i) {
                // REVIEW: short circuit if this is in deleteSpans?

                var current = this.nextSibling;
                while (
                    (current !== null)
                    && (current.nodeType == Node.ELEMENT_NODE)
                    && (current.tagName.toLowerCase() == 'span')
                    && $(current).hasClass('protected')
                ) {
                    $(current).contents().remove().appendTo(this);
                    instance._safeNormalize.call(instance, this);
                    deleteSpans.push(current);
                    current = current.nextSibling;
                }
            });
            $.each(deleteSpans, function(idx, span) {
                $(span).remove();
            });
        },

        _unprotectSpan: function($span) {
            if (this.mode !== 'protect') {
                throw "Can't unprotect span outside of protect mode";
            }
            if (!$span.hasClass('protected')) {
                throw "trying to unprotect a non-protected span";
            }

            var $parent = $span.parent();
            $span.replaceWith($span.contents().remove());

            // We shouldn't need to remove the event handler, it will GC

            /* $span.off('click', this._unprotectSpan); */

            // Merge all text nodes under the parent

            this._safeNormalize.call(this, $parent.get(0));
            this._killEmptyTextNodesRecursivePreorder($parent);
        },

        _clearUserSelection: function() {
            // http://www.webmasterworld.com/javascript/3074874.htm

            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            }
            else if (document.selection) {
                document.selection.empty();
            }
        },

        _unprotectSpanListener: function(event) {
            // http://www.quirksmode.org/js/events_properties.html

            var $target = $(event.target);
            this._clearUserSelection();
            this._unprotectSpan($target);
            this.update();
            return true;
        },

        _takeSuggestionNoNormalize: function($span) {
            // We do this during an enumeration, and normalizing would
            // disrupt the enumeration.

            if (this.mode !== 'protect') {
                throw "Can't take protect suggestion outside of protect mode";
            }
            if (!$span.hasClass('suggested')) {
                throw "trying to take non-suggested span";
            }

            $span.removeClass("placeholder suggested");
            $span.off('click', $.proxy(this._takeSuggestionListener, this));

            $span.addClass("placeholder protected");
            $span.on('click', $.proxy(this._unprotectSpanListener, this));

            this._updateSpanTitles($span);
        },

        _takeSuggestion: function($span) {
            var $parent = $span.parent();
            this._takeSuggestionNoNormalize($span);
            this._normalizeProtectionsInSubtree($parent);
        },

        _takeSuggestionListener: function(event) {
            // http://www.quirksmode.org/js/events_properties.html

            var $target = $(event.target);
            this._clearUserSelection();
            this._takeSuggestion($target);
            this.update();
            return true;
        },

        _makeProtectedSpan: function(str) {
            if (!str) {
                throw "Empty string passed to _makeProtectedSpan";
            }
            var $span = $('<span class="placeholder protected"></span>');
            $span.append($(document.createTextNode(str)));
            if (this.mode === 'protect') {
                $span.on('click', $.proxy(this._unprotectSpanListener, this));
            }
            this._updateSpanTitles($span);
            return $span;
        },

        _inkOnListener: function(event) {
            var instance = this;
            this.$div.addClass("blackhighlighter-ink");
            return true;
        },

        _protectRangeIfApplicable: function(range) {
            var instance = this;

            var $startContainer = $(range.startContainer);
            var $endContainer = $(range.endContainer)

            // Do inclusive test; if the common ancestor of the selection is
            // not fully inside the blackhighlighter div, then some amount
            // of the selection is outside.  A decision needs to be made
            // about how to handle this, currently ignore.  See:
            //
            // https://github.com/hostilefork/blackhighlighter/issues/30

            if ($.contains(this.$div, $(range.commonAncestorContainer))) {
                return false;
            }

            // Note: Though it may seem that you'd always be selecting
            // the text node in the span instead of the span itself, the
            // IE range shim sometimes treats a span with a text node in it
            // as the container, for no good reason.  We adjust that to
            // use the contents and hope for the best.

            if ($startContainer.is('span')) {
                $startContainer = $startContainer.contents();

                if ($startContainer.length != 1) {
                    throw Error("Unexpected span length in selection.");
                }

                if ($startContainer.get(0).nodeType !== Node.TEXT_NODE) {
                    throw Error("Unexpected span contents in selection.");
                }
            }

            if ($endContainer.is('span')) {
                $endContainer = $endContainer.contents();

                if ($endContainer.length != 1) {
                    throw Error("Unexpected span length in selection.");
                }

                if ($endContainer.get(0).nodeType !== Node.TEXT_NODE) {
                    throw Error("Unexpected span contents in selection.");
                }
            }

            // SANITY CHECK!
            //
            // After normalization, the structure of the blackhighlighter
            // has been changed to where all selections should be within
            // sibling divs, or inside a span in one of those divs.
            //
            // Before we start making ANY changes, make sure this is the
            // case, and throw an error if not.
            //
            // Note: we allow a depth of one span.  Even if a mouse click
            // would generally be intercepted by a protected span to unprotect
            // first, they can still drag a selection into one and end it
            // there.  Same for the suggested spans.  Also, we don't know what
            // alternative UI or programmatic API might have been used to
            // make the selection... so if it's valid, we should accept it
            // even if it's not clear how the UI could have gotten that way.

            var $startDiv = $startContainer;
            var $endDiv = $endContainer;

            if ($startDiv.get(0).nodeType === Node.TEXT_NODE) {
                $startDiv = $startDiv.parent();
                if ($startDiv.is('span')) {
                    $startDiv = $startDiv.parent();
                }
            }

            if ($endDiv.get(0).nodeType === Node.TEXT_NODE) {
                $endDiv = $endDiv.parent();
                if ($endDiv.is('span')) {
                    $endDiv = $endDiv.parent();
                }
            }

            // The normalization structure should mean that all the paragraphs
            // are in divs, and line breaks are done with our special class

            if (!$startDiv.is('div')) {
                throw Error("Blackhiglighter sel doesn't start in a div");
            }

            if (!$endDiv.is('div')) {
                throw Error("Blackhiglighter sel doesn't end in a div");
            }

            if (!$startDiv.parent().is($endDiv.parent())) {
                throw Error("Blackhighlighter start/end different parents");
            }

            if (!$startDiv.parent().is(this.$div)) {
                throw Error("Selection isn't normalized inside container");
            }

            // Finally, we ensure we can enumerate safely in a forward
            // direction from the starting div through its later siblings and
            // hit the ending div (inclusive, as start may equal end)

            var foundEnd = false;

            $startDiv.nextAll().add($startDiv).each(function (idx, el) {
                var $el = $(el)
                if ($el.is($endDiv)) {
                    foundEnd = true;
                    return false; // break the loop
                }
            });

            if (!foundEnd) {
                throw Error("Illegal enumeration in blackhighlighter area.");
            }

            // DOM TextNodes really are second-class citizens in jQuery
            // http://stackoverflow.com/questions/16452127/

            function indexIncludingTextNodes($node) {
                var node = $node.get(0);
                var n = 0;
                while (node = node.previousSibling) {
                    n++;
                }
                return n;
            }

            function redactFn (idx, el) {
                var $el = $(el);

                if (el.nodeType === Node.TEXT_NODE) {
                    $el.replaceWith(instance._makeProtectedSpan(el.nodeValue));
                }
                else if ($el.is('span')) {
                    if ($el.hasClass('protected')) {
                        // nothing
                    }
                    else if ($el.hasClass('suggested')) {
                        instance._takeSuggestionNoNormalize($el);
                    }
                }
                else {
                    throw "Unknown element found in blackhighlighter."
                }
            }


            // ACTUAL REDACTION WORK
            //
            // Now that we know the selection is good, we need to handle all
            // the cases.  To make the work easier, we transform things
            // into unmerged spans and text nodes and then normalize them at
            // the end of the operation.  I'm sure it could be done more
            // elegantly, but for now I'll go with obvious/correct.

            // First we clear the selection, because regardless of what we
            // do we don't want the visual XORing to happen.

            this._clearUserSelection();

            var startOffset = range.startOffset;
            var endOffset = range.endOffset;

            // First of all, it is technically possible to get selections
            // into the hack containers.  We don't redact these, although
            // for UI reasons it might be considered to help unredact
            // groups.  But for now just shift the start/end to skip them.

            if ($startContainer.parent().hasClass("nbsp-spacing-hack")) {
                $startContainer = $startContainer.parent();
            }

            while ($startContainer.hasClass("nbsp-spacing-hack")) {
                if ($startContainer.is($endContainer)) {
                    return false;
                }
                $startContainer = $startContainer.next();
                startOffset = 0;
            }

            if ($endContainer.parent().hasClass("nbsp-spacing-hack")) {
                $endContainer = $endContainer.parent();
            }

            while ($endContainer.hasClass("nbsp-spacing-hack")) {
                if ($endContainer.is($startContainer)) {
                    // Shouldn't happen, or we'd have hit it above!
                    throw "Internal error in nbsp-spacing-hack enumeration";
                }
                $endContainer = $endContainer.prev();
                endOffset = $endContainer.contents().length;
            }

            // Start with taking care of the case where the start and end are
            // text nodes, doing the substring and splicing work to make
            // protection spans.  We need to handle this specially because
            // if we try to handle the edges on their own we might disrupt
            // the start or end without recognizing them as being the same.
            //
            // http://www.bennadel.com/blog/2159-Using-Slice-Substring-And-Substr-In-Javascript.htm

            var $startParent = $startContainer.parent();
            var $endParent = $endContainer.parent();

            if (
                $startContainer.is($endContainer)
                && ($startContainer.get(0).nodeType === Node.TEXT_NODE)
            ) {
                // Start and end in same text node; needs particular handling

                if ($startParent.is("span")) {
                    if ($startParent.hasClass("protected")) {
                        console.error("Note: redacting inside redaction");
                        return false;
                    }
                    else if ($startParent.hasClass("suggested")) {
                        console.error("Note: redacting inside suggestion");
                        $startParent.replaceWith(
                            $startParent.contents().remove()
                        );
                    }
                    else {
                        throw "Unknown span selection in blackhighlighter";
                    }
                }

                var str = $startContainer.get(0).nodeValue;
                var $span = this._makeProtectedSpan(
                    str.substring(startOffset, endOffset)
                );

                var rest = document.createTextNode(str.substr(endOffset));
                $startContainer.get(0).nodeValue = str.slice(0, startOffset);

                $startContainer.after($span);
                $span.after(rest);
            }
            else {

                // If start or end are in a text node otherwise, we handle them

                if ($startContainer.get(0).nodeType === Node.TEXT_NODE) {
                    if (
                        $startParent.is("span")
                        && $startParent.hasClass("protected")
                    ) {
                        // ignore it (you can't redact it more) but climb a
                        // level startOffset is always 0 here, because spans
                        // contain only one text node; hardcode it?

                        startOffset = indexIncludingTextNodes($startContainer);
                        $startContainer = $startContainer.parent();
                    }
                    else {
                        if ($startParent.is("span")) {
                            if ($startParent.hasClass("suggested")) {
                                $startParent.replaceWith(
                                    $startParent.contents().remove()
                                );
                            }
                            else {
                                throw "Unknown span selection in blackhighlighter";
                            }
                        }

                        var startStr = $startContainer.get(0).nodeValue;
                        var $startSpan = this._makeProtectedSpan(
                            startStr.substr(startOffset)
                        );

                        $startContainer.get(0).nodeValue
                            = startStr.slice(0, startOffset);

                        $startContainer.after($startSpan);

                        // As what's left of start container is now a text node
                        // we *don't* want to redact, use protected span for
                        // further indication of the start of the redaction

                        $startContainer = $startSpan;

                        // We added a sibling text node; this may disrupt the
                        // endOffset if it was counting one of those siblings

                        if ($startContainer.parent().is($endContainer)) {
                            endOffset++;
                        }
                    }
                    startOffset = indexIncludingTextNodes($startContainer);
                    $startContainer = $startContainer.parent();
                }

                if ($endContainer.get(0).nodeType === Node.TEXT_NODE) {
                    if (
                        $endParent.is("span")
                        && $endParent.hasClass("protected")
                    ) {
                        // ignore it (you can't redact it more)

                        // endOffset is always 0 here, because spans contain
                        // only one text node; hardcode it?

                        endOffset = indexIncludingTextNodes($endContainer);
                        $endContainer = $endContainer.parent();
                    }
                    else {
                        if ($endParent.is("span")) {
                            if ($endParent.hasClass("suggested")) {
                                $endParent.replaceWith(
                                    $endParent.contents().remove()
                                );
                            }
                            else {
                                throw "Unknown span selection in blackhighlighter";
                            }
                        }

                        var endStr = $endContainer.get(0).nodeValue;
                        var $endSpan = this._makeProtectedSpan(
                            endStr.slice(0, endOffset)
                        );
                        $endContainer.get(0).nodeValue = endStr.substr(endOffset);
                        $endContainer.before($endSpan);

                        // As what's left of end container is now a text node
                        // we *don't* want to redact, use protected span for
                        // further indication of the end of the redaction

                        $endContainer = $endSpan;
                    }

                    endOffset = indexIncludingTextNodes($endContainer);
                    $endContainer = $endContainer.parent();
                }

                // From this point on, the only text nodes we'll be processing
                // will be redacted in their entirety.  $startContainer and
                // $endContainer should be under sibling divs, so let's just
                // check that to be sure.

                if (!$startContainer.parent().is($endContainer.parent())) {
                    throw Error("Assertion failed: startContainer != endContainer");
                }

                if ($startContainer.is($endContainer)) {
                    // Slice goes up to but does not include end
                    // So should this be endOffset + 1 ?

                    $startContainer.contents()
                        .slice(startOffset, endOffset)
                        .each(redactFn);
                }
                else {
                    // This is a div-spanning operation.  REVIEW: apply the
                    // redaction indicator to blank lines we cross in order
                    // to help with the unredaction of groups with
                    // continuity?

                    $startContainer.contents()
                        .slice(startOffset)
                        .each(redactFn);

                    $endContainer.contents()
                        .slice(0, endOffset)
                        .each(redactFn);

                    $startContainer.nextUntil($endContainer).each(
                        function (idx, div) {
                            var $div = $(div);
                            if (!$div.hasClass("nbsp-spacing-hack")) {
                                $(div).contents().each(redactFn);
                            }
                        }
                    );
                }
            }

            // Our selection can potentially have two partial ranges
            // Normalize the text nodes in each div so that if two Text nodes
            // are adjacent to each other they become one.  (Note: Review the
            // necessity of this given the new implementation technique)

            this.$div.find("div").each(function(idx, el) {
                instance._safeNormalize.call(instance, el);
            });

            this._killEmptyTextNodesRecursivePreorder(this.$div);
            this._normalizeProtectionsInSubtree(this.$div);

            // we must unselect the selection, or the XORing will make it look
            // bad and not all blacked out
            // http://www.webreference.com/js/column12/selectionobject.html

            this._clearUserSelection();

            this.update();
            return true;
        },

        _inkOffListener: function(event) {
            var $target = event.target;

            this.$div.removeClass("blackhighlighter-ink");

            var sel = window.getSelection();

            for(var i = 0; i < sel.rangeCount; i++) {
                var range = sel.getRangeAt(i);

                if (!range) {
                    // this happens in IE
                }
                else if (
                    (range.startContainer == range.endContainer)
                    && (range.startOffset == range.endOffset)
                ) {
                    // Don't do anything, they're clicking in place,
                    // not selecting a range...the click handler will get it
                }
                else {
                    this._protectRangeIfApplicable(range);
                }
            }
            return true;
        },


////////////////////////////////////////////////////////////////////////////////


        //
        // COMMIT AND PROTECTION GENERATION
        //

        generateCommitAndProtections: function() {

            var commit = {'spans': []};
            var protectionsByHash = {};

            if (this.mode === 'compose') {
                // The editor must be switched into canonical mode, and this
                // disrupts the DOM structure.  We return an answer of no
                // protections and just the raw text, for now.

                if (!this.$div.text()) {
                    return {
                        commit: null,
                        protectionsByHash: null
                    };
                }

                commit.spans.push(this.$div.text());

                return {
                    commit: commit,
                    protectionsByHash: protectionsByHash
                };
            }

            if (this.mode !== 'protect') {
                throw "generateCommitAndProtections called in bad mode";
            }

            var protectedObjs = undefined;

            var placeholders = [];
            var redactionOrder = 1;

            function pushStringSpan(stringSpan) {
                if ($.type(stringSpan) !== 'string') {
                    throw 'Pushing non-string as string span';
                }
                if (stringSpan.length === 0) {
                    throw 'Pushing zero length string span';
                }

                var numSpans = commit.spans.length;

                if (
                    (numSpans > 0)
                    && ($.type(commit.spans[numSpans-1]) === 'string')
                ) {
                    commit.spans[numSpans-1] += stringSpan;
                }
                else {
                    commit.spans.push(stringSpan);
                }
            }

            function pushPlaceholderSpan(placeholder) {
                if ($.type(placeholder.display_length) === undefined) {
                    throw 'Invalid placeholder pushed';
                }
                commit.spans.push(placeholder);
            }

            this.$div.contents().each(function(idx, subDiv) {
                var $subDiv = $(subDiv);

                if (!$subDiv.is('div')) {
                    throw 'Unknown DOM element found in canonized area';
                }

                if ($subDiv.hasClass("nbsp-spacing-hack")) {
                    pushStringSpan('\n');
                    return;
                }

                // contents() includes text nodes, children() does not

                $subDiv.contents().each(function(idx, child) {
                    var $child = $(child);
                    if (child.nodeType === Node.TEXT_NODE) {
                        // REVIEW: JSON.stringify seems not to escape \u00A0.
                        // This is a problem because it looks just like a space
                        // to the user's clipboard, and so we lose it when the
                        // user copies and pastes.  This will apply to other
                        // invisible unicode characters too... but hopefully
                        // they're taken care of inside JSON.stringify (?)

                        pushStringSpan($child.text());
                        return;
                    }

                    if (!$child.is('span')) {
                        throw 'Non span or textnode in canonized div';
                    }

                    if ($child.hasClass('protected')) {

                        // Each protected span adds a placeholder to the commit
                        // and a redaction to the reveal certificate

                        var content = $child.text();
                        if (content.length === 0) {
                            throw "Zero length redaction found, illegal";
                        }

                        var protection = {
                            value: content,
                            salt: exports.stripHyphensFromUUID(
                                exports.generateRandomUUID()
                            )
                        };
                        protection.sha256 = exports.hashOfReveal(protection);
                        protectionsByHash[protection.sha256] = protection;

                        // http://www.javascripter.net/faq/convert3.htm
                        // we track the order but do not put it into the
                        // commit or protection as it is implicit

                        var placeholder = {
                            display_length: content.length,
                            sha256: protection.sha256
                        };
                        placeholders.push({
                            obj: placeholder,
                            protection: protection,
                            order: redactionOrder
                        });

                        redactionOrder++;

                        pushPlaceholderSpan(placeholder);
                    }
                    else if ($child.hasClass('suggested')) {
                        // Treat it identially to a text node.  Used to throw
                        // these out before calling generation, but it should
                        // now be safe to call generation at any time.

                        pushStringSpan($child.text());
                    }
                    else {
                        throw "Illegal span in canonized blackhighlighter area";
                    }
                });

                // Put a line break after every div
                pushStringSpan('\n');
            });

            // Check that process did not produce two sequential string spans
            // in the commit

            var lastWasString = false;
            $.each(commit.spans, function(idx, spanToCheck) {
                if ($.type(spanToCheck) === 'string') {
                    if (lastWasString) {
                        throw "Two sequential string spans in commit";
                    }
                    lastWasString = true;
                }
                else {
                    lastWasString = false;
                }
            });

            // If commit is effectively empty, set the commit object to null

            if (commit.spans.length === 0) {
                commit = null;
            }
            else if (commit.spans.length === 1) {
                if (
                    ($.type(commit.spans[0]) === 'string')
                    && (exports.trimAllWhitespace(commit.spans[0]) === '')
                ) {
                    commit = null;
                }
            }

            return {
                commit: commit,
                protections: protectionsByHash
            }
        },


////////////////////////////////////////////////////////////////////////////////


        //
        // SHOW MODE
        //

        _toggleMask: function ($span) {
            if (!$span.is('span') || !$span.hasClass('verified')) {
                throw "Bad element received by _toggleMask";
            }

            // We have separate classes because the :not css selector is not
            // implemented everywhere.

            $span.toggleClass('masked');
            $span.toggleClass('unmasked');

            this._updateSpanTitles($span);
            this.update();
        },

        _toggleMaskListener: function(event) {
            event.preventDefault();
            this._toggleMask($(event.target));
            return false;
        },

        // For the moment, we assume the HTML with the placeholders was
        // already in the blackhighlighter region in the case of showing
        // This will need to be revisited.

        _updateSpanTitles: function ($spanArray) {
            var instance = this;

            if (instance.mode === 'compose') {
                $spanArray.each(function() {
                    var $span = $(this);
                    $span.attr('title', '');
                });
                return;
            }

            if (instance.mode === 'protect') {
                $spanArray.each(function() {
                    var $span = $(this);
                    if ($span.hasClass('suggested')) {
                        $span.attr('title',
                            'Suggested protection, click to accept'
                        );
                    }
                    else {
                        $span.attr('title',
                            'Protected content, click to unprotect'
                        );
                    }
                });
                return;
            }

            $spanArray.each(function() {
                var $span = $(this);
                var sha256 = $span.find('span.placeholder-sha256').text();

                if ($span.hasClass('revealed')) {
                    var reveal_date = new Date (
                        instance.reveals[sha256].reveal_date
                    );

                    $span.attr('title', 'Publicly revealed ' +
                        reveal_date.toUTCString()
                    );
                }
                else if (
                    $span.hasClass('verified')
                    && (instance.mode !== 'reveal')
                ) {
                    if ($span.hasClass('masked')) {
                        $span.attr('title',
                            'Verified locally, click to unmask'
                        );
                    }
                    else {
                        $span.attr('title',
                            'Verified locally, click to mask'
                        );
                    }
                }
                else if (
                    $span.hasClass('verified')
                    && (instance.mode === 'reveal')
                    && $span.hasClass('unmasked')
                ) {
                    $span.attr('title', 'WARNING: Will be revealed publicly!');
                }
                else {
                    var commit_date = new Date (instance.commit.commit_date);

                    $span.attr('title', 'Redacted by author ' +
                        commit_date.toUTCString()
                    );
                }
            });
        },

        _refreshAllPlaceholders: function() {
            // We used to convert the JSON into a public HTML fragment on the
            // client side.  But server-side generation is better for running
            // in non-javascript contexts (and makes it possible for search
            // engines to index the letter if they don't try and scrape the
            // page with JavaScript awareness.)

            // Save what the server made in the beginning so that if we mess
            // with it we can restore it back.

            this.$div.empty().append(this.initialContent.clone());

            var instance = this;
            this.$div.find('span').filter('.placeholder').each(function(i) {
                var $span = $(this);
                var sha256 = $span.find('span.placeholder-sha256').text();

                if (!$span.hasClass('revealed')) {
                    var publiclyRevealed = true;

                    var reveal = instance.reveals[sha256];
                    if (!reveal) {
                        publiclyRevealed = false;
                        reveal = instance.protections[sha256];
                    }

                    if (reveal) {
                        // Don't want to disrupt the hash!

                        var foundTextNode = false;

                        $span.contents().each(function () {
                            var $el = $(this)
                            if (this.nodeType === Node.TEXT_NODE) {
                                if (foundTextNode) {
                                    throw "More than one text node in span!";
                                }
                                $el.replaceWith(
                                    document.createTextNode(reveal.value)
                                );
                                foundTextNode = true;
                            }
                        });

                        if (!foundTextNode) {
                            throw "No text nodes found in span";
                        }

                        $span.removeClass('protected');

                        if (publiclyRevealed) {
                            $span.addClass('revealed');
                        }
                        else {
                            $span.addClass('verified');
                            $span.addClass('unmasked');
                            $span.click(
                                $.proxy(instance._toggleMaskListener, instance)
                            );
                        }
                    }
                }
            });

            this._updateSpanTitles(
                this.$div.find('span').filter('.placeholder')
            );
        },

        getProtectionsClone: function(includeMasked) {
            var protectionsClone = $.extend(true, {}, this.protections);

            if (!includeMasked) {
                var $masked = this.$div.find('span.verified.masked');
                $masked.each(function(idx, el) {
                    var $el = $(el);

                    var sha256 = $el.find('span.placeholder-sha256').text();
                    if (!protectionsClone[sha256]) {
                        throw "Masked protection span not in protections";
                    }

                    delete protectionsClone[sha256];
                });
            }

            return protectionsClone;
        },

        seeProtections: function(protectionArray, isFromServer) {
            var instance = this;

            $.each(protectionArray, function (idx, protection) {
                var actualHash =
                    exports.hashOfReveal(protection);
                if (actualHash != protection.sha256) {
                    throw 'Invalid certificate: content hash is ' + actualHash
                        + ' while claimed hash is ' + protection.sha256;
                }

                var numPlaceholdersForKey = 0;
                $.each(instance.commit.spans, function (idx, commitSpan) {
                    if (commitSpan.sha256 == protection.sha256) {
                        numPlaceholdersForKey++;
                    }
                });

                // warn user if certificate is useless, need better UI

                if (numPlaceholdersForKey === 0) {
                    throw 'Protection does not match any placeholders.';
                }

                if (numPlaceholdersForKey > 1) {
                    throw 'Protection matches more than one placeholder.';
                }

                if (isFromServer) {
                    instance.reveals[protection.sha256] = protection;
                }
                else {
                    if (protection.sha256 in instance.reveals) {
                        // local redaction already revealed on server
                        // don't throw an error, but warning of some kind?
                    }
                    else if (protection.sha256 in instance.protections) {
                        // local redaction already locally revealed
                        // don't throw an error, but warning of some kind?
                    }
                    else {
                        instance.protections[protection.sha256] = protection;
                    }
                }
            });

            this._refreshAllPlaceholders();
        },

        unseeProtection: function(protectionKey) {

            if (!(protectionKey in this.protections)) {
                throw 'Attempt to remove protection not in the local list.';
            }

            delete this.protections[protctionKey];

            this._refreshAllPlaceholders();
        }
    };

////////////////////////////////////////////////////////////////////////////////

    //
    // BATCH REVEAL AND COMMIT
    //
    // Revealing/committing is something that is not done in a "foreach" loop
    // with multiple network requests for all the widgets in the set.  So
    // this batches all those up into one network request.
    //
    // These are thus global functions that takes an instanceArray, and not
    // a method directly on the widgets.  Review if widgets should know what
    // server they are from and hold that as a piece of state information:
    //
    // https://github.com/hostilefork/blackhighlighter/issues/55

    Blackhighlighter.makeCommitments
        = function (instanceArray, base_url, callback)
    {
        var clientDate = new Date();

        var commit_array = [];
        var protections_array = [];

        var instancesByCommitId = {};

        $.each(instanceArray, function (index, instance) {
            var commitAndProtections = this.generateCommitAndProtections();

            commit_array.push(commitAndProtections.commit);
            protections_array.push(commitAndProtections.protections);
        });

        // http://docs.jquery.com/Ajax/jQuery.ajax

        $.ajax({
            type: 'POST',

            dataType: 'json',

            url: exports.makeCommitUrl(base_url),

            data: {
                'commit_array': exports.escapeNonBreakingSpacesInString(
                    JSON.stringify(commit_array, null, ' ')
                )
            },

            success: function(result) {
                if (result.error) {
                    callback(result.error.msg);
                    return;
                }

                if (
                    result.commit_id_and_date_array.length
                    != commit_array.length
                ) {
                    callback(Error(
                        'Server confirmed with an array of differing length.'
                    ));
                    return;
                }

                var error_array = [];
                var resultCommitsByCommitId = {};

                for (var index = 0; index < commit_array.length; index++) {
                    var commit = commit_array[index];
                    var commit_id_and_date
                        = result.commit_id_and_date_array[index];

                    commit.commit_date = commit_id_and_date.commit_date;
                    commit.commit_id = exports.commitIdFromCommit(commit);

                    if (commit.commit_id != commit_id_and_date.commit_id) {
                        error_array.push(Error(
                            'Server gave back hash with signature '
                            + commit_id_and_date.commit_id
                            + ' but we calculated a signature of '
                            + commit.commit_id
                            + " ... if you believe this may be acceptable "
                            + " your message is viewable at: "
                            + exports.makeShowUrl(
                                base_url,
                                commit_id_and_date.commit_id
                            )
                        ));
                    }

                    var serverDate = new Date(commit_id_and_date.commit_date);
                    if (Math.abs(serverDate - clientDate) / 1000 > 60) {
                        error_array.push(Error(
                            'Server signed data with timestamp '
                            + serverDate.toUTCString()
                            + " which is off by more than a minute from "
                            + clientDate.toUTCString()
                            + " ... if you believe this may be acceptable "
                            + " your message is viewable at: "
                            + exports.makeShowUrl(
                                base_url,
                                commit_id_and_date.commit_id
                            )
                        ));
                    }

                    var instance = instanceArray[index];

                    instance.commit = commit;
                    instance.protections = protections_array[index];

                    // Technically we shouldn't have to do this, but if
                    // we don't then since we have an artificial delay
                    // the setMode call will show junk otherwise.
                    instance.$div.html(
                        "<h3>Committing Blackhighlighter Message to Server</h3>"
                        + "<p><i>Please wait...</i></p>"
                    );
                    instance.setMode('show');
                }

                if (error_array.length > 0) {
                    // Need to think about whether the errors should be an
                    // array or a special Error type.  Stringify for now.
                    //
                    // http://stackoverflow.com/questions/8513703/

                    callback(Error(JSON.stringify(error_array)));
                }
                else {
                    callback(null);
                }
            },

            error: function (XMLHttpRequest, textStatus, errorThrown) {
                // Note that "this" contains the options for this ajax request
                switch (textStatus) {
                    case 'timeout':
                        callback('The request timed out.  Check your network connection and try again.', null);
                        break;

                    case 'error':
                        callback('There was an error on the server side during your request.', null);
                        break;

                    case 'notmodified':
                    case 'parsererror':
                        callback('commit', 'Unexpected error code during Ajax POST: ' + textStatus, null);
                        break;

                    default:
                        callback('Unexpected error code during Ajax POST: ' + textStatus, null);
                        break;
                }
            }
        });
    };

    Blackhighlighter.revealSecrets
        = function (instanceArray, base_url, callback)
    {
        var commit_id_with_reveals_array = [];

        $.each(instanceArray, function (index, instance) {
            var protectionArray = [];

            // We pass "false" to the getProtectionsClone so we only get the
            // protections that aren't on the server already, and that are in
            // a shown status

            $.each(instance.getProtectionsClone(false), function(key, element) {
                protectionArray.push(element);
            });

            commit_id_with_reveals_array.push({
                'commit_id': instance.commit.commit_id,
                'reveal_array': protectionArray
            });
        });

        var reveal_url = exports.makeRevealUrl(PARAMS.base_url);

        // http://docs.jquery.com/Ajax/jQuery.ajax

        $.ajax({
            type: 'POST',

            dataType: 'json',

            url: reveal_url,

            // sends as UTF-8
            data: {
                'commit_id_with_reveals_array': commit_id_with_reveals_array
            },

            success: function (resultJson) {
                if (resultJson.error) {
                    callback(resultJson.error.msg);
                }
                else {
                    callback(null)
                }
            },

            error: function (XMLHttpRequest, textStatus, errorThrown) {
                // "this" contains the options for this ajax request

                switch (textStatus) {
                case 'timeout':
                    callback(
                        'The POST reveal request timed out on ' +
                        reveal_url +
                        ' --- check your network connection and try again.'
                    );
                    break;

                case 'error':
                    callback('There was an error with the web server during your request.');
                    break;

                case 'notmodified':
                case 'parsererror':
                    callback('Unexpected error code during Ajax POST: ' + textStatus);
                    break;

                default:
                    callback('Unexpected error code during Ajax POST: ' + textStatus);
                    break;
                }
            }
        });
    }


////////////////////////////////////////////////////////////////////////////////


    //
    // JQUERY EXTENSION REGISTRATION
    //
    // This is the jQuery extension function which allows you to choose any
    // jQuery collection and run $(selector).blackhighlighter(...)
    //
    // Here the default options are set up.
    //

    $.blackhighlighter = $.extend({
        // Global options for the behavior of the blackhighlighter plugin
/*      autoInitialize: true,
        initialSelector: "div.blackhighlighter",*/

        // These are the per-instance options.  If there's a piece of state
        // or a hook that might be different between one div and another
        // then it needs to go in here.
        opts: {
            mode: 'compose',
            commit: null,
            protections: {},
            reveals: {},
            update: function() { }
        }
    }, $.blackhighlighter || {});


////////////////////////////////////////////////////////////////////////////////


    //
    // JQUERY BLACKHIGHLIGHTER INSTANTIATOR + METHOD DISPATCHER
    //
    // This is the method dispatcher, and if a method is not detected then it
    // can initialize a new blackhighlighter on an element.
    //

    $.fn.blackhighlighter = function(o, arg1, arg2, arg3) {

        // 1. CHECK FOR METHOD CALLS
        //
        // Method calls are indicated by having the first parameter being a
        // string, so $(selector).blackhighlighter("...", ..., ...)
        //
        // I'm cloning jQuery UI's interface (options, methods, events) but
        // not in any general way at the moment.

        if (o === "option") {
            // I'm not clear on what to do if there's an array incoming, and
            // you're trying to get properties.  Let's say I want to call an
            // option getter for a string property, and I pass in a single
            // object... I'd just want a string, right?  But if I use
            // jQuery map I'll get an array, even on a single object (and
            // a jQuery object wrapping that array, without fn.map :-/)

            // REVIEW: Ask what convention is here.

            if (this.length != 1) {
                throw new Error("Currently not handling length > 1 collections in blackhighlighter options.");
            }

            var instance = Blackhighlighter.getInstance(this.get(0));

            if (arg1 === "mode") {
                if (!instance) return undefined;

                if ($.type(arg2) === 'undefined') {
                    return instance.mode
                }
                else {
                    instance.setMode(arg2);
                    return undefined;
                }
            }

            if (arg1 === "commit") {
                if (this.length != 1) {
                    throw new Error("Currently not handling length > 1 collections for commit.");
                }

                var instance = Blackhighlighter.getInstance(this.get(0));

                if (
                    (instance.mode === 'show')
                    || (instance.mode === 'reveal')
                ) {
                    // Don't return the actual commit object!  Deep clone.

                    return $.extend(true, {}, instance.commit);
                }
                else {
                    // REVIEW: should giving back the pre-commit and pre-reveal
                    // be a special debugging function only?

                    var temp = instance.generateCommitAndProtections();
                    return temp.commit;
                }
            }

            if (arg1 === "protected") {
                if (!instance) return undefined;

                if (
                    (instance.mode === 'show')
                    || (instance.mode === 'reveal')
                ) {
                    // arg2 tells us whether you want the masked ones also.

                    return instance.getProtectionsClone(arg2);
                }
                else {
                    // REVIEW: should giving back the pre-commit and pre-reveal
                    // be a special debugging function only?

                    var temp = instance.generateCommitAndProtections();
                    return temp.protections;
                }
            }

            if (arg1 === "revealed") {
                if (!instance)
                    return undefined;

                if (
                    (instance.mode === 'show')
                    || (instance.mode === 'reveal')
                ) {
                    // Don't return the actual reveal objects!  Deep clone.

                    return $.extend(true, {}, instance.reveals);
                }
                else {
                    // Nothing is revealed to the server if we're still editing

                    return {};
                }
            }

            throw "Unknown option passed to blackhighlighter";
        }

        if (o === "certificate") {
            if (this.length != 1) {
                throw new Error("Currently not handling length > 1 collections in certificate.");
            }

            var instance = Blackhighlighter.getInstance(this.get(0));

            if (!instance)
                return undefined;

            if ((instance.mode === 'show') || (instance.mode === 'reveal')) {

                if (arg1 === 'encode') {
                    if ($.type(arg2) !== 'string') {
                        throw "Certificate encode requires commit_id as string";
                    }

                    if ($.type(arg3) !== 'array') {
                        throw "Parameter to certificate encode must be array";
                    }

                    // Validate input object?
                    var sMyInput = exports.escapeNonBreakingSpacesInString(
                        JSON.stringify({
                            commit_id: arg2,
                            reveals: arg3
                        }, null, ' ')
                    );

                    var aMyUTF8Input = strToUTF8Arr(sMyInput);
                    var sMyBase64 = base64EncArr(aMyUTF8Input);

                    // We go ahead and standardize the certificate to 60
                    // columns of text.  If you want to go it your own
                    // don't use this encoding, but it's nice to have
                    // a standard in the module.  I chose 60 because UUENCODE
                    // uses 61 for some historic reason.
                    //
                    // http://stackoverflow.com/a/1772997/211160

                    sMyBase64.replace(/(.{60})/g,"$1\n");

                    return sMyBase64;

                }
                else if (arg1 === 'decode') {
                    if ($.type(arg2) !== 'string') {
                        throw "Parameter to certificate decode must be string";
                    }

                    // We tolerate whitespace, due to the encoding throwing
                    // in newlines (and all the other things that can happen
                    // between when we gave the person a certificate and it
                    // wound up in the hands of the recipient)
                    //
                    // http://stackoverflow.com/a/6623252/211160

                    var sEncoded = arg2.replace(/\s/g, "");
                    var aMyUTF8Output = base64DecToArr(sEncoded);
                    var sMyOutput = UTF8ArrToStr(aMyUTF8Output);

                    return JSON.parse(sMyOutput);

                }
                else {
                    throw "Option to certificate other than encode/decode";
                }

                // Don't return the actual reveal objects!
                return instance.reveals.clone();
            }
            else {
                throw "Can't encode or decode certificates while editing/protecting";
            }

        }

        if (o === "commit") {
           if (this.length < 0) {
                throw new Error("At least one widget must be in reveal set.");
            }

            var instanceArray = [];
            this.each(function() {
                instanceArray.push(Blackhighlighter.getInstance(this));
            });

            Blackhighlighter.makeCommitments(instanceArray, arg1, arg2);
        }

        if (o === "verify") {
            // Verify is all on the client, so there's not really a benefit
            // to grouping them specially.  Multi API also makes less sense;
            // because extra information is being passed in vs. the "I'm ready
            // now, use your internal state" of commit/reveal.  Think about it.

            if (this.length != 1) {
                throw new Error("Currently not handling length > 1 collections in verify.");
            }

            var instance = Blackhighlighter.getInstance(this.get(0));
            return instance.seeProtections(arg1, false);
        }

        if (o === "reveal") {
            if (this.length < 0) {
                throw new Error("At least one widget must be in reveal set.");
            }

            var instanceArray = [];
            this.each(function() {
                instanceArray.push(Blackhighlighter.getInstance(this));
            });

            Blackhighlighter.revealSecrets(instanceArray, arg1, arg2);
        }

        if (o === "destroy") {
            this.each(function() {
                var instance = Blackhighlighter.getInstance(this);
                if (instance) instance.destroy();
            });
            return this;
        }

        // Checks to see if any of the given DOM nodes have the
        // blackhighlighter behaviour.

        if (o === "active") {
            return !!this.filter(function() {
                return !!Blackhighlighter.getInstance(this);
            }).length;
        }

        // 2. MAKE A NEW BLACKHIGHLIGHTER
        //
        // If the method name is not recognized, we treat whatever we get as
        // being options.  (Note: is this safe?  It's what expandarea did, but
        // seems it would be better to make sure what we're looking at is an
        // object, or perhaps testing for no arguments :-/)

        var opts = $.extend({ }, $.blackhighlighter.opts, o);

        this.filter("div").each(function() {
            var initialized = Blackhighlighter.getInstance(this);

            if (!initialized) {
                new Blackhighlighter($(this), opts);
            }
            else {
                if(initialized) _warn("Blackhighlighter: attempt to initialize a div that has already been initialized. Subsequent calls are ignored.");
            }
        });
        return this;
    };

    function _warn(text) {
        if (window.console && console.warn)
            console.warn(text);
    }


////////////////////////////////////////////////////////////////////////////////


    //
    // GLOBAL PLUGIN INITIALIZATION CODE
    //
    // This is the code that runs only once at plugin initialization.
    //

    $(function () {
        // I've disabled this because the auto initialization runs out of
        // order with manual initialization; basically the $() functions seem
        // to run in an arbitrary order, and if one uses this (even in
        // requirejs) the ordering may run in the wrong order; such that the
        // client's document ready handler happens before the auto initialize.
        // I'm not sure auto initialize is such a great idea in the first
        // place, but leaving it here for review.
        //
        /* if ($.blackhighlighter.autoInitialize) {
            $($.blackhighlighter.initialSelector).blackhighlighter();
        }*/

        // We want to stop pastes of arbitrary content into the contenteditable
        // div.  There were some suggestions like making invisible textareas
        // and pasting into them, and saving and restoring selections like:
        //
        // http://stackoverflow.com/questions/12027137/
        // http://stackoverflow.com/a/3323835/211160
        //
        // But I found this simpler solution seems to work well enough.

        $(document).on('paste', function(event) {
            // Don't use *:focus selector, it's slow.
            // http://stackoverflow.com/a/11278006

            var $oldActive = $(document.activeElement);
            if (!$oldActive.hasClass('blackhighlighter')) {
                return true;
            }

            var instance = Blackhighlighter.getInstance($oldActive.get(0));

            // http://stackoverflow.com/questions/12027137/

            var pastedText = undefined;
            if (window.clipboardData && window.clipboardData.getData) {
                // Internet Explorer

                pastedText = window.clipboardData.getData('Text');
            }
            else if (
                event.originalEvent.clipboardData
                && event.originalEvent.clipboardData.getData
            ) {
                // Everyone else but Internet Explorer

                pastedText = event.originalEvent
                    .clipboardData.getData('text/plain');
            }

            // Escape any HTML characters as we're moving from a text context
            // to raw contents of a div.  If the source was text, convert any
            // newlines into line break nodes so they show up.  Need to also
            // find any groups of more than one space character and turn them
            // into &nbsp; :-/  Doing that with this trick:
            //
            // http://stackoverflow.com/a/2373823/211160

            var newText = escapeHtml(pastedText);
            var regex = new RegExp("\n", 'g');
            newText = newText.replace(regex, "<br>");
            regex = new RegExp("  ", 'g');
            newText = newText.replace(regex, "&nbsp;&nbsp;");
            regex = new RegExp("&nbsp; ", 'g');
            newText = newText.replace(regex, "&nbsp;&nbsp;");

            document.execCommand('insertHtml', false, newText);

            // cancel the original paste

            event.preventDefault();

            // Is this the best place to put this update call?

            instance.update();

            return false;
        });
    });


////////////////////////////////////////////////////////////////////////////////


    //
    // RETURN EXPORTS
    //
    // What we export is what we return.  If you write something like
    // var bh = require("blackhighlighter"); in Node.JS using the requirejs
    // plugin, the bh object you get back from that require statement is going
    // to be what we return here.
    //
    // Note that if jQuery is unavailable, we returned the exports much earlier
    // in the file and did not define Blackhighlighter.
    //

    return exports;

}));
