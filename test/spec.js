describe("AnalyticsClient", function() {
	describe("#updateSession()", function() {
		it("should submit all the data about the current session", function(done) {
			console.log("run");
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
	});
});