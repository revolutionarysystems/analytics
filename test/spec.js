describe("AnalyticsClient", function() {
	describe("#updateSession()", function() {
		it("should submit all the data about the current session", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
				submissionHandler: new function() {
					this.submit = function(request) {
						var data = request.data;
						console.log(data);
						expect(data.page.title).toBe("Jasmine Spec Runner");
						expect(data.page.performance.fetchStart).toBeGreaterThan(0);
						expect(data.location.city).not.toBeUndefined();
						expect(data.location.coords).not.toBeUndefined();
						done();
					};
				}
			});
		});
		it("should return a request id", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({
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
				clickSelector: "data-analytics-click-test",
				submissionHandler: new function() {
					this.submit = function(request) {
						if (init) {
							expect(request.data.click).toBe("testButton1");
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