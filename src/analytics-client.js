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

	this.id = "analytics-client_" + generateUUID();
	window[this.id] = this;

	this.config = {
		kinesis: null,
		endpoint: "http://localhost:8999/analytics",
		fetchLocation: true,
		staticData: {},
		data: {},
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

	// Merge options with config
	this.config = merge(this.config, options);

	function init(self) {
		self.userId = getUserId();
		self.sessionId = getSessionId();
		var staticData = self.config.staticData;
		staticData.userId = self.userId;
		staticData.sessionId = self.sessionId;
		staticData.domain = self.config.window.location.hostname;
		if (self.config.fetchLocation) {
			getLocationInfo();
		} else {
			var data = self.config.data;
			self.updateSession(data, {
				onSuccess: self.config.onReady
			});
		}
		self.config.window.addEventListener("hashchange", function() {
			self.updateSession();
		});
	}

	this.updateSession = function(data, options) {
		var request = {
			onSuccess: function() {},
			onError: function() {}
		}
		var requestId = generateUUID();
		// Merge options with request
		request = merge(request, options);
		request.data = this.config.staticData;
		request.data = merge(request.data, getAllInfo());
		request.data = merge(request.data, data);
		request.data.requestId = requestId;
		this.config.submissionHandler.submit(request);
	};

	function getAllInfo() {
		var data = {};
		data.device = getDeviceInfo();
		data.browser = getBrowserInfo();
		data.page = getPageInfo();
		data.connection = getConnectionInfo();
		data.locale = getLocaleInfo();
		data.scripts = getScripts();
		data.frames = getFrames();
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
			language: $this.config.window.navigator.language
		}
		return browser;
	}

	function getPageInfo() {
		var page = {
			location: $this.config.window.location,
			performance: $this.config.window.performance.timing,
			title: $this.config.window.document.title
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
			el.src = "https://ajaxhttpheaders1.appspot.com/?callback=window['" + $this.id + "'].processLocationInfo";
		}, 0);
	}

	this.processLocationInfo = function(data) {
		this.config.staticData.location = {
			language: data['Accept-Language'],
			city: data['X-Appengine-City'],
			country: data['X-Appengine-Country'],
			region: data['X-Appengine-Region'],
			coords: data['X-Appengine-Citylatlong']
		}
		this.updateSession(this.config.data, {
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

	var $this = this;
	console.log(this.config.window.performance.timing);
	if (!this.config.window.performance.timing || this.config.window.performance.timing.loadEventEnd > 0) {
		console.log("init");
		init($this);
	} else {
		console.log("wait");
		this.config.window.addEventListener("load", function() {
			setTimeout(function() {
				init($this);
			}, 0);
		}, false);
	}

}