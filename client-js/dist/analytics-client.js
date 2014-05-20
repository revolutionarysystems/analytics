(function() {
  var WebSocket = window.WebSocket || window.MozWebSocket;
  var br = window.brunch = (window.brunch || {});
  var ar = br['auto-reload'] = (br['auto-reload'] || {});
  if (!WebSocket || ar.disabled) return;

  var cacheBuster = function(url){
    var date = Math.round(Date.now() / 1000).toString();
    url = url.replace(/(\&|\\?)cacheBuster=\d*/, '');
    return url + (url.indexOf('?') >= 0 ? '&' : '?') +'cacheBuster=' + date;
  };

  var reloaders = {
    page: function(){
      window.location.reload(true);
    },

    stylesheet: function(){
      [].slice
        .call(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(function(link){
          return (link != null && link.href != null);
        })
        .forEach(function(link) {
          link.href = cacheBuster(link.href);
        });
    }
  };
  var port = ar.port || 9485;
  var host = (!br['server']) ? window.location.hostname : br['server'];
  var connect = function(){
    var connection = new WebSocket('ws://' + host + ':' + port);
    connection.onmessage = function(event){
      var message = event.data;
      if (ar.disabled) return;
      if (reloaders[message] != null) {
        reloaders[message]();
      } else {
        reloaders.page();
      }
    };
    connection.onerror = function(){
      if (connection.readyState) connection.close();
    };
    connection.onclose = function(){
      window.setTimeout(connect, 1000);
    };
  };
  connect();
})();

;/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(h,r){var k={},l=k.lib={},n=function(){},f=l.Base={extend:function(a){n.prototype=this;var b=new n;a&&b.mixIn(a);b.hasOwnProperty("init")||(b.init=function(){b.$super.init.apply(this,arguments)});b.init.prototype=b;b.$super=this;return b},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var b in a)a.hasOwnProperty(b)&&(this[b]=a[b]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
j=l.WordArray=f.extend({init:function(a,b){a=this.words=a||[];this.sigBytes=b!=r?b:4*a.length},toString:function(a){return(a||s).stringify(this)},concat:function(a){var b=this.words,d=a.words,c=this.sigBytes;a=a.sigBytes;this.clamp();if(c%4)for(var e=0;e<a;e++)b[c+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((c+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)b[c+e>>>2]=d[e>>>2];else b.push.apply(b,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,b=this.sigBytes;a[b>>>2]&=4294967295<<
32-8*(b%4);a.length=h.ceil(b/4)},clone:function(){var a=f.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var b=[],d=0;d<a;d+=4)b.push(4294967296*h.random()|0);return new j.init(b,a)}}),m=k.enc={},s=m.Hex={stringify:function(a){var b=a.words;a=a.sigBytes;for(var d=[],c=0;c<a;c++){var e=b[c>>>2]>>>24-8*(c%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var b=a.length,d=[],c=0;c<b;c+=2)d[c>>>3]|=parseInt(a.substr(c,
2),16)<<24-4*(c%8);return new j.init(d,b/2)}},p=m.Latin1={stringify:function(a){var b=a.words;a=a.sigBytes;for(var d=[],c=0;c<a;c++)d.push(String.fromCharCode(b[c>>>2]>>>24-8*(c%4)&255));return d.join("")},parse:function(a){for(var b=a.length,d=[],c=0;c<b;c++)d[c>>>2]|=(a.charCodeAt(c)&255)<<24-8*(c%4);return new j.init(d,b)}},t=m.Utf8={stringify:function(a){try{return decodeURIComponent(escape(p.stringify(a)))}catch(b){throw Error("Malformed UTF-8 data");}},parse:function(a){return p.parse(unescape(encodeURIComponent(a)))}},
q=l.BufferedBlockAlgorithm=f.extend({reset:function(){this._data=new j.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=t.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var b=this._data,d=b.words,c=b.sigBytes,e=this.blockSize,f=c/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;c=h.min(4*a,c);if(a){for(var g=0;g<a;g+=e)this._doProcessBlock(d,g);g=d.splice(0,a);b.sigBytes-=c}return new j.init(g,c)},clone:function(){var a=f.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});l.Hasher=q.extend({cfg:f.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){q.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(b,d){return(new a.init(d)).finalize(b)}},_createHmacHelper:function(a){return function(b,d){return(new u.HMAC.init(a,
d)).finalize(b)}}});var u=k.algo={};return k}(Math);

;/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(h,s){var f={},g=f.lib={},q=function(){},m=g.Base={extend:function(a){q.prototype=this;var c=new q;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
r=g.WordArray=m.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=s?c:4*a.length},toString:function(a){return(a||k).stringify(this)},concat:function(a){var c=this.words,d=a.words,b=this.sigBytes;a=a.sigBytes;this.clamp();if(b%4)for(var e=0;e<a;e++)c[b+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((b+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)c[b+e>>>2]=d[e>>>2];else c.push.apply(c,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=h.ceil(c/4)},clone:function(){var a=m.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],d=0;d<a;d+=4)c.push(4294967296*h.random()|0);return new r.init(c,a)}}),l=f.enc={},k=l.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++){var e=c[b>>>2]>>>24-8*(b%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b+=2)d[b>>>3]|=parseInt(a.substr(b,
2),16)<<24-4*(b%8);return new r.init(d,c/2)}},n=l.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++)d.push(String.fromCharCode(c[b>>>2]>>>24-8*(b%4)&255));return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b++)d[b>>>2]|=(a.charCodeAt(b)&255)<<24-8*(b%4);return new r.init(d,c)}},j=l.Utf8={stringify:function(a){try{return decodeURIComponent(escape(n.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return n.parse(unescape(encodeURIComponent(a)))}},
u=g.BufferedBlockAlgorithm=m.extend({reset:function(){this._data=new r.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=j.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,d=c.words,b=c.sigBytes,e=this.blockSize,f=b/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;b=h.min(4*a,b);if(a){for(var g=0;g<a;g+=e)this._doProcessBlock(d,g);g=d.splice(0,a);c.sigBytes-=b}return new r.init(g,b)},clone:function(){var a=m.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});g.Hasher=u.extend({cfg:m.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){u.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(c,d){return(new a.init(d)).finalize(c)}},_createHmacHelper:function(a){return function(c,d){return(new t.HMAC.init(a,
d)).finalize(c)}}});var t=f.algo={};return f}(Math);
(function(h){for(var s=CryptoJS,f=s.lib,g=f.WordArray,q=f.Hasher,f=s.algo,m=[],r=[],l=function(a){return 4294967296*(a-(a|0))|0},k=2,n=0;64>n;){var j;a:{j=k;for(var u=h.sqrt(j),t=2;t<=u;t++)if(!(j%t)){j=!1;break a}j=!0}j&&(8>n&&(m[n]=l(h.pow(k,0.5))),r[n]=l(h.pow(k,1/3)),n++);k++}var a=[],f=f.SHA256=q.extend({_doReset:function(){this._hash=new g.init(m.slice(0))},_doProcessBlock:function(c,d){for(var b=this._hash.words,e=b[0],f=b[1],g=b[2],j=b[3],h=b[4],m=b[5],n=b[6],q=b[7],p=0;64>p;p++){if(16>p)a[p]=
c[d+p]|0;else{var k=a[p-15],l=a[p-2];a[p]=((k<<25|k>>>7)^(k<<14|k>>>18)^k>>>3)+a[p-7]+((l<<15|l>>>17)^(l<<13|l>>>19)^l>>>10)+a[p-16]}k=q+((h<<26|h>>>6)^(h<<21|h>>>11)^(h<<7|h>>>25))+(h&m^~h&n)+r[p]+a[p];l=((e<<30|e>>>2)^(e<<19|e>>>13)^(e<<10|e>>>22))+(e&f^e&g^f&g);q=n;n=m;m=h;h=j+k|0;j=g;g=f;f=e;e=k+l|0}b[0]=b[0]+e|0;b[1]=b[1]+f|0;b[2]=b[2]+g|0;b[3]=b[3]+j|0;b[4]=b[4]+h|0;b[5]=b[5]+m|0;b[6]=b[6]+n|0;b[7]=b[7]+q|0},_doFinalize:function(){var a=this._data,d=a.words,b=8*this._nDataBytes,e=8*a.sigBytes;
d[e>>>5]|=128<<24-e%32;d[(e+64>>>9<<4)+14]=h.floor(b/4294967296);d[(e+64>>>9<<4)+15]=b;a.sigBytes=4*d.length;this._process();return this._hash},clone:function(){var a=q.clone.call(this);a._hash=this._hash.clone();return a}});s.SHA256=q._createHelper(f);s.HmacSHA256=q._createHmacHelper(f)})(Math);
(function(){var h=CryptoJS,s=h.enc.Utf8;h.algo.HMAC=h.lib.Base.extend({init:function(f,g){f=this._hasher=new f.init;"string"==typeof g&&(g=s.parse(g));var h=f.blockSize,m=4*h;g.sigBytes>m&&(g=f.finalize(g));g.clamp();for(var r=this._oKey=g.clone(),l=this._iKey=g.clone(),k=r.words,n=l.words,j=0;j<h;j++)k[j]^=1549556828,n[j]^=909522486;r.sigBytes=l.sigBytes=m;this.reset()},reset:function(){var f=this._hasher;f.reset();f.update(this._iKey)},update:function(f){this._hasher.update(f);return this},finalize:function(f){var g=
this._hasher;f=g.finalize(f);g.reset();return g.finalize(this._oKey.clone().concat(f))}})})();

;/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function(k){for(var g=CryptoJS,h=g.lib,v=h.WordArray,j=h.Hasher,h=g.algo,s=[],t=[],u=function(q){return 4294967296*(q-(q|0))|0},l=2,b=0;64>b;){var d;a:{d=l;for(var w=k.sqrt(d),r=2;r<=w;r++)if(!(d%r)){d=!1;break a}d=!0}d&&(8>b&&(s[b]=u(k.pow(l,0.5))),t[b]=u(k.pow(l,1/3)),b++);l++}var n=[],h=h.SHA256=j.extend({_doReset:function(){this._hash=new v.init(s.slice(0))},_doProcessBlock:function(q,h){for(var a=this._hash.words,c=a[0],d=a[1],b=a[2],k=a[3],f=a[4],g=a[5],j=a[6],l=a[7],e=0;64>e;e++){if(16>e)n[e]=
q[h+e]|0;else{var m=n[e-15],p=n[e-2];n[e]=((m<<25|m>>>7)^(m<<14|m>>>18)^m>>>3)+n[e-7]+((p<<15|p>>>17)^(p<<13|p>>>19)^p>>>10)+n[e-16]}m=l+((f<<26|f>>>6)^(f<<21|f>>>11)^(f<<7|f>>>25))+(f&g^~f&j)+t[e]+n[e];p=((c<<30|c>>>2)^(c<<19|c>>>13)^(c<<10|c>>>22))+(c&d^c&b^d&b);l=j;j=g;g=f;f=k+m|0;k=b;b=d;d=c;c=m+p|0}a[0]=a[0]+c|0;a[1]=a[1]+d|0;a[2]=a[2]+b|0;a[3]=a[3]+k|0;a[4]=a[4]+f|0;a[5]=a[5]+g|0;a[6]=a[6]+j|0;a[7]=a[7]+l|0},_doFinalize:function(){var d=this._data,b=d.words,a=8*this._nDataBytes,c=8*d.sigBytes;
b[c>>>5]|=128<<24-c%32;b[(c+64>>>9<<4)+14]=k.floor(a/4294967296);b[(c+64>>>9<<4)+15]=a;d.sigBytes=4*b.length;this._process();return this._hash},clone:function(){var b=j.clone.call(this);b._hash=this._hash.clone();return b}});g.SHA256=j._createHelper(h);g.HmacSHA256=j._createHmacHelper(h)})(Math);

;var Kinesis = function(config) {

	this.config = config;

	this.put = function(data, options) {
		var encodedData = btoa(data)
		var payload = '{"PartitionKey": "' + this.config.partitionKey + '", "StreamName": "' + this.config.streamName + '", "Data": "' + encodedData + '"}';
		var now = new Date();
		var datestamp = getDatestamp(now);
		var timestamp = getTimestamp(now);
		var signature = getSignature(this.config.credentials.secretKey, datestamp, timestamp, payload);
		Ajax.post("https://kinesis.us-east-1.amazonaws.com", payload, {
			headers: {
				"Authorization": "AWS4-HMAC-SHA256 Credential=" + this.config.credentials.accessKey + "/" + datestamp + "/us-east-1/kinesis/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=" + signature,
				"X-Amz-Date": timestamp,
				"X-Amz-Target": "Kinesis_20131202.PutRecord",
				"Content-Type": "application/x-amz-json-1.1",
				"Host": "kinesis.us-east-1.amazonaws.com"
			},
			onSuccess: options.onSuccess,
			onError: options.onError
		});
	}

	function getCanonicalString(timestamp, payload) {
		var hashedPayload = CryptoJS.SHA256(payload);
		var canonicalString = "POST\n\/\n\ncontent-type:application/x-amz-json-1.1\nhost:kinesis.us-east-1.amazonaws.com\nx-amz-date:" + timestamp + "\nx-amz-target:Kinesis_20131202.PutRecord\n\ncontent-type;host;x-amz-date;x-amz-target\n" + hashedPayload;
		return canonicalString;
	}

	function getStringToSign(timestamp, datestamp, payload) {
		var canonicalString = getCanonicalString(timestamp, payload);
		var hashedCanonicalString = CryptoJS.SHA256(canonicalString);
		var stringToSign = "AWS4-HMAC-SHA256\n" + timestamp + "\n" + datestamp + "/us-east-1/kinesis/aws4_request\n" + hashedCanonicalString;
		return stringToSign;
	}

	function getSignatureKey(key, dateStamp, regionName, serviceName) {
		var kDate = CryptoJS.HmacSHA256(dateStamp, "AWS4" + key, {
			asBytes: true
		});
		var kRegion = CryptoJS.HmacSHA256(regionName, kDate, {
			asBytes: true
		});
		var kService = CryptoJS.HmacSHA256(serviceName, kRegion, {
			asBytes: true
		});
		var kSigning = CryptoJS.HmacSHA256("aws4_request", kService, {
			asBytes: true
		});
		return kSigning;
	}

	function getSignature(key, datestamp, timestamp, payload){
		
		var signatureKey = getSignatureKey(key, datestamp, "us-east-1", "kinesis");
		var stringToSign = getStringToSign(timestamp, datestamp, payload);
		return CryptoJS.HmacSHA256(stringToSign, signatureKey, {
			asBytes: true
		}).toString();
	}

	function getDatestamp(date) {
		var dateStamp = "" + date.getUTCFullYear() + padNumber(date.getUTCMonth() + 1) + padNumber(date.getUTCDate());
		return dateStamp;
	}

	function getTimestamp(time) {
		var timestamp = getDatestamp(time) + "T" + padNumber(time.getUTCHours()) + padNumber(time.getUTCMinutes()) + padNumber(time.getUTCSeconds()) + "Z";
		return timestamp;
	}

	function padNumber(n) {
		if (n < 10) {
			n = "0" + n;
		}
		return n;
	}

}
;var SessionProvider = function(options) {
	window.session = {options: options};
	
	this.getSession = function(){
		return window.session;
	};
	/**
	 * session.js 0.4.1
	 * (c) 2012 Iain, CodeJoust
	 * session.js is freely distributable under the MIT license.
	 * Portions of session.js are inspired or borrowed from Underscore.js, and quirksmode.org demo javascript.
	 * This version uses google's jsapi library for location services.
	 * For details, see: https://github.com/codejoust/session.js
	 */
	var session_fetch = (function(win, doc, nav) {
		'use strict';
		// Changing the API Version invalidates olde cookies with previous api version tags.
		var API_VERSION = 0.4;
		// Settings: defaults
		var options = {
			// Use the HTML5 Geolocation API
			// this ONLY returns lat & long, no city/address
			use_html5_location: false,
			// Attempts to use IPInfoDB if provided a valid key
			// Get a key at http://ipinfodb.com/register.php
			ipinfodb_key: false,
			// Leaving true allows for fallback for both
			// the HTML5 location and the IPInfoDB
			gapi_location: true,
			// Name of the location cookie (set blank to disable cookie)
			//   - WARNING: different providers use the same cookie
			//   - if switching providers, remember to use another cookie or provide checks for old cookies
			location_cookie: "location",
			// Location cookie expiration in hours
			location_cookie_timeout: 5,
			// Session expiration in days
			session_timeout: 32,
			// Session cookie name (set blank to disable cookie)
			session_cookie: "first_session",
			get_object: null, set_object: null // used for cookie session adaptors
					// if null, will be reset to use cookies by default.
		};

		// Session object
		var SessionRunner = function() {
			win.session = win.session || {};
			// Helper for querying.
			// Usage: session.current_session.referrer_info.hostname.contains(['github.com','news.ycombinator.com'])
			win.session.contains = function(other_str) {
				if (typeof (other_str) === 'string') {
					return (this.indexOf(other_str) !== -1);
				}
				for (var i = 0; i < other_str.length; i++) {
					if (this.indexOf(other_str[i]) !== -1) {
						return true;
					}
				}
				return false;
			};
			// Merge options
			if (win.session && win.session.options) {
				for (var option in win.session.options) {
					options[option] = win.session.options[option];
				}
			}
			// Modules to run
			// If the module has arguments,
			//   it _needs_ to return a callback function.
			var unloaded_modules = {
				api_version: API_VERSION,
				locale: modules.locale(),
				current_session: modules.session(),
				original_session: modules.session(
						options.session_cookie,
						options.session_timeout * 24 * 60 * 60 * 1000),
				browser: modules.browser(),
				plugins: modules.plugins(),
				time: modules.time(),
				device: modules.device()
			};
			// Location switch
			if (options.use_html5_location) {
				unloaded_modules.location = modules.html5_location();
			} else if (options.ipinfodb_key) {
				unloaded_modules.location = modules.ipinfodb_location(options.ipinfodb_key);
			} else if (options.gapi_location) {
				unloaded_modules.location = modules.gapi_location();
			}
			// Cache win.session.start
			if (win.session && win.session.start) {
				var start = win.session.start;
			}
			// Set up checking, if all modules are ready
			var asynchs = 0, module, result,
					check_asynch = function(deinc) {
						if (deinc) {
							asynchs--;
						}
						if (asynchs === 0) {
							// Run start calback
							if (start) {
								start(win.session);
							}
						}
					};
			win.session = {};
			// Run asynchronous methods
			for (var name in unloaded_modules) {
				module = unloaded_modules[name];
				if (typeof module === "function") {
					try {
						module(function(data) {
							win.session[name] = data;
							check_asynch(true);
						});
						asynchs++;
					} catch (err) {
						if (win.console && typeof (console.log) === "function") {
							console.log(err);
							check_asynch(true);
						}
					}
				} else {
					win.session[name] = module;
				}
			}
			check_asynch();
		};


		// Browser (and OS) detection
		var browser = {
			detect: function() {
				var ret = {
					browser: this.search(this.data.browser),
					version: this.search(nav.userAgent) || this.search(nav.appVersion),
					os: this.search(this.data.os)
				};
				if (ret.os == 'Linux') {
					var distros = ['CentOS', 'Debian', 'Fedora', 'Gentoo', 'Mandriva', 'Mageia', 'Red Hat', 'Slackware', 'SUSE', 'Turbolinux', 'Ubuntu'];
					for (var i = 0; i < distros.length; i++) {
						if (nav.useragent.toLowerCase().match(distros[i].toLowerCase())) {
							ret.distro = distros[i];
							break;
						}
					}
				}
				return ret;
			},
			search: function(data) {
				if (typeof data === "object") {
					// search for string match
					for (var i = 0; i < data.length; i++) {
						var dataString = data[i].string,
								dataProp = data[i].prop;
						this.version_string = data[i].versionSearch || data[i].identity;
						if (dataString) {
							if (dataString.indexOf(data[i].subString) != -1) {
								return data[i].identity;
							}
						} else if (dataProp) {
							return data[i].identity;
						}
					}
				} else {
					// search for version number
					var index = data.indexOf(this.version_string);
					if (index == -1)
						return;
					return parseFloat(data.substr(index + this.version_string.length + 1));
				}
			},
			data: {
				browser: [
					{string: nav.userAgent, subString: "Chrome", identity: "Chrome"},
					{string: nav.userAgent, subString: "OmniWeb", versionSearch: "OmniWeb/", identity: "OmniWeb"},
					{string: nav.vendor, subString: "Apple", identity: "Safari", versionSearch: "Version"},
					{prop: win.opera, identity: "Opera", versionSearch: "Version"},
					{string: nav.vendor, subString: "iCab", identity: "iCab"},
					{string: nav.vendor, subString: "KDE", identity: "Konqueror"},
					{string: nav.userAgent, subString: "Firefox", identity: "Firefox"},
					{string: nav.vendor, subString: "Camino", identity: "Camino"},
					{string: nav.userAgent, subString: "Netscape", identity: "Netscape"},
					{string: nav.userAgent, subString: "MSIE", identity: "Explorer", versionSearch: "MSIE"},
					{string: nav.userAgent, subString: "Gecko", identity: "Mozilla", versionSearch: "rv"},
					{string: nav.userAgent, subString: "Mozilla", identity: "Netscape", versionSearch: "Mozilla"}
				],
				os: [
					{string: nav.platform, subString: "Win", identity: "Windows"},
					{string: nav.platform, subString: "Mac", identity: "Mac"},
					{string: nav.userAgent, subString: "iPhone", identity: "iPhone/iPod"},
					{string: nav.userAgent, subString: "iPad", identity: "iPad"},
					{string: nav.userAgent, subString: "Android", identity: "Android"},
					{string: nav.platform, subString: "Linux", identity: "Linux"}
				]}
		};

		var modules = {
			browser: function() {
				return browser.detect();
			},
			time: function() {
				// split date and grab timezone estimation.
				// timezone estimation: http://www.onlineaspect.com/2007/06/08/auto-detect-a-time-zone-with-javascript/
				var d1 = new Date(), d2 = new Date();
				d1.setMonth(0);
				d1.setDate(1);
				d2.setMonth(6);
				d2.setDate(1);
				return({tz_offset: -(new Date().getTimezoneOffset()) / 60, observes_dst: (d1.getTimezoneOffset() !== d2.getTimezoneOffset())});
				// Gives a browser estimation, not guaranteed to be correct.
			},
			locale: function() {
				var lang = ((
						nav.language ||
						nav.browserLanguage ||
						nav.systemLanguage ||
						nav.userLanguage
						) || '').split("-");
				if (lang.length == 2) {
					return {country: lang[1].toLowerCase(), lang: lang[0].toLowerCase()};
				} else if (lang) {
					return {lang: lang[0].toLowerCase(), country: null};
				} else {
					return{lang: null, country: null};
				}
			},
			device: function() {
				var device = {
					screen: {
						width: win.screen.width,
						height: win.screen.height
					}
				};
				device.viewport = {
					width: win.innerWidth || doc.documentElement.clientWidth || doc.body.clientWidth,
					height: win.innerHeight || doc.documentElement.clientHeight || doc.body.clientHeight
				};
				device.is_tablet = !!nav.userAgent.match(/(iPad|SCH-I800|xoom|kindle)/i);
				device.is_phone = !device.is_tablet && !!nav.userAgent.match(/(iPhone|iPod|blackberry|android 0.5|htc|lg|midp|mmp|mobile|nokia|opera mini|palm|pocket|psp|sgh|smartphone|symbian|treo mini|Playstation Portable|SonyEricsson|Samsung|MobileExplorer|PalmSource|Benq|Windows Phone|Windows Mobile|IEMobile|Windows CE|Nintendo Wii)/i);
				device.is_mobile = device.is_tablet || device.is_phone;
				return device;
			},
			plugins: function() {
				var check_plugin = function(name) {
					if (nav.plugins) {
						var plugin, i = 0, length = nav.plugins.length;
						for (; i < length; i++) {
							plugin = nav.plugins[i];
							if (plugin && plugin.name && plugin.name.toLowerCase().indexOf(name) !== -1) {
								return true;
							}
						}
						return false;
					}
					return false;
				};
				var check_activex_flash = function(versions) {
					var found = true;
					for (var i = 0; i < versions.length; i++) {
						try {
							var obj = new ActiveXObject("ShockwaveFlash.ShockwaveFlash" + versions[i])
									, found = !0;
						} catch (e) { /* nil */
						}
						if (found)
							return true;
					}
					return false;
				}
				return {
					flash: check_plugin("flash") || check_activex_flash(['.7', '.6', '']),
					silverlight: check_plugin("silverlight"),
					java: check_plugin("java"),
					quicktime: check_plugin("quicktime")
				};
			},
			session: function(cookie, expires) {
				var session = util.get_obj(cookie);
				if (session == null) {
					session = {
						visits: 1,
						start: new Date().getTime(), last_visit: new Date().getTime(),
						url: win.location.href, path: win.location.pathname,
						referrer: doc.referrer, referrer_info: util.parse_url(doc.referrer),
						search: {engine: null, query: null}
					};
					var search_engines = [
						{name: "Google", host: "google", query: "q"},
						{name: "Bing", host: "bing.com", query: "q"},
						{name: "Yahoo", host: "search.yahoo", query: "p"},
						{name: "AOL", host: "search.aol", query: "q"},
						{name: "Ask", host: "ask.com", query: "q"},
						{name: "Baidu", host: "baidu.com", query: "wd"}
					], length = search_engines.length,
							engine, match, i = 0,
							fallbacks = 'q query term p wd query text'.split(' ');
					for (i = 0; i < length; i++) {
						engine = search_engines[i];
						if (session.referrer_info.host.indexOf(engine.host) !== -1) {
							session.search.engine = engine.name;
							session.search.query = session.referrer_info.query[engine.query];
							session.search.terms = session.search.query ? session.search.query.split(" ") : null;
							break;
						}
					}
					if (session.search.engine === null && session.referrer_info.search.length > 1) {
						for (i = 0; i < fallbacks.length; i++) {
							var terms = session.referrer_info.query[fallbacks[i]];
							if (terms) {
								session.search.engine = "Unknown";
								session.search.query = terms;
								session.search.terms = terms.split(" ");
								break;
							}
						}
					}
				} else {
					session.prev_visit = session.last_visit;
					session.last_visit = new Date().getTime();
					session.visits++;
					session.time_since_last_visit = session.last_visit - session.prev_visit;
				}
				util.set_obj(cookie, session, expires);
				return session;
			},
			html5_location: function() {
				return function(callback) {
					nav.geolocation.getCurrentPosition(function(pos) {
						pos.source = 'html5';
						callback(pos);
					}, function(err) {
						if (options.gapi_location) {
							modules.gapi_location()(callback);
						} else {
							callback({error: true, source: 'html5'});
						}
					});
				};
			},
			gapi_location: function() {
				return function(callback) {
					var location = util.get_obj(options.location_cookie);
					if (!location || location.source !== 'google') {
						win.gloader_ready = function() {
							if ("google" in win) {
								if (win.google.loader.ClientLocation) {
									win.google.loader.ClientLocation.source = "google";
									callback(win.google.loader.ClientLocation);
								} else {
									callback({error: true, source: "google"});
								}
								util.set_obj(
										options.location_cookie,
										win.google.loader.ClientLocation,
										options.location_cookie_timeout * 60 * 60 * 1000);
							}
						};
						util.embed_script("https://www.google.com/jsapi?callback=gloader_ready");
					} else {
						callback(location);
					}
				};
			},
			architecture: function() {
				var arch = n.userAgent.match(/x86_64|Win64|WOW64|x86-64|x64\;|AMD64|amd64/) ||
						(n.cpuClass === 'x64') ? 'x64' : 'x86';
				return {
					arch: arch,
					is_x64: arch == 'x64',
					is_x86: arch == 'x68'
				}
			},
			ipinfodb_location: function(api_key) {
				return function(callback) {
					var location_cookie = util.get_obj(options.location_cookie);
					if (!location_cookie && location_cookie.source === 'ipinfodb') {
						win.ipinfocb = function(data) {
							if (data.statusCode === "OK") {
								data.source = "ipinfodb";
								util.set_obj(
										options.location_cookie,
										data,
										options.location_cookie * 60 * 60 * 1000);
								callback(data);
							} else {
								if (options.gapi_location) {
									return modules.gapi_location()(callback);
								}
								else {
									callback({error: true, source: "ipinfodb", message: data.statusMessage});
								}
							}
						};
						util.embed_script("http://api.ipinfodb.com/v3/ip-city/?key=" + api_key + "&format=json&callback=ipinfocb");
					} else {
						callback(location_cookie);
					}
				}
			}
		};

		// Utilities
		var util = {
			parse_url: function(url_str) {
				var a = doc.createElement("a"), query = {};
				a.href = url_str;
				var query_str = a.search.substr(1);
				// Disassemble query string
				if (query_str != '') {
					var pairs = query_str.split("&"), i = 0,
							length = pairs.length, parts;
					for (; i < length; i++) {
						parts = pairs[i].split("=");
						if (parts.length === 2) {
							query[parts[0]] = decodeURI(parts[1]);
						}
					}
				}
				return {
					host: a.host,
					path: a.pathname,
					protocol: a.protocol,
					port: a.port === '' ? 80 : a.port,
					search: a.search,
					query: query}
			},
			set_cookie: function(cname, value, expires, options) { // from jquery.cookie.js
				if (!cname) {
					return null;
				}
				if (!options) {
					options = {};
				}
				if (value === null || value === undefined) {
					expires = -1;
				}
				if (expires) {
					options.expires = (new Date().getTime()) + expires;
				}
				return (doc.cookie = [
					encodeURIComponent(cname), '=',
					encodeURIComponent(String(value)),
					options.expires ? '; expires=' + new Date(options.expires).toUTCString() : '', // use expires attribute, max-age is not supported by IE
					'; path=' + (options.path ? options.path : '/'),
					options.domain ? '; domain=' + options.domain : '',
					(win.location && win.location.protocol === 'https:') ? '; secure' : ''
				].join(''));
			},
			get_cookie: function(cookie_name, result) { // from jquery.cookie.js
				return (result = new RegExp('(?:^|; )' + encodeURIComponent(cookie_name) + '=([^;]*)').exec(doc.cookie)) ? decodeURIComponent(result[1]) : null;
			},
			embed_script: function(url) {
				var element = doc.createElement("script");
				element.type = "text/javascript";
				element.src = url;
				doc.getElementsByTagName("body")[0].appendChild(element);
			},
			package_obj: function(obj) {
				if (obj) {
					obj.version = API_VERSION;
					var ret = JSON.stringify(obj);
					delete obj.version;
					return ret;
				}
			},
			set_obj: function(cname, value, expires, options) {
				util.set_cookie(cname, util.package_obj(value), expires, options);
			},
			get_obj: function(cookie_name) {
				var obj;
				try {
					obj = JSON.parse(util.get_cookie(cookie_name));
				} catch (e) {
				}
				if (obj && obj.version == API_VERSION) {
					delete obj.version;
					return obj;
				}
			}
		};

		// cookie options override
		if (options.get_object != null) {
			util.get_obj = options['get_object'];
		}
		if (options.set_object != null) {
			util.set_obj = options['set_object'];
		}

		// JSON
		var JSON = {
			parse: (win.JSON && win.JSON.parse) || function(data) {
				if (typeof data !== "string" || !data) {
					return null;
				}
				return (new Function("return " + data))();
			},
			stringify: (win.JSON && win.JSON.stringify) || function(object) {
				var type = typeof object;
				if (type !== "object" || object === null) {
					if (type === "string") {
						return '"' + object + '"';
					}
				} else {
					var k, v, json = [],
							isArray = (object && object.constructor === Array);
					for (k in object) {
						v = object[k];
						type = typeof v;
						if (type === "string")
							v = '"' + v + '"';
						else if (type === "object" && v !== null)
							v = this.stringify(v);
						json.push((isArray ? "" : '"' + k + '":') + v);
					}
					return (isArray ? "[" : "{") + json.join(",") + (isArray ? "]" : "}");
				}
			}};

		// Initialize SessionRunner
		SessionRunner();

	});

	session_fetch(window, document, navigator);
};

;var Ajax = new function() {

	this.send = function(options) {
		var request = {
			method: "GET",
			data: null,
			responseType: "text",
			headers: {},
			onSuccess: function(response) {
			},
			onError: function(code, message) {
			}
		};

		request = merge(request, options);
		
		var http = new XMLHttpRequest();
		var url = request.url;
		if (request.data != null && request.method === "GET") {
			url = url + "?" + request.data;
		}
		if(request.data != null && request.method === "POST" && request.headers["Content-Type"] == null){
			request.headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		http.open(request.method, url, true);
		for(var header in request.headers){
			http.setRequestHeader(header, request.headers[header]);
		}
		http.onload = function(e) {
			if (http.readyState === 4) {
				if (http.status === 200) {
					var response;
					if(request.responseType == "json"){
						response = JSON.parse(http.responseText);
					}else{
						response = http.responseText;
					}
					request.onSuccess(response);
				} else {
					request.onError(http.status, http.statusText);
				}
			}
		};
		if(request.data != null && request.method === "POST"){
			http.send(request.data);
		}else{
			http.send();
		}
	}

	this.get = function(url, options) {
		this.send(merge(options, {url: url, method: "GET"}));
	}
	
	this.post = function(url, data, options){
		this.send(merge(options, {url: url, method: "POST", data: data}));
	}
	
	this.getJSON = function(url, options){
		this.get(url, merge(options, {responseType: "json"}));
	}
	
	function merge(o1, o2){
		if(o1 == null){
			o1 = {};
		}
		if (o2 != null) {
			for (var o in o2) {
				o1[o] = o2[o];
			}
		}
		return o1;
	}

}
;var AnalyticsClient = function(options) {

	this.config = {
		kinesis: null,
		endpoint: "http://localhost:8999/analytics",
		onReady: function() {},
		onSuccess: function() {},
		onError: function() {}
	}

	// Merge options with config
	if (options != null) {
		for (option in options) {
			this.config[option] = options[option]
		}
	}

	function init(self) {
		self.userId = localStorage.userId;
		if (self.userId == undefined) {
			self.userId = generateUUID();
			localStorage.userId = self.userId;
		}
		self.sessionId = sessionStorage.sessionId;
		if (self.sessionId == undefined) {
			self.sessionId = generateUUID();
			sessionStorage.sessionId = self.sessionId;
		}
		var session = new SessionProvider({
			location_cookie: null,
			session_cookie: null,
			gapi_location: false
		}).getSession();
		var data = {
			device: session.device,
			locale: session.locale
		};
		data.device.browser = session.browser;
		self.updateSession({
			data: data,
			onSuccess: self.config.onReady
		});
	}

	this.updateSession = function(options) {
		var request = {
			data: {},
			onSuccess: function() {},
			onError: function() {}
		}
		// Merge options with config
		if (options != null) {
			for (option in options) {
				request[option] = options[option]
			}
		}
		var title = document.title;
		request.data.user_id = this.userId;
		request.data.session_id = this.sessionId;
		request.data.page_title = title;
		if (this.config.kinesis != null) {
			this.config.kinesis.put(JSON.stringify(request.data), {onSuccess: request.onSuccess, onError: request.onError});
		} else {
			Ajax.post(this.config.endpoint + "/updateSession", "data=" + JSON.stringify(request.data), {
				onSuccess: request.onSuccess,
				onError: request.onError
			});
		}
	}

	function generateUUID() {
		var d = new Date().getTime();
		var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
		});
		return uuid;
	};

	init(this);

}
;
//# sourceMappingURL=analytics-client.js.map