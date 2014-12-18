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

	var id = "RevsysAnalyticsClientInstance";
	window[id] = this;

	var serverTime;
	var serverTimeOffset;

	this.config = {
		kinesis: null,
		endpoint: "http://localhost:8999/analytics",
		updateSessionOnHashChange: true,
		updateSessionOnResize: true,
		staticData: {},
		data: {},
		elementSelector: "data-analytics",
		clickSelector: "data-analytics-click",
		window: window,
		submissionHandler: new function() {
			this.submit = function(request) {
				var params = "data=" + JSON.stringify(request.data);
				Ajax.post(this.config.endpoint + "/updateSession", params, {
					onSuccess: request.onSuccess,
					onError: request.onError
				});
			}
		},
		onReady: function() {},
		onSuccess: function() {},
		onError: function() {}
	}

	if (!this.config.window.console || !this.config.window.console.error) {
		this.console = {};
		this.console.error = function(e) {};
	} else {
		this.console = this.config.window.console
	}

	// Merge options with config
	this.config = merge(this.config, options);

	var resizeTimeoutId = false;

	function init(self) {
		self.userId = getUserId();
		self.sessionId = getSessionId();
		var staticData = self.config.staticData;
		staticData.userId = self.userId;
		staticData.sessionId = self.sessionId;
		staticData.domain = self.config.window.location.hostname;
		if (self.config.updateSessionOnHashChange === true) {
			addEventListener(self.config.window, "hashchange", function() {
				self.updateSession({
						event: {
							type: "hashchange",
						}
					});
			});
		};
		if (self.config.updateSessionOnResize === true) {
			addEventListener(self.config.window, "resize", function() {
				if (resizeTimeoutId !== false) {
					self.config.window.clearTimeout(resizeTimeoutId);
				}
				resizeTimeoutId = self.config.window.setTimeout(function() {
					self.updateSession();
				}, 1000);
			});
		};
		if ($this.config.clickSelector && $this.config.window.document.querySelectorAll) {
			var elements = $this.config.window.document.querySelectorAll("[" + $this.config.clickSelector + "]");
			for (var i = 0; i < elements.length; i++) {
				var element = elements.item(i);
				var eventName = element.getAttribute($this.config.clickSelector);
				addEventListener(element, "click", function(e) {
					$this.updateSession({
						event: {
							type: "click",
							target: eventName
						}
					});
				});
			}
		}
		getLocationInfo();
	}

	this.updateSession = function(data, options) {
		var request = {
			onSuccess: function() {},
			onError: function() {}
		}
		var requestId = generateUUID();
		// Merge options with request
		request = merge(request, options);
		request.data = {}
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

	function getAllInfo() {
		var data = {};
		try {
			data.device = getDeviceInfo();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.browser = getBrowserInfo();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.page = getPageInfo();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.connection = getConnectionInfo();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.locale = getLocaleInfo();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.scripts = getScripts();
		} catch (e) {
			$this.console.error(e);
		}
		try {
			data.frames = getFrames();
		} catch (e) {
			$this.console.error(e);
		}
		if ($this.config.window.document.querySelectorAll) {
			if ($this.config.elementSelector) {
				var elements = $this.config.window.document.querySelectorAll("[" + $this.config.elementSelector + "]");
				for (var i = 0; i < elements.length; i++) {
					var element = elements.item(i);
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
					data[propertyName] = propertyValue;
				}
			}
		}
		return data;
	}

	function getUserId() {
		var userId = localStorage.userId;
		if (userId == undefined) {
			userId = generateUUID();
			localStorage.userId = userId;
		}
		return userId;
	}

	function getSessionId() {
		var sessionId = sessionStorage.sessionId;
		if (sessionId == undefined) {
			sessionId = generateUUID();
			sessionStorage.sessionId = sessionId;
		}
		return sessionId;
	}

	function getDeviceInfo() {
		var device = {
			platform: $this.config.window.navigator.platform,
			screen: flatten($this.config.window.screen),
			pixelRatio: $this.config.window.devicePixelRatio
		};
		return device;
	}

	function getBrowserInfo() {
		var browser = {
			vendor: $this.config.window.navigator.vendor,
			vendorSub: $this.config.window.navigator.vendorSub,
			product: $this.config.window.navigator.product,
			productSub: $this.config.window.navigator.productSub,
			userAgent: $this.config.window.navigator.userAgent,
			mimeTypes: $this.config.window.navigator.mimeTypes.length,
			plugins: $this.config.window.navigator.plugins.length,
			language: $this.config.window.navigator.language,
			screen: {
				outerWidth: $this.config.window.outerWidth,
				outerHeight: $this.config.window.outerHeight,
				innerWidth: $this.config.window.innerWidth,
				innerHeight: $this.config.window.innerHeight,
				viewportWidth: $this.config.window.document.documentElement.clientWidth,
				viewportHeight: $this.config.window.document.documentElement.clientHeight
			}
		}
		return browser;
	}

	function getPageInfo() {
		var page = {
			location: $this.config.window.location,
			title: $this.config.window.document.title,
			referrer: $this.config.window.document.referrer,
			screen: {
				width: $this.config.window.document.documentElement.offsetWidth,
				height: $this.config.window.document.documentElement.offsetHeight,
				xOffset: $this.config.window.pageXOffset,
				yOffset: $this.config.window.pageYOffset
			}
		}
		if ($this.config.window.performance) {
			page.performance = $this.config.window.performance.timing;
		}
		return page;
	}

	function getLocaleInfo() {
		var lang = ((
			$this.config.window.navigator.language ||
			$this.config.window.navigator.browserLanguage ||
			$this.config.window.navigator.systemLanguage ||
			$this.config.window.navigator.userLanguage
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

	function getScripts() {
		var result = [];
		var scripts = $this.config.window.document.scripts;
		for (var i in scripts) {
			var script = scripts[i];
			if (script.src) {
				result.push({
					type: script.type,
					src: script.src,
					async: script.async,
					defer: script.defer
				});
			}
		}
		return result;
	}

	function getFrames() {
		var result = [];
		var frames = $this.config.window.document.getElementsByTagName("iframe");
		for (var i in frames) {
			var frame = frames[i];
			if (frame.src) {
				result.push({
					src: frame.src
				});
			}
		}
		return result;
	}

	function getLocationInfo() {
		var el = document.createElement('script');
		el.async = true;
		document.getElementsByTagName('script')[0].appendChild(el);
		setTimeout(function() { // set source after insertion - needed for older versions of IE
			el.src = "https://requestmirror.appspot.com/?callback=window." + id + ".processLocationInfo";
		}, 0);
	}

	this.processLocationInfo = function(data) {
		this.config.staticData.location = {
			language: data.headers['Accept-Language'],
			city: data.headers['X-AppEngine-City'],
			country: data.headers['X-AppEngine-Country'],
			region: data.headers['X-AppEngine-Region'],
			coords: data.headers['X-AppEngine-CityLatLong'],
		}
		serverTime = data.timestamp;
		serverTimeOffset = new Date().getTime() - serverTime;
		this.config.staticData.ipAddress = data.ipAddress;
		var initData = copy(this.config.data);
		initData.event = {
			"type": "load"
		};
		this.updateSession(initData, {
			onSuccess: this.config.onReady
		});
	}

	function getConnectionInfo() {
		var navConnection = $this.config.window.navigator.connection || $this.config.window.navigator.mozConnection || $this.config.window.navigator.webkitConnection || {
			bandwidth: "not supported",
			metered: "not supported"
		};
		return flatten(navConnection);
	}

	function copy(obj){
		return flatten(obj);
	}

	function flatten(obj) {
		var result = {};
		for (var key in obj) {
			value = obj[key];
			result[key] = value;
		}
		return result;
	}

	function merge(obj1, obj2) {
		if (obj2 != null) {
			for (var key in obj2) {
				obj1[key] = obj2[key];
			}
		}
		return obj1;
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

	function addEventListener(object, event, listener) {
		if (object.addEventListener) {
			object.addEventListener(event, listener);
		} else if (object.attachEvent) {
			object.attachEvent(event, listener);
		}
	}

	var $this = this;
	if (!this.config.window.performance || !this.config.window.performance.timing || this.config.window.performance.timing.loadEventStart > 0) {
		init($this);
	} else {
		addEventListener(this.config.window, "load", function() {
			setTimeout(function() {
				init($this);
			}, 0);
		}, false);
	}

}