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
			language: targetWindow.navigator.language,
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
			userAgent: userAgent
		}

		var dfp = hashValues(dfpData);

		// Generate fingerprint based on browser information
		var bfpData = {
			userAgent: targetWindow.navigator.userAgent,
			platform: targetWindow.navigator.platform,
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
		return CryptoJS.SHA256(valString).toString(CryptoJS.enc.Base64);
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