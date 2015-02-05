// Submission handler to send data via an ajax post
var AjaxAnalyticsSubmissionHandler = function(url) {
	this.submit = function(request) {
		var params = "data=" + JSON.stringify(request.data);
		Ajax.post(url, params, {
			onSuccess: request.onSuccess,
			onError: request.onError
		});
	}
}

// Submission handler to send data to kinesis
var KinesisAnalyticsSubmissionHandler = function(kinesisClient) {
	this.submit = function(request) {
		kinesisClient.put(JSON.stringify(request.data), {
			partitionKey: request.data.key,
			onSuccess: request.onSuccess,
			onError: request.onError
		});
	}

};

var RevsysAnalyticsClient = function(options) {

	// Store reference to self
	var $this = this;

	// Store reference to self in window object for jsonp callbacks
	var id = "RevsysAnalyticsClientInstance" + Math.floor(Math.random() * 999999);
	window[id] = this;

	// Store time offset between server and client
	var serverTime;
	var serverTimeOffset;

	// Default config
	this.config = {
		cacheServer: null,
		persistSessionState: true,
		updateSessionOnHashChange: true,
		updateSessionOnUnload: true,
		updateSessionOnResize: true,
		includeFingerprintBreakdown: false,
		staticData: {},
		initialData: {},
		elementSelector: "data-analytics",
		formSelector: "data-analytics-form",
		clickSelector: "data-analytics-click",
		includeNetworkData: false,
		includeHeaders: [
			"X-Forwarded-For",
			"Client-ip",
			"Via"
		],
		window: window,
		submissionHandler: new function() {
			this.submit = function(request) {
				throw "You must specify a submission handler";
			}
		},
		onReady: function() {},
		onSuccess: function() {},
		onError: function() {}
	}

	// Merge options with config
	this.config = merge(this.config, options);

	// Target window object
	var targetWindow = this.config.window;

	// Provide a console.error function if one doesn't exist
	if (!targetWindow.console || !targetWindow.console.error) {
		this.console = {};
		this.console.error = function(e) {};
	} else {
		this.console = targetWindow.console
	}

	// Get sessionId
	this.sessionId = getSessionId();

	// Timeout id to allow buffering of resize request
	var resizeTimeoutId = false;

	// Static data sent with every request
	var staticData = {
		ipAddress: {}
	};

	// Initialise the client
	function init() {
		// Setup session
		var newSession = true;
		var sessionData = getSessionData();
		if (sessionData) {
			newSession = false;
			serverTime = sessionData.serverTime;
			serverTimeOffset = sessionData.serverTimeOffset;
			staticData = sessionData.data;
		}
		// Setup static data
		getUserId(function(userId) {
			$this.userId = userId;
			staticData.userId = userId;
			staticData.sessionId = $this.sessionId;
			staticData.domain = targetWindow.location.hostname;
			// Add event listeners
			if ($this.config.updateSessionOnUnload === true) {
				addEventListener(targetWindow, "beforeunload", function(e) {
					var activeElement = null;
					if (e.target && e.target.activeElement) {
						activeElement = {
							type: e.target.activeElement.tagName,
							id: e.target.activeElement.id,
							href: e.target.activeElement.href,
							target: e.target.activeElement.target,
						};
					}
					$this.updateSession({
						event: {
							type: "unload",
							activeElement: activeElement
						}
					});
				});
			}
			if ($this.config.updateSessionOnHashChange === true) {
				addEventListener(targetWindow, "hashchange", function() {
					$this.updateSession({
						event: {
							type: "hashchange",
						}
					});
				});
			};
			if ($this.config.updateSessionOnResize === true) {
				addEventListener(targetWindow, "resize", function() {
					if (resizeTimeoutId !== false) {
						targetWindow.clearTimeout(resizeTimeoutId);
					}
					resizeTimeoutId = targetWindow.setTimeout(function() {
						$this.updateSession({
							event: {
								type: "resize",
							}
						});
					}, 1000);
				});
			};
			if ($this.config.clickSelector && targetWindow.document.querySelectorAll) {
				var elements = targetWindow.document.querySelectorAll("[" + $this.config.clickSelector + "]");
				forEach(elements, function(element) {
					var eventName = element.getAttribute($this.config.clickSelector);
					addEventListener(element, "click", function(e) {
						$this.updateSession({
							event: {
								type: "click",
								target: eventName
							}
						});
					});
				});
			};
			if ($this.config.formSelector && targetWindow.document.querySelectorAll) {
				var forms = targetWindow.document.querySelectorAll("form[" + $this.config.formSelector + "]");
				forEach(forms, function(form) {
					var formName = form.getAttribute($this.config.formSelector);
					addEventListener(form, "submit", function(e) {
						var formData = form2js(form, ".", false);
						$this.updateSession({
							event: {
								type: "form",
								target: formName,
								data: formData
							}
						});
					})
				});
			}
			if (newSession) {
				var fingerprint = new Fingerprint({
					breakdown: $this.config.includeFingerprintBreakdown,
					canvas: true,
					webgl: true
				}).get();
				if ($this.config.includeFingerprintBreakdown == true) {
					staticData.fingerprint = fingerprint.value;
					staticData.fingerprintBreakdown = fingerprint.breakdown;
				} else {
					staticData.fingerprint = fingerprint;
				}
				callSafe(function() {
					getLocalIPs(function(localIPs) {
						staticData.ipAddress.local = localIPs;
						getServerInfo();
					});
				});
			} else {
				initSession();
			}
		});
	}

	// Send first analytics
	function initSession() {
		persistSessionData({
			serverTime: serverTime,
			serverTimeOffset: serverTimeOffset,
			data: staticData
		});
		var initData = copy($this.config.initialData);
		initData.event = {
			"type": "load"
		};
		$this.updateSession(initData, {
			onSuccess: $this.config.onReady
		});
	}

	// Function to trigger sending latest analytics
	this.updateSession = function(data, options) {
		var request = {
			onSuccess: function() {},
			onError: function() {}
		}
		var requestId = generateUUID();
		// Merge options with request
		request = merge(request, options);
		request.data = {}
		request.data = merge(request.data, staticData);
		request.data = merge(request.data, this.config.staticData);
		request.data = merge(request.data, getAllInfo());
		request.data = merge(request.data, data);
		if (!request.data.event) {
			request.data.event = {
				type: "unknown"
			};
		}
		var now = new Date().getTime();
		request.data.timestamp = now - serverTimeOffset;
		request.data.clientTimestamp = now;
		request.data.requestId = requestId;
		this.config.submissionHandler.submit(request);
		return requestId;
	};

	// Compile all analytics data together
	function getAllInfo() {
		var data = {};
		callSafe(function() {
			data.device = getDeviceInfo();
		});
		callSafe(function() {
			data.browser = getBrowserInfo();
		});
		callSafe(function() {
			data.page = getPageInfo();
		});
		callSafe(function() {
			data.connection = getConnectionInfo();
		});
		callSafe(function() {
			data.locale = getLocaleInfo();
		});
		callSafe(function() {
			data.media = getMediaInfo();
		})
		callSafe(function() {
			data.scripts = getScripts();
		});
		callSafe(function() {
			data.frames = getFrames();
		});
		// Collect values from dom elements marked with the configured element selector
		if (targetWindow.document.querySelectorAll) {
			if ($this.config.elementSelector) {
				var elements = targetWindow.document.querySelectorAll("[" + $this.config.elementSelector + "]");
				forEach(elements, function(element) {
					var propertyName = element.getAttribute($this.config.elementSelector);
					var propertyValue = null;
					if (element.tagName == "INPUT") {
						propertyValue = element.value;
					} else {
						var childNodes = element.childNodes;
						if (childNodes.length == 1 && childNodes[0].nodeType == 3) {
							propertyValue = element.innerHTML;
						}
					}
					if(propertyName.indexOf("|") > -1){
						var regex = propertyName.substring(propertyName.indexOf("|")+1);
						propertyName = propertyName.substring(0, propertyName.indexOf("|"));
						var matches = propertyValue.match(regex);
						if(matches.length > 1){
							propertyValue = matches[1];
						}else if(matches.length == 1){
							propertyValue = matches[0];
						}else{
							propertyValue = "";
						}
					}
					data[propertyName] = propertyValue;
				});
			}
		}
		return data;
	}

	// Get userId using appCache or localStorage
	function getUserId(fn) {
		var userId;
		if (localStorage) {
			userId = localStorage.userId;
		}
		var callback = function(userId) {
			if (localStorage) {
				//localStorage.userId = userId;
			}
			fn(userId);
		}
		if (userId == undefined) {
			userId = generateUUID();
			if ($this.config.cacheServer) {
				Ajax.get($this.config.cacheServer, {
					headers: {
						"X-Cache-Data": userId
					},
					onSuccess: function(data) {
						userId = data;
						callback(userId);
					},
					onError: function(err) {
						callback(userId);
					}
				});
			} else {
				callback(userId);
			}
		} else {
			callback(userId);
		}
	}

	// Get sessionId using sessionStorage
	function getSessionId() {
		var sessionId;
		if (sessionStorage) {
			sessionId = sessionStorage.sessionId;
		}
		if (sessionId == undefined) {
			sessionId = generateUUID();
			if (sessionStorage) {
				sessionStorage.sessionId = sessionId;
			}
		}
		return sessionId;
	}

	// Get session data from sessionStorage
	function getSessionData() {
		if ($this.config.persistSessionState != true) {
			return null;
		}
		var sessionData = sessionStorage.sessionData;
		if (sessionData == undefined) {
			return null;
		} else {
			return JSON.parse(sessionData);
		}
	}

	// Persist session data
	function persistSessionData(data) {
		if ($this.config.persistSessionState == true) {
			sessionStorage.sessionData = JSON.stringify(data);
		}
	}

	// Device information
	function getDeviceInfo() {
		var device = {
			platform: targetWindow.navigator.platform,
			screen: flatten(targetWindow.screen),
			pixelRatio: targetWindow.devicePixelRatio
		};
		return device;
	}

	// Browser information
	function getBrowserInfo() {
		var browser = {
			vendor: targetWindow.navigator.vendor,
			vendorSub: targetWindow.navigator.vendorSub,
			product: targetWindow.navigator.product,
			productSub: targetWindow.navigator.productSub,
			userAgent: targetWindow.navigator.userAgent,
			mimeTypes: targetWindow.navigator.mimeTypes.length,
			plugins: targetWindow.navigator.plugins.length,
			language: targetWindow.navigator.language,
			screen: {
				outerWidth: targetWindow.outerWidth,
				outerHeight: targetWindow.outerHeight,
				innerWidth: targetWindow.innerWidth,
				innerHeight: targetWindow.innerHeight,
				viewportWidth: targetWindow.document.documentElement.clientWidth,
				viewportHeight: targetWindow.document.documentElement.clientHeight
			}
		}
		return browser;
	}

	// Page information
	function getPageInfo() {
		var page = {
			location: targetWindow.location,
			title: targetWindow.document.title,
			referrer: targetWindow.document.referrer,
			iframed: targetWindow.top.location !== targetWindow.location,
			screen: {
				width: targetWindow.document.documentElement.offsetWidth,
				height: targetWindow.document.documentElement.offsetHeight,
				xOffset: targetWindow.pageXOffset,
				yOffset: targetWindow.pageYOffset
			}
		}
		if (targetWindow.performance) {
			page.performance = targetWindow.performance.timing;
		}
		return page;
	}

	// Locale information
	function getLocaleInfo() {
		var lang = ((
			targetWindow.navigator.language ||
			targetWindow.navigator.browserLanguage ||
			targetWindow.navigator.systemLanguage ||
			targetWindow.navigator.userLanguage
		) || '').split("-");
		if (lang.length == 2) {
			return {
				country: lang[1].toLowerCase(),
				lang: lang[0].toLowerCase()
			};
		} else if (lang) {
			return {
				lang: lang[0].toLowerCase(),
				country: null
			};
		} else {
			return {
				lang: null,
				country: null
			};
		}
	}

	// Media information
	function getMediaInfo() {
		var mediaTypes = ["aural", "screen", "print", "braille", "handheld", "projection", "tv", "tty", "embossed"];
		for (var i = 0; i < mediaTypes.length; i++) {
			var mediaType = mediaTypes[i];
			if (matchMedia(mediaType)) {
				return {
					type: mediaType
				};
			}
		}
	}

	function matchMedia(expr) {
		return targetWindow.matchMedia(expr).matches;
	}

	// Get an array of scripts currently on the page
	function getScripts() {
		var result = [];
		var scripts = targetWindow.document.scripts;
		forEach(scripts, function(script) {
			if (script.src) {
				result.push({
					type: script.type,
					src: script.src,
					async: script.async,
					defer: script.defer
				});
			}
		});
		return result;
	}

	// Get an array of frames current in the page
	function getFrames() {
		var result = [];
		var frames = targetWindow.document.getElementsByTagName("iframe");
		forEach(frames, function(frame) {
			result.push({
				src: frame.src,
				name: frame.name,
				id: frame.id
			});
		});
		return result;
	}

	// Retrieve local IP using webRTC
	function getLocalIPs(callback) {
		var localIPs = [];
		var RTCPeerConnection = /*window.RTCPeerConnection ||*/ targetWindow.webkitRTCPeerConnection || targetWindow.mozRTCPeerConnection;

		if (RTCPeerConnection) {
			(function() {
				var rtc = new RTCPeerConnection({
					iceServers: []
				});
				if (1 || targetWindow.mozRTCPeerConnection) { // FF [and now Chrome!] needs a channel/stream to proceed
					rtc.createDataChannel('', {
						reliable: false
					});
				};

				rtc.onicecandidate = function(evt) {
					if (evt.candidate == null) {
						callback(localIPs);
					} else {
						// convert the candidate to SDP so we can run it through our general parser
						// see https://twitter.com/lancestout/status/525796175425720320 for details
						if (evt.candidate) {
							grepSDP("a=" + evt.candidate.candidate);
						}
					}
				};
				rtc.createOffer(function(offerDesc) {
					grepSDP(offerDesc.sdp);
					rtc.setLocalDescription(offerDesc);
				}, function(e) {
					callback([]);
				});


				var addrs = Object.create(null);
				addrs["0.0.0.0"] = false;

				function addIP(newAddr) {
					if (newAddr in addrs) return;
					else addrs[newAddr] = true;
					localIPs.push(newAddr);
				}

				function grepSDP(sdp) {
					var hosts = [];
					sdp.split('\r\n').forEach(function(line) { // c.f. http://tools.ietf.org/html/rfc4566#page-39
						if (~line.indexOf("a=candidate")) { // http://tools.ietf.org/html/rfc4566#section-5.13
							var parts = line.split(' '), // http://tools.ietf.org/html/rfc5245#section-15.1
								addr = parts[4],
								type = parts[7];
							if (type === 'host') {
								addIP(addr);
							}
						} else if (~line.indexOf("c=")) { // http://tools.ietf.org/html/rfc4566#section-5.7
							var parts = line.split(' '),
								addr = parts[2];
							addIP(addr);
						}
					});
				}
			})();
		} else {
			callback([]);
		}
	}

	// Send a request to google appengine requestmirrot to retrieve additional details
	function getServerInfo() {
		var el = document.createElement('script');
		el.async = true;
		document.getElementsByTagName('script')[0].appendChild(el);
		setTimeout(function() { // set source after insertion - needed for older versions of IE
			var src = "https://requestmirror.appspot.com/?callback=window." + id + ".processServerInfo";
			if ($this.config.includeNetworkData == true) {
				src = src + "&includeNetwork=true";
			}
			el.src = src;
		}, 0);
	}

	// Process response from google appengine request mirror
	this.processServerInfo = function(data) {
		staticData.location = {
			language: data.headers['Accept-Language'],
			city: data.headers['X-AppEngine-City'],
			country: data.headers['X-AppEngine-Country'],
			region: data.headers['X-AppEngine-Region'],
			coords: data.headers['X-AppEngine-CityLatLong'],
		}
		if (data.network) {
			staticData.network = data.network;
		}
		staticData.headers = {};
		forEach(this.config.includeHeaders, function(header) {
			if (data.headers[header]) {
				staticData.headers[header] = data.headers[header];
			}
		});
		serverTime = data.timestamp;
		serverTimeOffset = new Date().getTime() - serverTime;
		staticData.ipAddress.remote = data.ipAddress;
		initSession();
	}

	// Connection details
	function getConnectionInfo() {
		var navConnection = targetWindow.navigator.connection || targetWindow.navigator.mozConnection || targetWindow.navigator.webkitConnection || {
			bandwidth: "not supported",
			metered: "not supported"
		};
		return flatten(navConnection);
	}

	// Utility function to safely invoke a function, logging any error throw
	function callSafe(f) {
		try {
			f();
		} catch (e) {
			$this.console.error(e);
		}
	}

	// Utility function to copy an object
	function copy(obj) {
		return flatten(obj);
	}

	// Utility function to flatten an object - therefore putting prototype properties on the object itself
	function flatten(obj) {
		var result = {};
		for (var key in obj) {
			value = obj[key];
			result[key] = value;
		}
		return result;
	}

	// Utility function to merge two objects
	function merge(obj1, obj2) {
		if (obj2 != null) {
			for (var key in obj2) {
				obj1[key] = obj2[key];
			}
		}
		return obj1;
	}

	// Utility function to generate a UUID
	function generateUUID() {
		var d = new Date().getTime();
		var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
		});
		return uuid;
	};

	// Utility function to polyfill addEventListener
	function addEventListener(object, event, listener) {
		if (object.addEventListener) {
			object.addEventListener(event, listener);
		} else if (object.attachEvent) {
			object.attachEvent(event, listener);
		}
	}

	// Utility function to loop through arrays
	function forEach(items, fn) {
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			fn(item, i);
		}
	}

	// Utility method to see if browser supports CORS
	function supportsCors() {
		var xhr = new XMLHttpRequest();
		if ("withCredentials" in xhr) {
			// Supports CORS
			return true;
		} else if (typeof XDomainRequest != "undefined") {
			// IE
			return true;
		}
		return false;
	}

	// Initialise the client if the page has loaded, or wait until it has finished loading
	if (!targetWindow.performance || !targetWindow.performance.timing || targetWindow.performance.timing.loadEventStart > 0) {
		init();
	} else {
		addEventListener(targetWindow, "load", function() {
			setTimeout(function() {
				init($this);
			}, 0);
		}, false);
	}

}