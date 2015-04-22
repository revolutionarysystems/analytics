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
		includeServerData: false,
		includeFingerprintBreakdown: false,
		staticData: {},
		initialData: {},
		elementSelector: "data-analytics",
		formSelector: "data-analytics-form",
		encryptedElementSelector: "data-analytics-encrypt",
		encryptionKey: null,
		encryptionOptions: {},
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

	var encrypt;

	var fontDetector = new FontDetector(targetWindow.document);

	var newSession = true;

	// Initialise the client
	function init() {
		// Setup session
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
						type: "unload",
						activeElement: activeElement
					});
				});
			}
			if ($this.config.updateSessionOnHashChange === true) {
				addEventListener(targetWindow, "hashchange", function() {
					$this.updateSession("hashchange");
				});
			};
			if ($this.config.updateSessionOnResize === true) {
				addEventListener(targetWindow, "resize", function() {
					if (resizeTimeoutId !== false) {
						targetWindow.clearTimeout(resizeTimeoutId);
					}
					resizeTimeoutId = targetWindow.setTimeout(function() {
						$this.updateSession("resize");
					}, 1000);
				});
			};
			if ($this.config.clickSelector && targetWindow.document.querySelectorAll) {
				var elements = targetWindow.document.querySelectorAll("[" + $this.config.clickSelector + "]");
				forEach(elements, function(element) {
					var eventName = element.getAttribute($this.config.clickSelector);
					addEventListener(element, "click", function(e) {
						$this.updateSession({
							type: "click",
							target: eventName
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
							type: "form",
							target: formName
						}, formData);
					})
				});
			}
			if ($this.config.includeServerData == true && newSession) {
				getServerInfo();
			} else {
				initSession();
			}
		});
	}

	// Send first analytics
	function initSession(fpData) {
		var callback = function() {
			persistSessionData({
				serverTime: serverTime,
				serverTimeOffset: serverTimeOffset,
				data: staticData
			});
			var initData = copy($this.config.initialData);
			$this.updateSession("load", initData, {
				onSuccess: $this.config.onReady
			});
		}
		if (newSession) {
			callSafe(function() {
				getLocalIPs(function(localIPs) {
					localIPs.sort();
					localIPs.reverse();
					staticData.ipAddress.local = localIPs;
					staticData.fingerprints = generateFingerprints(staticData);
					callback();
				});
			});
		} else {
			callback();
		}
	}

	// Function to trigger sending latest analytics
	this.updateSession = function(event, data, options) {
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
		if (typeof event == "object") {
			request.data.event = event;
			if (!request.data.event.type) {
				request.data.event.type = "unknown"
			}
		} else if (typeof event == "string") {
			request.data.event = {
				type: event
			}
		}
		request.data.customData = getCustomInfo();
		if (data) {
			request.data.customData = merge(request.data.customData, data);
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
		return data;
	}

	// Collect custom info from dom
	function getCustomInfo() {
		var data = {};
		// Collect values from dom elements marked with the configured element selector
		if (targetWindow.document.querySelectorAll) {
			if ($this.config.elementSelector) {
				data = extractData($this.config.elementSelector);
			}
			if ($this.config.encryptedElementSelector && $this.config.encryptionKey) {
				data = merge(data, extractData($this.config.encryptedElementSelector, $this.config.encryptionKey));
			}
		}
		return data;
	}

	function extractData(selector, encryptionKey) {
		var data = {};
		var elements = targetWindow.document.querySelectorAll("[" + selector + "]");
		forEach(elements, function(element) {
			var propertyName = element.getAttribute(selector);
			var propertyValue = null;
			if (element.tagName == "INPUT" || element.tagName == "SELECT") {
				propertyValue = element.value;
			} else {
				var childNodes = element.childNodes;
				if (childNodes.length == 1 && childNodes[0].nodeType == 3) {
					propertyValue = element.innerHTML;
				}
			}
			if (propertyName.indexOf("|") > -1) {
				var regex = propertyName.substring(propertyName.indexOf("|") + 1);
				propertyName = propertyName.substring(0, propertyName.indexOf("|"));
				var matches = propertyValue.match(regex);
				if (matches == null || matches.length == 0) {
					propertyValue = null;
				} else if (matches.length == 1) {
					propertyValue = matches[0];
				} else {
					propertyValue = matches[1];
				}
			}
			if (encryptionKey) {
				if (!encrypt) {
					encrypt = new JSEncrypt($this.config.encryptionOptions);
					encrypt.setPublicKey(encryptionKey);
				}
				if (propertyValue != "") {
					propertyValue = encrypt.encrypt(propertyValue);
					if (propertyValue == false) {
						propertyValue = null;
					} else {
						propertyValue = "data:encrypted:" + propertyValue;
					}
				}
			}
			data[propertyName] = propertyValue;
		});
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
				localStorage.userId = userId;
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

	// Get information about media devices
	function getMediaDevices(callback) {
		var devices = {
			audio: 0,
			video: 0
		};
		if (targetWindow.MediaStreamTrack && targetWindow.MediaStreamTrack.getSources) {
			targetWindow.MediaStreamTrack.getSources(function(data) {
				forEach(data, function(device) {
					if (device.kind == "audio") {
						devices.audio = devices.audio + 1;
					} else if (device.kind == "video") {
						devices.video = devices.video + 1;
					}
				});
				callback(devices);
			});
		} else {
			callback(devices);
		}
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
			},
			visibility: targetWindow.document.visibilityState || targetWindow.document.webkitVisibilityState || targetWindow.document.mozVisibilityState
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
	var mediaTypes = ["aural", "screen", "print", "braille", "handheld", "projection", "tv", "tty", "embossed"];

	function getMediaInfo() {
		var media = {};
		for (var i = 0; i < mediaTypes.length; i++) {
			var mediaType = mediaTypes[i];
			if (matchMedia(mediaType)) {
				media.type = mediaType;
				break;
			}
		}
		return media;
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
				id: frame.id,
				position: flatten(frame.getBoundingClientRect())
			});
		});
		return result;
	}

	// Retrieve local IP using webRTC
	function getLocalIPs(callback) {
		var localIPs = [];
		var RTCPeerConnection = targetWindow.RTCPeerConnection || targetWindow.webkitRTCPeerConnection || targetWindow.mozRTCPeerConnection;

		if (RTCPeerConnection) {
			(function() {

				try {
					var rtc = new RTCPeerConnection({
						iceServers: []
					});
					if (rtc.createDataChannel) {
						rtc.createDataChannel('', {
							reliable: false
						});
					}

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
				} catch (e) {
					$this.console.error(e);
					callback([]);
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
		var headersFingerprint = "";
		forEach(data.headers, function(key, value) {
			if (key.indexOf("X-AppEngine") == -1) {
				headersFingerprint = headersFingerprint + key + "#";
			}
			if ($this.config.includeHeaders.indexOf(key) > -1) {
				staticData.headers[key] = value;
			}
		});
		serverTime = data.timestamp;
		serverTimeOffset = new Date().getTime() - serverTime;
		staticData.ipAddress.remote = data.ipAddress;
		initSession({
			headersFingerprint: headersFingerprint
		});
	}

	// Connection details
	function getConnectionInfo() {
		var navConnection = targetWindow.navigator.connection || targetWindow.navigator.mozConnection || targetWindow.navigator.webkitConnection || {
			bandwidth: "not supported",
			metered: "not supported"
		};
		return flatten(navConnection);
	}

	function generateFingerprints(data) {
		// Generate fingerprint based on user preferences
		var pfpData = {
			cookieEnabled: targetWindow.navigator.cookieEnabled.toString(),
			language: targetWindow.navigator.language.toLowerCase(),
			timezoneOffset: new Date().getTimezoneOffset(),
			localStorage: hasLocalStorage(),
			sessionStorage: hasSessionStorage()
		}

		var pfp = hashValues(pfpData);

		// Generate fingerprint based on device information
		var width = targetWindow.screen.width;
		var height = targetWindow.screen.height;
		var pixelRatio = targetWindow.devicePixelRatio;
		var screenSize = Math.sqrt((height * height) + (width * width)) / (pixelRatio * 96);
		var webGL = getWebGLFingerprint();
		var userAgent = targetWindow.navigator.userAgent;
		userAgent = userAgent.substring(userAgent.indexOf('(') + 1, userAgent.indexOf(')'));
		var dfpData = {
			platform: targetWindow.navigator.platform,
			hardwareConcurrency: targetWindow.navigator.hardwareConcurrency,
			glVendor: webGL.glVendor,
			glRenderer: webGL.glRenderer,
			colorDepth: targetWindow.screen.colorDepth,
			maxTouchPoints: targetWindow.navigator.maxTouchPoints,
			pixelRatio: pixelRatio,
			screenSize: screenSize,
			userAgent: userAgent,
			fonts: getFontsList().join(",")
		}

		var dfp = hashValues(dfpData);

		// Generate fingerprint based on browser information
		var bfpData = {
			userAgent: targetWindow.navigator.userAgent,
			platform: targetWindow.navigator.platform,
			language: targetWindow.navigator.language.toLowerCase(),
			mimeTypes: targetWindow.navigator.mimeTypes.length,
			plugins: getPluginsString(),
			canvasFingerprint: getCanvasFingerprint(),
			glFingerprint: webGL.glFingerprint
		}

		var bfp = hashValues(bfpData);

		// Generate fingerprint based on connection information
		var cfpData = {
			networkName: data.network ? data.network.name : "Unknown",
			networkDescription: data.network ? data.network.description : "Unknown",
			remoteIP: data.ipAddress.remote,
			localIP: data.ipAddress.local
		}

		var cfp = hashValues(cfpData);

		var result = {
			preferences: pfp,
			device: dfp,
			browser: bfp,
			connection: cfp
		};

		if ($this.config.includeFingerprintBreakdown == true) {
			result.breakdown = {
				preferences: pfpData,
				device: dfpData,
				browser: bfpData,
				connection: cfpData
			}
		}

		return result;
	}

	function getPluginsString() {
		var result = "";
		forEach(navigator.plugins, function(plugin) {
			var pluginString = plugin.name + "::" + plugin.description + "::"
			forEach(plugin, function(mimeType) {
				pluginString = pluginString + mimeType.type + "~" + mimeType.suffixes + ",";
			})
			result = result + pluginString + ";";
		});
		return result;
	}

	function getCanvasFingerprint() {
		if (!isCanvasSupported()) {
			return "Not supported";
		}
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		// https://www.browserleaks.com/canvas#how-does-it-work
		var txt = 'Cwm fjordbank glyphs vext quiz';
		ctx.textBaseline = "top";
		ctx.font = "14px 'Arial'";
		ctx.textBaseline = "alphabetic";
		ctx.fillStyle = "#f60";
		ctx.fillRect(125, 1, 62, 20);
		ctx.fillStyle = "#069";
		ctx.fillText(txt, 2, 15);
		ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
		ctx.fillText(txt, 4, 17);
		return canvas.toDataURL();
	}

	function getWebGLFingerprint() {
		var result = {
			glVendor: "Not supported",
			glRenderer: "Not supported",
			glFingerprint: "Not supported"
		}

		if (!isCanvasSupported()) {
			return result;
		}

		// Create canvas
		var canvas = document.createElement("canvas");
		canvas.setAttribute("width", "640px");
		canvas.setAttribute("height", "480px");
		//document.body.appendChild(canvas);

		// Init webgl
		var gl;
		try {
			gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		} catch (e) {}
		if (!gl) {
			return result;
		}

		// Get vendor and renderer if available
		if (gl.getSupportedExtensions().indexOf("WEBGL_debug_renderer_info") >= 0) {
			result.glVendor = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_VENDOR_WEBGL);
			result.glRenderer = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
		}

		// Clear canvas
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Set viewport
		gl.viewport(0, 0, canvas.width, canvas.height);

		// Create cube
		// Vertex Data
		var vertexBuffer;
		vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		var verts = [
			// Front face
			-1.0, -1.0, 1.0,
			1.0, -1.0, 1.0,
			1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

			// Back face
			-1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
			1.0, 1.0, -1.0,
			1.0, -1.0, -1.0,

			// Top face
			-1.0, 1.0, -1.0, -1.0, 1.0, 1.0,
			1.0, 1.0, 1.0,
			1.0, 1.0, -1.0,

			// Bottom face
			-1.0, -1.0, -1.0,
			1.0, -1.0, -1.0,
			1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

			// Right face
			1.0, -1.0, -1.0,
			1.0, 1.0, -1.0,
			1.0, 1.0, 1.0,
			1.0, -1.0, 1.0,

			// Left face
			-1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0
		];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

		// Color data
		var colorBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
		var faceColors = [
			[1.0, 0.0, 0.0, 1.0], // Front face
			[0.0, 1.0, 0.0, 1.0], // Back face
			[0.0, 0.0, 1.0, 1.0], // Top face
			[1.0, 1.0, 0.0, 1.0], // Bottom face
			[1.0, 0.0, 1.0, 1.0], // Right face
			[0.0, 1.0, 1.0, 1.0] // Left face
		];
		var vertexColors = [];
		for (var i in faceColors) {
			var color = faceColors[i];
			for (var j = 0; j < 4; j++) {
				vertexColors = vertexColors.concat(color);
			}
		}
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexColors), gl.STATIC_DRAW);

		// Index data (defines the triangles to be drawn)
		var cubeIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
		var cubeIndices = [
			0, 1, 2, 0, 2, 3, // Front face
			4, 5, 6, 4, 6, 7, // Back face
			8, 9, 10, 8, 10, 11, // Top face
			12, 13, 14, 12, 14, 15, // Bottom face
			16, 17, 18, 16, 18, 19, // Right face
			20, 21, 22, 20, 22, 23 // Left face
		];
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);

		var cube = {
			buffer: vertexBuffer,
			colorBuffer: colorBuffer,
			indices: cubeIndexBuffer,
			vertSize: 3,
			nVerts: 24,
			colorSize: 4,
			nColors: 24,
			nIndices: 36,
			primtype: gl.TRIANGLES
		};

		// Create a model view matrix with camera at 0, 0, -6
		var modelViewMatrix = mat4.create();
		mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -6]);

		// Create a project matrix with 45 degree field of view
		var projectionMatrix = mat4.create();
		mat4.perspective(projectionMatrix, Math.PI / 4,
			canvas.width / canvas.height, 1, 10000);

		// Create shaders
		var vertexShaderSource =

			"    attribute vec3 vertexPos;\n" +
			"    attribute vec4 vertexColor;\n" +
			"    uniform mat4 modelViewMatrix;\n" +
			"    uniform mat4 projectionMatrix;\n" +
			"    varying vec4 vColor;\n" +
			"    void main(void) {\n" +
			"        // Return the transformed and projected vertex value\n" +
			"        gl_Position = projectionMatrix * modelViewMatrix * \n" +
			"            vec4(vertexPos, 1.0);\n" +
			"        // Output the vertexColor in vColor\n" +
			"        vColor = vertexColor;\n" +
			"    }\n";

		var fragmentShaderSource =
			"    precision mediump float;\n" +
			"    varying vec4 vColor;\n" +
			"    void main(void) {\n" +
			"    // Return the pixel color: always output white\n" +
			"    gl_FragColor = vColor;\n" +
			"}\n";

		var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, fragmentShaderSource);
		gl.compileShader(fragmentShader);
		var vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, vertexShaderSource);
		gl.compileShader(vertexShader);

		// link them together into a new program
		var shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		// get pointers to the shader params
		var shaderVertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPos");
		gl.enableVertexAttribArray(shaderVertexPositionAttribute);
		var shaderVertexColorAttribute = gl.getAttribLocation(shaderProgram, "vertexColor")
		gl.enableVertexAttribArray(shaderVertexColorAttribute);

		var shaderProjectionMatrixUniform = gl.getUniformLocation(shaderProgram, "projectionMatrix");
		var shaderModelViewMatrixUniform = gl.getUniformLocation(shaderProgram, "modelViewMatrix");

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			return result;
		}

		// Rotate the cube
		var fract = 0.48;
		var angle = Math.PI * 2 * fract;
		mat4.rotate(modelViewMatrix, modelViewMatrix, angle, [1.2, 1, 1]);

		// clear the background (with black)
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.enable(gl.DEPTH_TEST);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// set the shader to use
		gl.useProgram(shaderProgram);

		// connect up the shader parameters: vertex position, color and projection/model matrices
		// set up the buffers
		gl.bindBuffer(gl.ARRAY_BUFFER, cube.buffer);
		gl.vertexAttribPointer(shaderVertexPositionAttribute, cube.vertSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, cube.colorBuffer);
		gl.vertexAttribPointer(shaderVertexColorAttribute, cube.colorSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube.indices);

		gl.uniformMatrix4fv(shaderProjectionMatrixUniform, false, projectionMatrix);
		gl.uniformMatrix4fv(shaderModelViewMatrixUniform, false, modelViewMatrix);

		// draw the object
		gl.drawElements(cube.primtype, cube.nIndices, gl.UNSIGNED_SHORT, 0);

		result.glFingerprint = canvas.toDataURL("image/png");

		return result;
	}

	// Test for a predefined set of fonts
	function getFontsList() {
		var fontList = [];

		if (fontDetector.test('a charming font')) {
			fontList.push('a charming font');
		}
		if (fontDetector.test('abadi mt condensed')) {
			fontList.push('abadi mt condensed');
		}
		if (fontDetector.test('abadi mt condensed extra bold')) {
			fontList.push('abadi mt condensed extra bold');
		}
		if (fontDetector.test('abadi mt condensed light')) {
			fontList.push('abadi mt condensed light');
		}
		if (fontDetector.test('academy engraved let')) {
			fontList.push('academy engraved let');
		}
		if (fontDetector.test('adobe fangsong std')) {
			fontList.push('adobe fangsong std');
		}
		if (fontDetector.test('adobe garamond')) {
			fontList.push('adobe garamond');
		}
		if (fontDetector.test('adobe heiti std')) {
			fontList.push('adobe heiti std');
		}
		if (fontDetector.test('adobe kaiti std')) {
			fontList.push('adobe kaiti std');
		}
		if (fontDetector.test('adobe ming std')) {
			fontList.push('adobe ming std');
		}
		if (fontDetector.test('adobe myungjo std')) {
			fontList.push('adobe myungjo std');
		}
		if (fontDetector.test('adobe song std')) {
			fontList.push('adobe song std');
		}
		if (fontDetector.test('agency fb')) {
			fontList.push('agency fb');
		}
		if (fontDetector.test('aharoni')) {
			fontList.push('aharoni');
		}
		if (fontDetector.test('alba')) {
			fontList.push('alba');
		}
		if (fontDetector.test('alba matter')) {
			fontList.push('alba matter');
		}
		if (fontDetector.test('alba super')) {
			fontList.push('alba super');
		}
		if (fontDetector.test('albertus')) {
			fontList.push('albertus');
		}
		if (fontDetector.test('albertus extra bold')) {
			fontList.push('albertus extra bold');
		}
		if (fontDetector.test('albertus medium')) {
			fontList.push('albertus medium');
		}
		if (fontDetector.test('algerian')) {
			fontList.push('algerian');
		}
		if (fontDetector.test('amaze')) {
			fontList.push('amaze');
		}
		if (fontDetector.test('american typewriter')) {
			fontList.push('american typewriter');
		}
		if (fontDetector.test('andale mono')) {
			fontList.push('andale mono');
		}
		if (fontDetector.test('andale mono ipa')) {
			fontList.push('andale mono ipa');
		}
		if (fontDetector.test('andalus')) {
			fontList.push('andalus');
		}
		if (fontDetector.test('andy')) {
			fontList.push('andy');
		}
		if (fontDetector.test('angsana new')) {
			fontList.push('angsana new');
		}
		if (fontDetector.test('angsanaupc')) {
			fontList.push('angsanaupc');
		}
		if (fontDetector.test('antique olive')) {
			fontList.push('antique olive');
		}
		if (fontDetector.test('antique olive compact')) {
			fontList.push('antique olive compact');
		}
		if (fontDetector.test('apple casual')) {
			fontList.push('apple casual');
		}
		if (fontDetector.test('apple chancery')) {
			fontList.push('apple chancery');
		}
		if (fontDetector.test('arabic transparent')) {
			fontList.push('arabic transparent');
		}
		if (fontDetector.test('arabic typesetting')) {
			fontList.push('arabic typesetting');
		}
		if (fontDetector.test('arial')) {
			fontList.push('arial');
		}
		if (fontDetector.test('arial baltic')) {
			fontList.push('arial baltic');
		}
		if (fontDetector.test('arial black')) {
			fontList.push('arial black');
		}
		if (fontDetector.test('arial ce')) {
			fontList.push('arial ce');
		}
		if (fontDetector.test('arial cyr')) {
			fontList.push('arial cyr');
		}
		if (fontDetector.test('arial greek')) {
			fontList.push('arial greek');
		}
		if (fontDetector.test('arial narrow')) {
			fontList.push('arial narrow');
		}
		if (fontDetector.test('arial rounded mt bold')) {
			fontList.push('arial rounded mt bold');
		}
		if (fontDetector.test('arial tur')) {
			fontList.push('arial tur');
		}
		if (fontDetector.test('arial unicode ms')) {
			fontList.push('arial unicode ms');
		}
		if (fontDetector.test('avant garde')) {
			fontList.push('avant garde');
		}
		if (fontDetector.test('avenir')) {
			fontList.push('avenir');
		}
		if (fontDetector.test('baby kruffy')) {
			fontList.push('baby kruffy');
		}
		if (fontDetector.test('balker')) {
			fontList.push('balker');
		}
		if (fontDetector.test('balthazar')) {
			fontList.push('balthazar');
		}
		if (fontDetector.test('bankgothic lt bt')) {
			fontList.push('bankgothic lt bt');
		}
		if (fontDetector.test('bart')) {
			fontList.push('bart');
		}
		if (fontDetector.test('base')) {
			fontList.push('base');
		}
		if (fontDetector.test('baskerville')) {
			fontList.push('baskerville');
		}
		if (fontDetector.test('baskerville old face')) {
			fontList.push('baskerville old face');
		}
		if (fontDetector.test('batang')) {
			fontList.push('batang');
		}
		if (fontDetector.test('batangche')) {
			fontList.push('batangche');
		}
		if (fontDetector.test('bauhaus')) {
			fontList.push('bauhaus');
		}
		if (fontDetector.test('beesknees itc')) {
			fontList.push('beesknees itc');
		}
		if (fontDetector.test('bell mt')) {
			fontList.push('bell mt');
		}
		if (fontDetector.test('belwe')) {
			fontList.push('belwe');
		}
		if (fontDetector.test('bembo')) {
			fontList.push('bembo');
		}
		if (fontDetector.test('berlin sans fb')) {
			fontList.push('berlin sans fb');
		}
		if (fontDetector.test('berlin sans fb demi')) {
			fontList.push('berlin sans fb demi');
		}
		if (fontDetector.test('bernard mt condensed')) {
			fontList.push('bernard mt condensed');
		}
		if (fontDetector.test('bernhard modern std')) {
			fontList.push('bernhard modern std');
		}
		if (fontDetector.test('berthold akzidenz grotesk be')) {
			fontList.push('berthold akzidenz grotesk be');
		}
		if (fontDetector.test('bickley script')) {
			fontList.push('bickley script');
		}
		if (fontDetector.test('big caslon')) {
			fontList.push('big caslon');
		}
		if (fontDetector.test('bimini')) {
			fontList.push('bimini');
		}
		if (fontDetector.test('bitstream charter')) {
			fontList.push('bitstream charter');
		}
		if (fontDetector.test('bitstream vera sans')) {
			fontList.push('bitstream vera sans');
		}
		if (fontDetector.test('bitstream vera sans mono')) {
			fontList.push('bitstream vera sans mono');
		}
		if (fontDetector.test('bitstream vera serif')) {
			fontList.push('bitstream vera serif');
		}
		if (fontDetector.test('blackadder itc')) {
			fontList.push('blackadder itc');
		}
		if (fontDetector.test('blackletter686 bt')) {
			fontList.push('blackletter686 bt');
		}
		if (fontDetector.test('bodoni mt')) {
			fontList.push('bodoni mt');
		}
		if (fontDetector.test('bodoni mt black')) {
			fontList.push('bodoni mt black');
		}
		if (fontDetector.test('bodoni mt condensed')) {
			fontList.push('bodoni mt condensed');
		}
		if (fontDetector.test('bodoni mt poster compressed')) {
			fontList.push('bodoni mt poster compressed');
		}
		if (fontDetector.test('book antiqua')) {
			fontList.push('book antiqua');
		}
		if (fontDetector.test('bookman')) {
			fontList.push('bookman');
		}
		if (fontDetector.test('bookman old style')) {
			fontList.push('bookman old style');
		}
		if (fontDetector.test('bradley hand itc')) {
			fontList.push('bradley hand itc');
		}
		if (fontDetector.test('braggadocio')) {
			fontList.push('braggadocio');
		}
		if (fontDetector.test('britannic bold')) {
			fontList.push('britannic bold');
		}
		if (fontDetector.test('broadway')) {
			fontList.push('broadway');
		}
		if (fontDetector.test('broadway bt')) {
			fontList.push('broadway bt');
		}
		if (fontDetector.test('browallia new')) {
			fontList.push('browallia new');
		}
		if (fontDetector.test('browalliaupc')) {
			fontList.push('browalliaupc');
		}
		if (fontDetector.test('brush script mt')) {
			fontList.push('brush script mt');
		}
		if (fontDetector.test('budhand')) {
			fontList.push('budhand');
		}
		if (fontDetector.test('caflisch script pro')) {
			fontList.push('caflisch script pro');
		}
		if (fontDetector.test('calibri')) {
			fontList.push('calibri');
		}
		if (fontDetector.test('californian fb')) {
			fontList.push('californian fb');
		}
		if (fontDetector.test('calisto mt')) {
			fontList.push('calisto mt');
		}
		if (fontDetector.test('calligraph421 bt')) {
			fontList.push('calligraph421 bt');
		}
		if (fontDetector.test('cambria')) {
			fontList.push('cambria');
		}
		if (fontDetector.test('cambria math')) {
			fontList.push('cambria math');
		}
		if (fontDetector.test('campbell')) {
			fontList.push('campbell');
		}
		if (fontDetector.test('candara')) {
			fontList.push('candara');
		}
		if (fontDetector.test('capitals')) {
			fontList.push('capitals');
		}
		if (fontDetector.test('caslon')) {
			fontList.push('caslon');
		}
		if (fontDetector.test('castellar')) {
			fontList.push('castellar');
		}
		if (fontDetector.test('casual')) {
			fontList.push('casual');
		}
		if (fontDetector.test('cataneo bt')) {
			fontList.push('cataneo bt');
		}
		if (fontDetector.test('centaur')) {
			fontList.push('centaur');
		}
		if (fontDetector.test('century gothic')) {
			fontList.push('century gothic');
		}
		if (fontDetector.test('century schoolbook')) {
			fontList.push('century schoolbook');
		}
		if (fontDetector.test('century schoolbook l')) {
			fontList.push('century schoolbook l');
		}
		if (fontDetector.test('cg omega')) {
			fontList.push('cg omega');
		}
		if (fontDetector.test('cg times')) {
			fontList.push('cg times');
		}
		if (fontDetector.test('chalkduster')) {
			fontList.push('chalkduster');
		}
		if (fontDetector.test('champignon')) {
			fontList.push('champignon');
		}
		if (fontDetector.test('charcoal')) {
			fontList.push('charcoal');
		}
		if (fontDetector.test('charter')) {
			fontList.push('charter');
		}
		if (fontDetector.test('chasm')) {
			fontList.push('chasm');
		}
		if (fontDetector.test('chicago')) {
			fontList.push('chicago');
		}
		if (fontDetector.test('chick')) {
			fontList.push('chick');
		}
		if (fontDetector.test('chiller')) {
			fontList.push('chiller');
		}
		if (fontDetector.test('clarendon')) {
			fontList.push('clarendon');
		}
		if (fontDetector.test('clarendon condensed')) {
			fontList.push('clarendon condensed');
		}
		if (fontDetector.test('clarendon extended')) {
			fontList.push('clarendon extended');
		}
		if (fontDetector.test('clearlyu')) {
			fontList.push('clearlyu');
		}
		if (fontDetector.test('colonna mt')) {
			fontList.push('colonna mt');
		}
		if (fontDetector.test('comic sans ms')) {
			fontList.push('comic sans ms');
		}
		if (fontDetector.test('commercialscript bt')) {
			fontList.push('commercialscript bt');
		}
		if (fontDetector.test('consolas')) {
			fontList.push('consolas');
		}
		if (fontDetector.test('constantia')) {
			fontList.push('constantia');
		}
		if (fontDetector.test('copperplate')) {
			fontList.push('copperplate');
		}
		if (fontDetector.test('copperplate gothic bold')) {
			fontList.push('copperplate gothic bold');
		}
		if (fontDetector.test('copperplate gothic ligh')) {
			fontList.push('copperplate gothic ligh');
		}
		if (fontDetector.test('coolsville')) {
			fontList.push('coolsville');
		}
		if (fontDetector.test('cooper black')) {
			fontList.push('cooper black');
		}
		if (fontDetector.test('corbel')) {
			fontList.push('corbel');
		}
		if (fontDetector.test('cordia new')) {
			fontList.push('cordia new');
		}
		if (fontDetector.test('cordiaupc')) {
			fontList.push('cordiaupc');
		}
		if (fontDetector.test('coronet')) {
			fontList.push('coronet');
		}
		if (fontDetector.test('courier')) {
			fontList.push('courier');
		}
		if (fontDetector.test('courier new')) {
			fontList.push('courier new');
		}
		if (fontDetector.test('courier new baltic')) {
			fontList.push('courier new baltic');
		}
		if (fontDetector.test('courier new ce')) {
			fontList.push('courier new ce');
		}
		if (fontDetector.test('courier new cyr')) {
			fontList.push('courier new cyr');
		}
		if (fontDetector.test('courier new greek')) {
			fontList.push('courier new greek');
		}
		if (fontDetector.test('courier new tur')) {
			fontList.push('courier new tur');
		}
		if (fontDetector.test('courierps')) {
			fontList.push('courierps');
		}
		if (fontDetector.test('croobie')) {
			fontList.push('croobie');
		}
		if (fontDetector.test('curlz mt')) {
			fontList.push('curlz mt');
		}
		if (fontDetector.test('cursive')) {
			fontList.push('cursive');
		}
		if (fontDetector.test('dfkai-sb')) {
			fontList.push('dfkai-sb');
		}
		if (fontDetector.test('daunpenh')) {
			fontList.push('daunpenh');
		}
		if (fontDetector.test('david')) {
			fontList.push('david');
		}
		if (fontDetector.test('dayton')) {
			fontList.push('dayton');
		}
		if (fontDetector.test('decotype naskh')) {
			fontList.push('decotype naskh');
		}
		if (fontDetector.test('dejavu lgc sans')) {
			fontList.push('dejavu lgc sans');
		}
		if (fontDetector.test('dejavu lgc sans condensed')) {
			fontList.push('dejavu lgc sans condensed');
		}
		if (fontDetector.test('dejavu lgc sans light')) {
			fontList.push('dejavu lgc sans light');
		}
		if (fontDetector.test('dejavu lgc sans mono')) {
			fontList.push('dejavu lgc sans mono');
		}
		if (fontDetector.test('dejavu lgc serif')) {
			fontList.push('dejavu lgc serif');
		}
		if (fontDetector.test('dejavu lgc serif condensed')) {
			fontList.push('dejavu lgc serif condensed');
		}
		if (fontDetector.test('dejavu sans')) {
			fontList.push('dejavu sans');
		}
		if (fontDetector.test('dejavu sans condensed')) {
			fontList.push('dejavu sans condensed');
		}
		if (fontDetector.test('dejavu sans extra light')) {
			fontList.push('dejavu sans extra light');
		}
		if (fontDetector.test('dejavu sans light')) {
			fontList.push('dejavu sans light');
		}
		if (fontDetector.test('dejavu sans mono')) {
			fontList.push('dejavu sans mono');
		}
		if (fontDetector.test('dejavu serif')) {
			fontList.push('dejavu serif');
		}
		if (fontDetector.test('dejavu serif condensed')) {
			fontList.push('dejavu serif condensed');
		}
		if (fontDetector.test('desdemona')) {
			fontList.push('desdemona');
		}
		if (fontDetector.test('didot')) {
			fontList.push('didot');
		}
		if (fontDetector.test('dilleniaupc')) {
			fontList.push('dilleniaupc');
		}
		if (fontDetector.test('dokchampa')) {
			fontList.push('dokchampa');
		}
		if (fontDetector.test('dombold bt')) {
			fontList.push('dombold bt');
		}
		if (fontDetector.test('domestic manners')) {
			fontList.push('domestic manners');
		}
		if (fontDetector.test('dotum')) {
			fontList.push('dotum');
		}
		if (fontDetector.test('dotumche')) {
			fontList.push('dotumche');
		}
		if (fontDetector.test('dustismo')) {
			fontList.push('dustismo');
		}
		if (fontDetector.test('edwardian script itc')) {
			fontList.push('edwardian script itc');
		}
		if (fontDetector.test('electron')) {
			fontList.push('electron');
		}
		if (fontDetector.test('engravers mt')) {
			fontList.push('engravers mt');
		}
		if (fontDetector.test('eras bold itc')) {
			fontList.push('eras bold itc');
		}
		if (fontDetector.test('eras demi itc')) {
			fontList.push('eras demi itc');
		}
		if (fontDetector.test('eras light itc')) {
			fontList.push('eras light itc');
		}
		if (fontDetector.test('eras medium itc')) {
			fontList.push('eras medium itc');
		}
		if (fontDetector.test('estrangelo edessa')) {
			fontList.push('estrangelo edessa');
		}
		if (fontDetector.test('eucrosiaupc')) {
			fontList.push('eucrosiaupc');
		}
		if (fontDetector.test('euphemia')) {
			fontList.push('euphemia');
		}
		if (fontDetector.test('eurostile')) {
			fontList.push('eurostile');
		}
		if (fontDetector.test('fangsong')) {
			fontList.push('fangsong');
		}
		if (fontDetector.test('fantasy')) {
			fontList.push('fantasy');
		}
		if (fontDetector.test('fat')) {
			fontList.push('fat');
		}
		if (fontDetector.test('felix titling')) {
			fontList.push('felix titling');
		}
		if (fontDetector.test('fine hand')) {
			fontList.push('fine hand');
		}
		if (fontDetector.test('firsthome')) {
			fontList.push('firsthome');
		}
		if (fontDetector.test('fixed')) {
			fontList.push('fixed');
		}
		if (fontDetector.test('flat brush')) {
			fontList.push('flat brush');
		}
		if (fontDetector.test('footlight mt light')) {
			fontList.push('footlight mt light');
		}
		if (fontDetector.test('forte')) {
			fontList.push('forte');
		}
		if (fontDetector.test('frankruehl')) {
			fontList.push('frankruehl');
		}
		if (fontDetector.test('franklin gothic book')) {
			fontList.push('franklin gothic book');
		}
		if (fontDetector.test('franklin gothic demi')) {
			fontList.push('franklin gothic demi');
		}
		if (fontDetector.test('franklin gothic demi cond')) {
			fontList.push('franklin gothic demi cond');
		}
		if (fontDetector.test('franklin gothic heavy')) {
			fontList.push('franklin gothic heavy');
		}
		if (fontDetector.test('franklin gothic medium')) {
			fontList.push('franklin gothic medium');
		}
		if (fontDetector.test('franklin gothic medium cond')) {
			fontList.push('franklin gothic medium cond');
		}
		if (fontDetector.test('freemono')) {
			fontList.push('freemono');
		}
		if (fontDetector.test('freesans')) {
			fontList.push('freesans');
		}
		if (fontDetector.test('freeserif')) {
			fontList.push('freeserif');
		}
		if (fontDetector.test('freesiaupc')) {
			fontList.push('freesiaupc');
		}
		if (fontDetector.test('freestyle script')) {
			fontList.push('freestyle script');
		}
		if (fontDetector.test('french script mt')) {
			fontList.push('french script mt');
		}
		if (fontDetector.test('freshbot')) {
			fontList.push('freshbot');
		}
		if (fontDetector.test('frosty')) {
			fontList.push('frosty');
		}
		if (fontDetector.test('frutiger')) {
			fontList.push('frutiger');
		}
		if (fontDetector.test('frutiger linotype')) {
			fontList.push('frutiger linotype');
		}
		if (fontDetector.test('frutiger45-light')) {
			fontList.push('frutiger45-light');
		}
		if (fontDetector.test('frutiger46-light')) {
			fontList.push('frutiger46-light');
		}
		if (fontDetector.test('frutiger47-condensedlight')) {
			fontList.push('frutiger47-condensedlight');
		}
		if (fontDetector.test('frutiger55roman')) {
			fontList.push('frutiger55roman');
		}
		if (fontDetector.test('frutiger56')) {
			fontList.push('frutiger56');
		}
		if (fontDetector.test('frutiger57-condensed')) {
			fontList.push('frutiger57-condensed');
		}
		if (fontDetector.test('frutiger65')) {
			fontList.push('frutiger65');
		}
		if (fontDetector.test('frutiger66')) {
			fontList.push('frutiger66');
		}
		if (fontDetector.test('frutiger67-condensed')) {
			fontList.push('frutiger67-condensed');
		}
		if (fontDetector.test('frutiger75-black')) {
			fontList.push('frutiger75-black');
		}
		if (fontDetector.test('frutiger76-black')) {
			fontList.push('frutiger76-black');
		}
		if (fontDetector.test('frutiger77-condensedblack')) {
			fontList.push('frutiger77-condensedblack');
		}
		if (fontDetector.test('frutiger87-condensedextrablack')) {
			fontList.push('frutiger87-condensedextrablack');
		}
		if (fontDetector.test('frutiger95-ultrablack')) {
			fontList.push('frutiger95-ultrablack');
		}
		if (fontDetector.test('futura')) {
			fontList.push('futura');
		}
		if (fontDetector.test('futurablack bt')) {
			fontList.push('futurablack bt');
		}
		if (fontDetector.test('futuralight bt')) {
			fontList.push('futuralight bt');
		}
		if (fontDetector.test('gadget')) {
			fontList.push('gadget');
		}
		if (fontDetector.test('garamond')) {
			fontList.push('garamond');
		}
		if (fontDetector.test('gautami')) {
			fontList.push('gautami');
		}
		if (fontDetector.test('gaze')) {
			fontList.push('gaze');
		}
		if (fontDetector.test('geneva')) {
			fontList.push('geneva');
		}
		if (fontDetector.test('genuine')) {
			fontList.push('genuine');
		}
		if (fontDetector.test('georgia')) {
			fontList.push('georgia');
		}
		if (fontDetector.test('georgia ref')) {
			fontList.push('georgia ref');
		}
		if (fontDetector.test('geotype tt')) {
			fontList.push('geotype tt');
		}
		if (fontDetector.test('gigi')) {
			fontList.push('gigi');
		}
		if (fontDetector.test('gill sans')) {
			fontList.push('gill sans');
		}
		if (fontDetector.test('gill sans mt')) {
			fontList.push('gill sans mt');
		}
		if (fontDetector.test('gill sans mt condensed')) {
			fontList.push('gill sans mt condensed');
		}
		if (fontDetector.test('gill sans mt ext condensed bold')) {
			fontList.push('gill sans mt ext condensed bold');
		}
		if (fontDetector.test('gill sans ultra bold')) {
			fontList.push('gill sans ultra bold');
		}
		if (fontDetector.test('gill sans ultra bold condensed')) {
			fontList.push('gill sans ultra bold condensed');
		}
		if (fontDetector.test('gisha')) {
			fontList.push('gisha');
		}
		if (fontDetector.test('gloogun')) {
			fontList.push('gloogun');
		}
		if (fontDetector.test('gloucester mt extra condensed')) {
			fontList.push('gloucester mt extra condensed');
		}
		if (fontDetector.test('goudy old style')) {
			fontList.push('goudy old style');
		}
		if (fontDetector.test('goudy stout')) {
			fontList.push('goudy stout');
		}
		if (fontDetector.test('gulim')) {
			fontList.push('gulim');
		}
		if (fontDetector.test('gulimche')) {
			fontList.push('gulimche');
		}
		if (fontDetector.test('gungseo')) {
			fontList.push('gungseo');
		}
		if (fontDetector.test('gungsuh')) {
			fontList.push('gungsuh');
		}
		if (fontDetector.test('gungsuhche')) {
			fontList.push('gungsuhche');
		}
		if (fontDetector.test('haettenschweiler')) {
			fontList.push('haettenschweiler');
		}
		if (fontDetector.test('harlow solid italic')) {
			fontList.push('harlow solid italic');
		}
		if (fontDetector.test('harrington')) {
			fontList.push('harrington');
		}
		if (fontDetector.test('heiti sc')) {
			fontList.push('heiti sc');
		}
		if (fontDetector.test('heiti tc')) {
			fontList.push('heiti tc');
		}
		if (fontDetector.test('helterskelter')) {
			fontList.push('helterskelter');
		}
		if (fontDetector.test('helvetica')) {
			fontList.push('helvetica');
		}
		if (fontDetector.test('helvetica narrow')) {
			fontList.push('helvetica narrow');
		}
		if (fontDetector.test('helvetica neue')) {
			fontList.push('helvetica neue');
		}
		if (fontDetector.test('helveticaneue')) {
			fontList.push('helveticaneue');
		}
		if (fontDetector.test('herculanum')) {
			fontList.push('herculanum');
		}
		if (fontDetector.test('herman')) {
			fontList.push('herman');
		}
		if (fontDetector.test('high tower text')) {
			fontList.push('high tower text');
		}
		if (fontDetector.test('highlight let')) {
			fontList.push('highlight let');
		}
		if (fontDetector.test('hiragino kaku gothic pron')) {
			fontList.push('hiragino kaku gothic pron');
		}
		if (fontDetector.test('hiragino kaku gothic stdn')) {
			fontList.push('hiragino kaku gothic stdn');
		}
		if (fontDetector.test('hiragino maru gothic pron')) {
			fontList.push('hiragino maru gothic pron');
		}
		if (fontDetector.test('hiragino mincho pron')) {
			fontList.push('hiragino mincho pron');
		}
		if (fontDetector.test('hoefler text')) {
			fontList.push('hoefler text');
		}
		if (fontDetector.test('impact')) {
			fontList.push('impact');
		}
		if (fontDetector.test('imprint mt shadow')) {
			fontList.push('imprint mt shadow');
		}
		if (fontDetector.test('informal roman')) {
			fontList.push('informal roman');
		}
		if (fontDetector.test('interstate')) {
			fontList.push('interstate');
		}
		if (fontDetector.test('irisupc')) {
			fontList.push('irisupc');
		}
		if (fontDetector.test('isabella')) {
			fontList.push('isabella');
		}
		if (fontDetector.test('iskoola pota')) {
			fontList.push('iskoola pota');
		}
		if (fontDetector.test('itc avant garde gothic')) {
			fontList.push('itc avant garde gothic');
		}
		if (fontDetector.test('itc avant garde gothic demi')) {
			fontList.push('itc avant garde gothic demi');
		}
		if (fontDetector.test('itc bookman demi')) {
			fontList.push('itc bookman demi');
		}
		if (fontDetector.test('itc bookman light')) {
			fontList.push('itc bookman light');
		}
		if (fontDetector.test('itc century')) {
			fontList.push('itc century');
		}
		if (fontDetector.test('itc franklin gothic')) {
			fontList.push('itc franklin gothic');
		}
		if (fontDetector.test('itc zapf chancery')) {
			fontList.push('itc zapf chancery');
		}
		if (fontDetector.test('itc zapf dingbats')) {
			fontList.push('itc zapf dingbats');
		}
		if (fontDetector.test('jasmineupc')) {
			fontList.push('jasmineupc');
		}
		if (fontDetector.test('jenkins')) {
			fontList.push('jenkins');
		}
		if (fontDetector.test('jester')) {
			fontList.push('jester');
		}
		if (fontDetector.test('joan')) {
			fontList.push('joan');
		}
		if (fontDetector.test('john handy let')) {
			fontList.push('john handy let');
		}
		if (fontDetector.test('jokerman')) {
			fontList.push('jokerman');
		}
		if (fontDetector.test('jokerman let')) {
			fontList.push('jokerman let');
		}
		if (fontDetector.test('jokewood')) {
			fontList.push('jokewood');
		}
		if (fontDetector.test('juice itc')) {
			fontList.push('juice itc');
		}
		if (fontDetector.test('junkyard')) {
			fontList.push('junkyard');
		}
		if (fontDetector.test('kabel ult bt')) {
			fontList.push('kabel ult bt');
		}
		if (fontDetector.test('kailasa')) {
			fontList.push('kailasa');
		}
		if (fontDetector.test('kaiti')) {
			fontList.push('kaiti');
		}
		if (fontDetector.test('kalinga')) {
			fontList.push('kalinga');
		}
		if (fontDetector.test('kartika')) {
			fontList.push('kartika');
		}
		if (fontDetector.test('kaufmann')) {
			fontList.push('kaufmann');
		}
		if (fontDetector.test('kelt')) {
			fontList.push('kelt');
		}
		if (fontDetector.test('kids')) {
			fontList.push('kids');
		}
		if (fontDetector.test('kino mt')) {
			fontList.push('kino mt');
		}
		if (fontDetector.test('kodchiangupc')) {
			fontList.push('kodchiangupc');
		}
		if (fontDetector.test('kokonor')) {
			fontList.push('kokonor');
		}
		if (fontDetector.test('kristen itc')) {
			fontList.push('kristen itc');
		}
		if (fontDetector.test('kunstler script')) {
			fontList.push('kunstler script');
		}
		if (fontDetector.test('la bamba let')) {
			fontList.push('la bamba let');
		}
		if (fontDetector.test('latha')) {
			fontList.push('latha');
		}
		if (fontDetector.test('leelawadee')) {
			fontList.push('leelawadee');
		}
		if (fontDetector.test('letter gothic')) {
			fontList.push('letter gothic');
		}
		if (fontDetector.test('levenim mt')) {
			fontList.push('levenim mt');
		}
		if (fontDetector.test('liberation mono')) {
			fontList.push('liberation mono');
		}
		if (fontDetector.test('liberation sans')) {
			fontList.push('liberation sans');
		}
		if (fontDetector.test('liberation serif')) {
			fontList.push('liberation serif');
		}
		if (fontDetector.test('lilyupc')) {
			fontList.push('lilyupc');
		}
		if (fontDetector.test('linux libertine')) {
			fontList.push('linux libertine');
		}
		if (fontDetector.test('linux libertine c')) {
			fontList.push('linux libertine c');
		}
		if (fontDetector.test('lithograph')) {
			fontList.push('lithograph');
		}
		if (fontDetector.test('lucida')) {
			fontList.push('lucida');
		}
		if (fontDetector.test('lucida bright')) {
			fontList.push('lucida bright');
		}
		if (fontDetector.test('lucida calligraphy')) {
			fontList.push('lucida calligraphy');
		}
		if (fontDetector.test('lucida console')) {
			fontList.push('lucida console');
		}
		if (fontDetector.test('lucida fax')) {
			fontList.push('lucida fax');
		}
		if (fontDetector.test('lucida grande')) {
			fontList.push('lucida grande');
		}
		if (fontDetector.test('lucida handwriting')) {
			fontList.push('lucida handwriting');
		}
		if (fontDetector.test('lucida sans')) {
			fontList.push('lucida sans');
		}
		if (fontDetector.test('lucida sans typewriter')) {
			fontList.push('lucida sans typewriter');
		}
		if (fontDetector.test('lucida sans unicode')) {
			fontList.push('lucida sans unicode');
		}
		if (fontDetector.test('lucida typewriter')) {
			fontList.push('lucida typewriter');
		}
		if (fontDetector.test('lucidabright')) {
			fontList.push('lucidabright');
		}
		if (fontDetector.test('luxi mono')) {
			fontList.push('luxi mono');
		}
		if (fontDetector.test('luxi sans')) {
			fontList.push('luxi sans');
		}
		if (fontDetector.test('luxi serif')) {
			fontList.push('luxi serif');
		}
		if (fontDetector.test('magneto')) {
			fontList.push('magneto');
		}
		if (fontDetector.test('maiandra gd')) {
			fontList.push('maiandra gd');
		}
		if (fontDetector.test('malgun gothic')) {
			fontList.push('malgun gothic');
		}
		if (fontDetector.test('mangal')) {
			fontList.push('mangal');
		}
		if (fontDetector.test('map symbols')) {
			fontList.push('map symbols');
		}
		if (fontDetector.test('marigold')) {
			fontList.push('marigold');
		}
		if (fontDetector.test('marked fool')) {
			fontList.push('marked fool');
		}
		if (fontDetector.test('marker felt')) {
			fontList.push('marker felt');
		}
		if (fontDetector.test('marketpro')) {
			fontList.push('marketpro');
		}
		if (fontDetector.test('marlett')) {
			fontList.push('marlett');
		}
		if (fontDetector.test('matteroffact')) {
			fontList.push('matteroffact');
		}
		if (fontDetector.test('matisse itc')) {
			fontList.push('matisse itc');
		}
		if (fontDetector.test('matura mt script capitals')) {
			fontList.push('matura mt script capitals');
		}
		if (fontDetector.test('mead bold')) {
			fontList.push('mead bold');
		}
		if (fontDetector.test('meiryo')) {
			fontList.push('meiryo');
		}
		if (fontDetector.test('meiryo ui')) {
			fontList.push('meiryo ui');
		}
		if (fontDetector.test('mekanik let')) {
			fontList.push('mekanik let');
		}
		if (fontDetector.test('menlo')) {
			fontList.push('menlo');
		}
		if (fontDetector.test('mercurius script mt bold')) {
			fontList.push('mercurius script mt bold');
		}
		if (fontDetector.test('metal')) {
			fontList.push('metal');
		}
		if (fontDetector.test('mgopen canonica')) {
			fontList.push('mgopen canonica');
		}
		if (fontDetector.test('mgopen cosmetica')) {
			fontList.push('mgopen cosmetica');
		}
		if (fontDetector.test('mgopen modata')) {
			fontList.push('mgopen modata');
		}
		if (fontDetector.test('mgopen moderna')) {
			fontList.push('mgopen moderna');
		}
		if (fontDetector.test('microsoft himalaya')) {
			fontList.push('microsoft himalaya');
		}
		if (fontDetector.test('microsoft jhenghei')) {
			fontList.push('microsoft jhenghei');
		}
		if (fontDetector.test('microsoft sans serif')) {
			fontList.push('microsoft sans serif');
		}
		if (fontDetector.test('microsoft uighur')) {
			fontList.push('microsoft uighur');
		}
		if (fontDetector.test('microsoft yahei')) {
			fontList.push('microsoft yahei');
		}
		if (fontDetector.test('microsoft yi baiti')) {
			fontList.push('microsoft yi baiti');
		}
		if (fontDetector.test('milano let')) {
			fontList.push('milano let');
		}
		if (fontDetector.test('mingliu')) {
			fontList.push('mingliu');
		}
		if (fontDetector.test('mingliu-extb')) {
			fontList.push('mingliu-extb');
		}
		if (fontDetector.test('mingliu_hkscs')) {
			fontList.push('mingliu_hkscs');
		}
		if (fontDetector.test('mingliu_hkscs-extb')) {
			fontList.push('mingliu_hkscs-extb');
		}
		if (fontDetector.test('minion std')) {
			fontList.push('minion std');
		}
		if (fontDetector.test('minion web')) {
			fontList.push('minion web');
		}
		if (fontDetector.test('miriam')) {
			fontList.push('miriam');
		}
		if (fontDetector.test('miriam fixed')) {
			fontList.push('miriam fixed');
		}
		if (fontDetector.test('misterearl bt')) {
			fontList.push('misterearl bt');
		}
		if (fontDetector.test('mistral')) {
			fontList.push('mistral');
		}
		if (fontDetector.test('monaco')) {
			fontList.push('monaco');
		}
		if (fontDetector.test('mongolian baiti')) {
			fontList.push('mongolian baiti');
		}
		if (fontDetector.test('monospace')) {
			fontList.push('monospace');
		}
		if (fontDetector.test('monotype')) {
			fontList.push('monotype');
		}
		if (fontDetector.test('monotype corsiva')) {
			fontList.push('monotype corsiva');
		}
		if (fontDetector.test('monotype sorts')) {
			fontList.push('monotype sorts');
		}
		if (fontDetector.test('moolboran')) {
			fontList.push('moolboran');
		}
		if (fontDetector.test('ms gothic')) {
			fontList.push('ms gothic');
		}
		if (fontDetector.test('ms linedraw')) {
			fontList.push('ms linedraw');
		}
		if (fontDetector.test('ms mincho')) {
			fontList.push('ms mincho');
		}
		if (fontDetector.test('ms pgothic')) {
			fontList.push('ms pgothic');
		}
		if (fontDetector.test('ms pmincho')) {
			fontList.push('ms pmincho');
		}
		if (fontDetector.test('ms reference sans serif')) {
			fontList.push('ms reference sans serif');
		}
		if (fontDetector.test('ms reference serif')) {
			fontList.push('ms reference serif');
		}
		if (fontDetector.test('ms sans serif')) {
			fontList.push('ms sans serif');
		}
		if (fontDetector.test('ms serif')) {
			fontList.push('ms serif');
		}
		if (fontDetector.test('ms ui gothic')) {
			fontList.push('ms ui gothic');
		}
		if (fontDetector.test('mv boli')) {
			fontList.push('mv boli');
		}
		if (fontDetector.test('narkisim')) {
			fontList.push('narkisim');
		}
		if (fontDetector.test('new century schoolbook')) {
			fontList.push('new century schoolbook');
		}
		if (fontDetector.test('new york')) {
			fontList.push('new york');
		}
		if (fontDetector.test('news gothic mt')) {
			fontList.push('news gothic mt');
		}
		if (fontDetector.test('niagara engraved')) {
			fontList.push('niagara engraved');
		}
		if (fontDetector.test('niagara solid')) {
			fontList.push('niagara solid');
		}
		if (fontDetector.test('nice')) {
			fontList.push('nice');
		}
		if (fontDetector.test('nimbus mono l')) {
			fontList.push('nimbus mono l');
		}
		if (fontDetector.test('nimbus roman no9 l')) {
			fontList.push('nimbus roman no9 l');
		}
		if (fontDetector.test('nimbus sans l')) {
			fontList.push('nimbus sans l');
		}
		if (fontDetector.test('nimbus sans l condensed')) {
			fontList.push('nimbus sans l condensed');
		}
		if (fontDetector.test('nsimsun')) {
			fontList.push('nsimsun');
		}
		if (fontDetector.test('nyala')) {
			fontList.push('nyala');
		}
		if (fontDetector.test('ocr a extended')) {
			fontList.push('ocr a extended');
		}
		if (fontDetector.test('ocrb')) {
			fontList.push('ocrb');
		}
		if (fontDetector.test('odessa let')) {
			fontList.push('odessa let');
		}
		if (fontDetector.test('old english text mt')) {
			fontList.push('old english text mt');
		}
		if (fontDetector.test('olddreadfulno7 bt')) {
			fontList.push('olddreadfulno7 bt');
		}
		if (fontDetector.test('one stroke script let')) {
			fontList.push('one stroke script let');
		}
		if (fontDetector.test('onyx')) {
			fontList.push('onyx');
		}
		if (fontDetector.test('opensymbol')) {
			fontList.push('opensymbol');
		}
		if (fontDetector.test('optima')) {
			fontList.push('optima');
		}
		if (fontDetector.test('orange let')) {
			fontList.push('orange let');
		}
		if (fontDetector.test('palace script mt')) {
			fontList.push('palace script mt');
		}
		if (fontDetector.test('palatino')) {
			fontList.push('palatino');
		}
		if (fontDetector.test('palatino linotype')) {
			fontList.push('palatino linotype');
		}
		if (fontDetector.test('papyrus')) {
			fontList.push('papyrus');
		}
		if (fontDetector.test('parkavenue bt')) {
			fontList.push('parkavenue bt');
		}
		if (fontDetector.test('penguin attack')) {
			fontList.push('penguin attack');
		}
		if (fontDetector.test('pepita mt')) {
			fontList.push('pepita mt');
		}
		if (fontDetector.test('perpetua')) {
			fontList.push('perpetua');
		}
		if (fontDetector.test('perpetua titling mt')) {
			fontList.push('perpetua titling mt');
		}
		if (fontDetector.test('placard condensed')) {
			fontList.push('placard condensed');
		}
		if (fontDetector.test('plantagenet cherokee')) {
			fontList.push('plantagenet cherokee');
		}
		if (fontDetector.test('playbill')) {
			fontList.push('playbill');
		}
		if (fontDetector.test('pmingliu')) {
			fontList.push('pmingliu');
		}
		if (fontDetector.test('pmingliu-extb')) {
			fontList.push('pmingliu-extb');
		}
		if (fontDetector.test('porcelain')) {
			fontList.push('porcelain');
		}
		if (fontDetector.test('poornut')) {
			fontList.push('poornut');
		}
		if (fontDetector.test('pristina')) {
			fontList.push('pristina');
		}
		if (fontDetector.test('pump demi bold let')) {
			fontList.push('pump demi bold let');
		}
		if (fontDetector.test('puppylike')) {
			fontList.push('puppylike');
		}
		if (fontDetector.test('pussycat')) {
			fontList.push('pussycat');
		}
		if (fontDetector.test('quixley let')) {
			fontList.push('quixley let');
		}
		if (fontDetector.test('raavi')) {
			fontList.push('raavi');
		}
		if (fontDetector.test('rage italic')) {
			fontList.push('rage italic');
		}
		if (fontDetector.test('rage italic let')) {
			fontList.push('rage italic let');
		}
		if (fontDetector.test('ravie')) {
			fontList.push('ravie');
		}
		if (fontDetector.test('rockwell')) {
			fontList.push('rockwell');
		}
		if (fontDetector.test('rockwell condensed')) {
			fontList.push('rockwell condensed');
		}
		if (fontDetector.test('rockwell extra bold')) {
			fontList.push('rockwell extra bold');
		}
		if (fontDetector.test('rod')) {
			fontList.push('rod');
		}
		if (fontDetector.test('roland')) {
			fontList.push('roland');
		}
		if (fontDetector.test('rotissemisans')) {
			fontList.push('rotissemisans');
		}
		if (fontDetector.test('ruach let')) {
			fontList.push('ruach let');
		}
		if (fontDetector.test('runic mt condensed')) {
			fontList.push('runic mt condensed');
		}
		if (fontDetector.test('sand')) {
			fontList.push('sand');
		}
		if (fontDetector.test('sans-serif')) {
			fontList.push('sans-serif');
		}
		if (fontDetector.test('script mt bold')) {
			fontList.push('script mt bold');
		}
		if (fontDetector.test('scripts')) {
			fontList.push('scripts');
		}
		if (fontDetector.test('scruff let')) {
			fontList.push('scruff let');
		}
		if (fontDetector.test('segoe print')) {
			fontList.push('segoe print');
		}
		if (fontDetector.test('segoe script')) {
			fontList.push('segoe script');
		}
		if (fontDetector.test('segoe ui')) {
			fontList.push('segoe ui');
		}
		if (fontDetector.test('serif')) {
			fontList.push('serif');
		}
		if (fontDetector.test('shelley')) {
			fontList.push('shelley');
		}
		if (fontDetector.test('short hand')) {
			fontList.push('short hand');
		}
		if (fontDetector.test('showcard gothic')) {
			fontList.push('showcard gothic');
		}
		if (fontDetector.test('shruti')) {
			fontList.push('shruti');
		}
		if (fontDetector.test('signs normal')) {
			fontList.push('signs normal');
		}
		if (fontDetector.test('simhei')) {
			fontList.push('simhei');
		}
		if (fontDetector.test('simplex')) {
			fontList.push('simplex');
		}
		if (fontDetector.test('simplified arabic')) {
			fontList.push('simplified arabic');
		}
		if (fontDetector.test('simplified arabic fixed')) {
			fontList.push('simplified arabic fixed');
		}
		if (fontDetector.test('simpson')) {
			fontList.push('simpson');
		}
		if (fontDetector.test('simsun')) {
			fontList.push('simsun');
		}
		if (fontDetector.test('simsun-extb')) {
			fontList.push('simsun-extb');
		}
		if (fontDetector.test('skia')) {
			fontList.push('skia');
		}
		if (fontDetector.test('snap itc')) {
			fontList.push('snap itc');
		}
		if (fontDetector.test('smudger let')) {
			fontList.push('smudger let');
		}
		if (fontDetector.test('square721 bt')) {
			fontList.push('square721 bt');
		}
		if (fontDetector.test('staccato222 bt')) {
			fontList.push('staccato222 bt');
		}
		if (fontDetector.test('stencil')) {
			fontList.push('stencil');
		}
		if (fontDetector.test('stylus bt')) {
			fontList.push('stylus bt');
		}
		if (fontDetector.test('superfrench')) {
			fontList.push('superfrench');
		}
		if (fontDetector.test('surfer')) {
			fontList.push('surfer');
		}
		if (fontDetector.test('swis721 bt')) {
			fontList.push('swis721 bt');
		}
		if (fontDetector.test('swis721 blkoul bt')) {
			fontList.push('swis721 blkoul bt');
		}
		if (fontDetector.test('sylfaen')) {
			fontList.push('sylfaen');
		}
		if (fontDetector.test('symap')) {
			fontList.push('symap');
		}
		if (fontDetector.test('symbol')) {
			fontList.push('symbol');
		}
		if (fontDetector.test('symbolps')) {
			fontList.push('symbolps');
		}
		if (fontDetector.test('tahoma')) {
			fontList.push('tahoma');
		}
		if (fontDetector.test('technic')) {
			fontList.push('technic');
		}
		if (fontDetector.test('techno')) {
			fontList.push('techno');
		}
		if (fontDetector.test('tempus sans itc')) {
			fontList.push('tempus sans itc');
		}
		if (fontDetector.test('terk')) {
			fontList.push('terk');
		}
		if (fontDetector.test('terminal')) {
			fontList.push('terminal');
		}
		if (fontDetector.test('textile')) {
			fontList.push('textile');
		}
		if (fontDetector.test('times')) {
			fontList.push('times');
		} {
			fontList.push('times new roman');
		}
		if (fontDetector.test('times new roman baltic')) {
			fontList.push('times new roman baltic');
		}
		if (fontDetector.test('times new roman ce')) {
			fontList.push('times new roman ce');
		}
		if (fontDetector.test('times new roman cyr')) {
			fontList.push('times new roman cyr');
		}
		if (fontDetector.test('times new roman greek')) {
			fontList.push('times new roman greek');
		}
		if (fontDetector.test('times new roman tur')) {
			fontList.push('times new roman tur');
		}
		if (fontDetector.test('tiranti solid let')) {
			fontList.push('tiranti solid let');
		}
		if (fontDetector.test('tradegothic')) {
			fontList.push('tradegothic');
		}
		if (fontDetector.test('traditional arabic')) {
			fontList.push('traditional arabic');
		}
		if (fontDetector.test('trebuchet ms')) {
			fontList.push('trebuchet ms');
		}
		if (fontDetector.test('trendy')) {
			fontList.push('trendy');
		}
		if (fontDetector.test('tunga')) {
			fontList.push('tunga');
		}
		if (fontDetector.test('tw cen mt')) {
			fontList.push('tw cen mt');
		}
		if (fontDetector.test('tw cen mt condensed')) {
			fontList.push('tw cen mt condensed');
		}
		if (fontDetector.test('tw cen mt condensed extra bold')) {
			fontList.push('tw cen mt condensed extra bold');
		}
		if (fontDetector.test('univers')) {
			fontList.push('univers');
		}
		if (fontDetector.test('univers condensed')) {
			fontList.push('univers condensed');
		}
		if (fontDetector.test('university roman let')) {
			fontList.push('university roman let');
		}
		if (fontDetector.test('urw antiqua t')) {
			fontList.push('urw antiqua t');
		}
		if (fontDetector.test('urw bookman l')) {
			fontList.push('urw bookman l');
		}
		if (fontDetector.test('urw chancery l')) {
			fontList.push('urw chancery l');
		}
		if (fontDetector.test('urw gothic l')) {
			fontList.push('urw gothic l');
		}
		if (fontDetector.test('urw grotesk t')) {
			fontList.push('urw grotesk t');
		}
		if (fontDetector.test('urw palladio l')) {
			fontList.push('urw palladio l');
		}
		if (fontDetector.test('utopia')) {
			fontList.push('utopia');
		}
		if (fontDetector.test('vera sans')) {
			fontList.push('vera sans');
		}
		if (fontDetector.test('vera sans mono')) {
			fontList.push('vera sans mono');
		}
		if (fontDetector.test('vera serif')) {
			fontList.push('vera serif');
		}
		if (fontDetector.test('verdana')) {
			fontList.push('verdana');
		}
		if (fontDetector.test('verdana ref')) {
			fontList.push('verdana ref');
		}
		if (fontDetector.test('victorian let')) {
			fontList.push('victorian let');
		}
		if (fontDetector.test('viner hand itc')) {
			fontList.push('viner hand itc');
		}
		if (fontDetector.test('vineta bt')) {
			fontList.push('vineta bt');
		}
		if (fontDetector.test('vivaldi')) {
			fontList.push('vivaldi');
		}
		if (fontDetector.test('vivian')) {
			fontList.push('vivian');
		}
		if (fontDetector.test('vladimir script')) {
			fontList.push('vladimir script');
		}
		if (fontDetector.test('vrinda')) {
			fontList.push('vrinda');
		}
		if (fontDetector.test('webdings')) {
			fontList.push('webdings');
		}
		if (fontDetector.test('weltron urban')) {
			fontList.push('weltron urban');
		}
		if (fontDetector.test('western')) {
			fontList.push('western');
		}
		if (fontDetector.test('westminster')) {
			fontList.push('westminster');
		}
		if (fontDetector.test('westwood let')) {
			fontList.push('westwood let');
		}
		if (fontDetector.test('wide latin')) {
			fontList.push('wide latin');
		}
		if (fontDetector.test('wingdings')) {
			fontList.push('wingdings');
		}
		if (fontDetector.test('zapf chancery')) {
			fontList.push('zapf chancery');
		}
		if (fontDetector.test('zapfellipt bt')) {
			fontList.push('zapfellipt bt');
		}
		if (fontDetector.test('zapfino')) {
			fontList.push('zapfino');
		}
		return fontList;
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
		if (items.length != undefined) {
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				fn(item, i);
			}
		} else if (typeof items == "object") {
			var keys = Object.keys(items);
			forEach(keys, function(key) {
				fn(key, items[key]);
			});
		}
	}

	// Utility method to create a hash string from values of a map
	function hashValues(map) {
		var vals = [];
		for (var o in map) {
			vals.push(map[o]);
		}
		var valString = vals.join('###');
		var hash = CryptoJS.SHA256(valString).toString(CryptoJS.enc.Base64);
		return hash;
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

	// Utility methods for checking if sessionStorage and localStorage are available
	// https://bugzilla.mozilla.org/show_bug.cgi?id=781447
	function hasLocalStorage() {
		try {
			return !!window.localStorage;
		} catch (e) {
			return false;
		}
	}

	function hasSessionStorage() {
		try {
			return !!window.sessionStorage;
		} catch (e) {
			return false;
		}
	}

	// Utility method to see if canvas is supported
	function isCanvasSupported() {
		var elem = document.createElement('canvas');
		return !!(elem.getContext && elem.getContext('2d'));
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