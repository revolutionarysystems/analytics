describe("AnalyticsClient", function() {
	describe("#updateSession()", function() {
		it("should submit all the data about the current session", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
						expect(data.page.title).toBe("Jasmine Spec Runner");
						expect(data.page.performance.fetchStart).toBeGreaterThan(0);
						expect(data.location.city).not.toBeUndefined();
						expect(data.location.coords).not.toBeUndefined();
						expect(data.event.type).toBe("load");
						expect(data.network).toBeUndefined();
						expect(data.ipAddress.remote).not.toBeUndefined();
						expect(data.ipAddress.local.length).toBeGreaterThan(0);
						done();
					};
				}
			});
		});
		it("should send network data if requested", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				includeNetworkData: true,
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
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
				includeHeaders: ["User-Agent"],
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
						expect(data.headers['User-Agent']).not.toBeUndefined();
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
						expect(request.data.div1).toBe("This is div1");
						expect(request.data.div2).toBe(null);
						expect(request.data.textInput1).toBe("This is textInput1");
						expect(request.data.hiddenInput1).toBe("This is hiddenInput1");
						expect(request.data.textarea1).toBe("This is textarea1");
						done();
					};
				}
			});
		});
		it("should update session on indicated click events", function(done) {
			var init = false;
			var analyticsClient = new RevsysAnalyticsClient({
				persistSessionState: false,
				clickSelector: "data-analytics-click-test",
				submissionHandler: new function() {
					this.submit = function(request) {
						if (init) {
							expect(request.data.event.type).toBe("click");
							expect(request.data.event.target).toBe("testButton1");
							done();
						}else{
							init = true;
							document.getElementById("testButton1").click();
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
						expect(data.page.title).toBe("Jasmine Spec Runner");
						expect(data.p1).toBe("v1");
						expect(data.p2).toBe("v2");
					};
				}
			});
			analyticsClient.updateSession({
				p1: "v1",
				p2: "v2"
			});
			analyticsClient.config.submissionHandler = new function() {
				this.submit = function(request) {
					var data = request.data;
					expect(data.page.title).toBe("Jasmine Spec Runner");
					expect(data.p1).toBe("v1");
					expect(data.p2).toBeUndefined();
					expect(data.p3).toBe("v3");
					done();
				};
			};
			analyticsClient.updateSession({
				p1: "v1",
				p3: "v3"
			});
		});
	 });
});