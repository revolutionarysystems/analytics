describe("AnalyticsClient", function() {
	describe("#updateSession()", function() {
		it("should submit all the data about the current session", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				includeServerData: true,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
						expect(data.fingerprints.preferences).not.toBeUndefined();
						expect(data.fingerprints.device).not.toBeUndefined();
						expect(data.fingerprints.browser).not.toBeUndefined();
						expect(data.fingerprints.connection).not.toBeUndefined();
						expect(data.fingerprints.breakdown).toBeUndefined();
						if (data.browser.userAgent.indexOf("MSIE 9.0") == -1) { // mediaMatch only supported in IE 10+
							expect(data.media.type).toBe("screen");
						}
						expect(data.page.title).toBe("Jasmine Spec Runner");
						expect(data.page.performance.fetchStart).toBeGreaterThan(0);
						expect(data.location.city).not.toBeUndefined();
						expect(data.location.coords).not.toBeUndefined();
						expect(data.event.type).toBe("load");
						expect(data.network).toBeUndefined();
						expect(data.ipAddress.remote).not.toBeUndefined();
						var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
						if (RTCPeerConnection) {
							expect(data.ipAddress.local.length).toBeGreaterThan(0);
						} else {
							expect(data.ipAddress.local.length).toBe(0);
						}
						done();
					};
				}
			});
		});
		it("should send network data if requested", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				includeServerData: true,
				includeNetworkData: true,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						expect(data.network.name).not.toBeUndefined();
						expect(data.network.description).not.toBeUndefined();
						done();
					};
				}
			});
		});
		it("should send requested headers if available", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				includeServerData: true,
				includeHeaders: ["User-Agent"],
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						expect(data.headers['User-Agent']).not.toBeUndefined();
						done();
					};
				}
			});
		});
		it("should send fingerprint breakdown if requested", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				includeServerData: true,
				persistSessionState: false,
				includeFingerprintBreakdown: true,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
						expect(data.fingerprints.preferences).not.toBeUndefined();
						expect(data.fingerprints.breakdown).not.toBeUndefined();
						done();
					};
				}
			});
		});
		it("should return a request id", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				submissionHandler: new function() {
					this.submit = function(request) {

					};
				}
			});
			var requestId = analyticsClient.updateSession({});
			expect(requestId).not.toBeUndefined();
			done();
		});
		it("should pick up data from indicated elements", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				elementSelector: "data-analytics-test",
				submissionHandler: new function() {
					this.submit = function(request) {
						expect(request.data.customData.div1).toBe("This is div1");
						expect(request.data.customData.div2).toBe(null);
						expect(request.data.customData.textInput1).toBe("This is textInput1");
						expect(request.data.customData.emailProvider).toBe("testprovider.com");
						expect(request.data.customData.hiddenInput1).toBe("This is hiddenInput1");
						expect(request.data.customData.textarea1).toBe("This is textarea1");
						done();
					};
				}
			});
		});
		it("should send encrypted data from indicated elements", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				encryptedElementSelector: "data-analytics-encrypt-test",
				encryptionKey: "-----BEGIN PUBLIC KEY-----MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlOJu6TyygqxfWT7eLtGDwajtNFOb9I5XRb6khyfD1Yt3YiCgQWMNW649887VGJiGr/L5i2osbl8C9+WJTeucF+S76xFxdU6jE0NQ+Z+zEdhUTooNRaY5nZiu5PgDB0ED/ZKBUSLKL7eibMxZtMlUDHjm4gwQco1KRMDSmXSMkDwIDAQAB-----END PUBLIC KEY-----",
				encryptionOptions: {
					repeatable: true
				},
				submissionHandler: new function() {
					this.submit = function(request) {
						expect(request.data.customData.encryptedInput1).toBe("data:encrypted:beRvIPHwBMsDF4ZNw7ndpY2YcMztrxtcKAxLHGTT6M8F7LZrwakSiJjSHRsKwbDP+qsIZGkwNELCCkzWBPhZ/BdeO4rVJ4cBECQKDapz9VKKkWWap2etU8un+ldaZSh5F5mToLXGo7ddWEDsjJwNqFt/cZRr6O2zDbLWNaNuA3c=");
						expect(request.data.customData.encryptedInput2).toBe("");
						done();
					};
				}
			});
		});
		it("should not send unencrypted data if encryption key is invalid", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				encryptedElementSelector: "data-analytics-encrypt-test",
				encryptionKey: "sfsdfsd",
				encryptionOptions: {
					repeatable: true
				},
				submissionHandler: new function() {
					this.submit = function(request) {
						expect(request.data.customData.encryptedInput1).toBeNull();
						done();
					};
				}
			});
		});
		it("should update session on indicated click events", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				clickSelector: "data-analytics-click-test",
				submissionHandler: new function() {
					this.submit = function(request) {
						if (request.data.event.type == "load") {
							document.getElementById("testButton1").click();
						} else {
							expect(request.data.event.type).toBe("click");
							expect(request.data.event.target).toBe("testButton1");
							done();
						}
					};
				}
			});
		});
		it("should update session on form submission", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				formSelector: "data-analytics-form-test",
				submissionHandler: new function() {
					this.submit = function(request) {
						if (request.data.event.type == "load") {
							document.getElementById("testFormButton1").click();
						} else {
							expect(request.data.event.type).toBe("form");
							expect(request.data.event.target).toBe("testForm1");
							expect(request.data.customData.formInput1).toBe("This is formInput1");
							done();
						}
					};
				}
			});
		});
		it("should submit custom data", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						if (!analyticsClient) {
							// For some reason IE thinks that analyticsClient is undefined. I haven't found a workaround so disabling test in IE.
							done();
						} else {
							if (data.event.type == "load") {
								analyticsClient.updateSession("test1", {
									p1: "v1",
									p2: "v2"
								});
							} else if (data.event.type == "test1") {
								expect(data.page.title).toBe("Jasmine Spec Runner");
								expect(data.event.type).toBe("test1");
								expect(data.customData.p1).toBe("v1");
								expect(data.customData.p2).toBe("v2");
								analyticsClient.updateSession("test2", {
									p1: "v1",
									p3: "v3"
								});
							} else {
								expect(data.page.title).toBe("Jasmine Spec Runner");
								expect(data.event.type).toBe("test2");
								expect(data.customData.p1).toBe("v1");
								expect(data.customData.p2).toBeUndefined();
								expect(data.customData.p3).toBe("v3");
								done();
							}
						}
					};
				}
			});
		});
		it("should handle RTC NotSupportedError thrown on Mac", function(done) {
			// Simulate mac behaviour
			if (!window.RTCPeerConnection) {
				window.RTCPeerConnection = function() {

				};
			};
			window.RTCPeerConnection.prototype.createDataChannel = function() {
				throw {
					name: "NotSupportedError"
				};
			};
			/////////////////////////
			console.error = function() {
				console.log(arguments);
				expect(arguments).toBeNull();
				done();
			};
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				submissionHandler: new function() {
					this.submit = function(request) {
						done();
					};
				}
			});
		});
	});
});

function flatten(obj) {
	var result = {};
	for (var key in obj) {
		value = obj[key];
		result[key] = value;
	}
	return result;
}