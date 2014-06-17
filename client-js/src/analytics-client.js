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
		self.config.common.userId = self.userId;
		self.config.common.sessionId = self.sessionId;
		self.config.common.domain = window.location.hostname;
		var session = new SessionProvider({
			location_cookie: null,
			session_cookie: null,
			gapi_location: false
		}).getSession();
		var data = self.config.data;
		data.device = session.device;
		data.locale = session.locale;
		data.device.browser = session.browser;
		self.updateSession(data, {
			onSuccess: self.config.onReady
		});
	}

	this.updateSession = function(data, options) {
		var request = {
			onSuccess: function() {},
			onError: function() {}
		}
		// Merge options with config
		if (options != null) {
			for (option in options) {
				request[option] = options[option]
			}
		}
		request.data = this.config.common;
		if(data!=null){
			request.data = data;
			for(item in this.config.common){
				request.data[item] = this.config.common[item];
			}
		}
		var title = document.title;
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