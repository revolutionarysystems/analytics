exports.config =
	paths:
		public: "dist"
		watched: ["src", "test", "haven_artifacts"]
	files:
		javascripts:
			joinTo: 
				'analytics-client.js': /^(src|haven_artifacts(\\|\/)main)/
	modules:
		wrapper: false
		definition: false
