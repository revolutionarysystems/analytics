var AnalyticsClient = function(options) {

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