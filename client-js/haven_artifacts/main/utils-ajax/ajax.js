var Ajax = new function() {

	this.send = function(options) {
		var request = {
			method: "GET",
			data: null,
			responseType: "text",
			headers: {},
			onSuccess: function(response) {
			},
			onError: function(code, message) {
			}
		};

		request = merge(request, options);
		
		var http = new XMLHttpRequest();
		var url = request.url;
		if (request.data != null && request.method === "GET") {
			url = url + "?" + request.data;
		}
		if(request.data != null && request.method === "POST" && request.headers["Content-Type"] == null){
			request.headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		http.open(request.method, url, true);
		for(var header in request.headers){
			http.setRequestHeader(header, request.headers[header]);
		}
		http.onload = function(e) {
			if (http.readyState === 4) {
				if (http.status === 200) {
					var response;
					if(request.responseType == "json"){
						response = JSON.parse(http.responseText);
					}else{
						response = http.responseText;
					}
					request.onSuccess(response);
				} else {
					request.onError(http.status, http.statusText);
				}
			}
		};
		if(request.data != null && request.method === "POST"){
			http.send(request.data);
		}else{
			http.send();
		}
	}

	this.get = function(url, options) {
		this.send(merge(options, {url: url, method: "GET"}));
	}
	
	this.post = function(url, data, options){
		this.send(merge(options, {url: url, method: "POST", data: data}));
	}
	
	this.getJSON = function(url, options){
		this.get(url, merge(options, {responseType: "json"}));
	}
	
	function merge(o1, o2){
		if(o1 == null){
			o1 = {};
		}
		if (o2 != null) {
			for (var o in o2) {
				o1[o] = o2[o];
			}
		}
		return o1;
	}

}