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
	if (options != null) {
		for (var option in options) {
			this.config[option] = options[option]
		}
	}

	function init(self) {
		self.userId = getUserId();
		self.sessionId = getSessionId();
		var common = self.config.common;
		common.userId = self.userId;
		common.sessionId = self.sessionId;
		common.domain = window.location.hostname;
		var data = self.config.data;
		data.device = getDeviceInfo();
		data.browser = getBrowserInfo();
		data.page = getPageInfo();
		data.connection = getConnectionInfo();
		data.locale = getLocaleInfo();
		self.updateSession(data, {
			onSuccess: self.config.onReady
		});
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
	    for(var key in obj) {
	    	value = obj[key];
	        result[key] = value;
	    }
	    return result;
	}

	this.updateSession = function(data, options) {
		var request = {
				onSuccess: function() {},
				onError: function() {}
			}
			// Merge options with config
		if (options != null) {
			for (var option in options) {
				request[option] = options[option]
			}
		}
		request.data = this.config.common;
		if (data != null) {
			request.data = data;
			for (var item in this.config.common) {
				request.data[item] = this.config.common[item];
			}
		}
		if (this.config.kinesis != null) {
			this.config.kinesis.put(JSON.stringify(request.data), {
				partitionKey: request.data.key,
				onSuccess: request.onSuccess,
				onError: request.onError
			});
		} else {
			var params = "data=" + JSON.stringify(request.data);
			if(request.data.key !== null){
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