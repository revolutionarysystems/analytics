var AnalyticsClient = function(options) {

	this.config = {
		kinesis: null,
		endpoint: "http://localhost:8999/analytics",
		common: {},
		data: {},
		onReady: function() {},
		onSuccess: function() {},
		onError: function() {}
	}

	// Merge options with config
	this.config = merge(this.config, options);

	function init(self) {
		self.userId = getUserId();
		self.sessionId = getSessionId();
		var common = self.config.common;
		common.userId = self.userId;
		common.sessionId = self.sessionId;
		common.domain = window.location.hostname;
		var data = self.config.data;
		self.updateSession(data, {
			onSuccess: self.config.onReady
		});
		window.addEventListener("hashchange", function(){self.updateSession();});
	}

	function getAllInfo() {
		var data = {};
		data.device = getDeviceInfo();
		data.browser = getBrowserInfo();
		data.page = getPageInfo();
		data.connection = getConnectionInfo();
		data.locale = getLocaleInfo();
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
			platform: window.navigator.platform,
			screen: flatten(window.screen),
			pixelRatio: window.devicePixelRatio
		};
		return device;
	}

	function getBrowserInfo() {
		var browser = {
			vendor: window.navigator.vendor,
			vendorSub: window.navigator.vendorSub,
			product: window.navigator.product,
			productSub: window.navigator.productSub,
			userAgent: window.navigator.userAgent,
			mimeTypes: window.navigator.mimeTypes.length,
			plugins: window.navigator.plugins.length,
			language: window.navigator.language
		}
		return browser;
	}

	function getPageInfo() {
		var page = {
			location: window.location,
			performance: performance.timing,
			title: document.title
		}
		return page;
	}

	function getLocaleInfo() {
		var lang = ((
			navigator.language ||
			navigator.browserLanguage ||
			navigator.systemLanguage ||
			navigator.userLanguage
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

	function getConnectionInfo() {
		var navConnection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {
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

	this.updateSession = function(data, options) {
		var request = {
			onSuccess: function() {},
			onError: function() {}
		}
		// Merge options with request
		request = merge(request, options);
		request.data = this.config.common;
		request.data = merge(request.data, getAllInfo());
		request.data = merge(request.data, data);
		if (this.config.kinesis != null) {
			this.config.kinesis.put(JSON.stringify(request.data), {
				partitionKey: request.data.key,
				onSuccess: request.onSuccess,
				onError: request.onError
			});
		} else {
			var params = "data=" + JSON.stringify(request.data);
			if (request.data.key !== null) {
				params = params + "&key=" + request.data.key;
			}
			Ajax.post(this.config.endpoint + "/updateSession", params, {
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

	var $this = this;
	window.addEventListener("load", function() {
		setTimeout(function() {
			init($this);
		}, 0);
	}, false);

}