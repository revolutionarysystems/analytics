describe("AnalyticsClient", function() {
	describe("#updateSession()", function() {
		it("should submit all the data about the current session", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({submissionHandler: new function(){
				this.submit = function(request){
					var data = request.data;
					expect(data.page.title).toBe("Jasmine Spec Runner");
					expect(data.page.performance.fetchStart).toBeGreaterThan(0);
					done();
				};
			}});
			analyticsClient.updateSession({});
		});
		it("should return a request id", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({submissionHandler: new function(){
				this.submit = function(request){
					
				};
			}});
			var requestId = analyticsClient.updateSession({});
			expect(requestId).not.toBeUndefined();
			done();
		});
		it("should submit custom data", function(done) {
			var analyticsClient = new RevsysAnalyticsClient({submissionHandler: new function(){
				this.submit = function(request){
					var data = request.data;
					expect(data.page.title).toBe("Jasmine Spec Runner");
					expect(data.p1).toBe("v1");
					expect(data.p2).toBe("v2");
				};
			}});
			analyticsClient.updateSession({p1: "v1", p2: "v2"});
			analyticsClient.config.submissionHandler = new function(){
				this.submit = function(request){
					var data = request.data;
					console.log(data);
					expect(data.page.title).toBe("Jasmine Spec Runner");
					expect(data.p1).toBe("v1");
					expect(data.p2).toBeUndefined();
					expect(data.p3).toBe("v3");
					done();
				};
			};
			analyticsClient.updateSession({p1: "v1", p3: "v3"});
		});
	});
});