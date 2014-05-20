var Kinesis = function(config) {

	this.config = config;

	this.put = function(data, options) {
		var encodedData = btoa(data)
		var payload = '{"PartitionKey": "' + this.config.partitionKey + '", "StreamName": "' + this.config.streamName + '", "Data": "' + encodedData + '"}';
		var now = new Date();
		var datestamp = getDatestamp(now);
		var timestamp = getTimestamp(now);
		var signature = getSignature(this.config.credentials.secretKey, datestamp, timestamp, payload);
		Ajax.post("https://kinesis.us-east-1.amazonaws.com", payload, {
			headers: {
				"Authorization": "AWS4-HMAC-SHA256 Credential=" + this.config.credentials.accessKey + "/" + datestamp + "/us-east-1/kinesis/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=" + signature,
				"X-Amz-Date": timestamp,
				"X-Amz-Target": "Kinesis_20131202.PutRecord",
				"Content-Type": "application/x-amz-json-1.1",
				"Host": "kinesis.us-east-1.amazonaws.com"
			},
			onSuccess: options.onSuccess,
			onError: options.onError
		});
	}

	function getCanonicalString(timestamp, payload) {
		var hashedPayload = CryptoJS.SHA256(payload);
		var canonicalString = "POST\n\/\n\ncontent-type:application/x-amz-json-1.1\nhost:kinesis.us-east-1.amazonaws.com\nx-amz-date:" + timestamp + "\nx-amz-target:Kinesis_20131202.PutRecord\n\ncontent-type;host;x-amz-date;x-amz-target\n" + hashedPayload;
		return canonicalString;
	}

	function getStringToSign(timestamp, datestamp, payload) {
		var canonicalString = getCanonicalString(timestamp, payload);
		var hashedCanonicalString = CryptoJS.SHA256(canonicalString);
		var stringToSign = "AWS4-HMAC-SHA256\n" + timestamp + "\n" + datestamp + "/us-east-1/kinesis/aws4_request\n" + hashedCanonicalString;
		return stringToSign;
	}

	function getSignatureKey(key, dateStamp, regionName, serviceName) {
		var kDate = CryptoJS.HmacSHA256(dateStamp, "AWS4" + key, {
			asBytes: true
		});
		var kRegion = CryptoJS.HmacSHA256(regionName, kDate, {
			asBytes: true
		});
		var kService = CryptoJS.HmacSHA256(serviceName, kRegion, {
			asBytes: true
		});
		var kSigning = CryptoJS.HmacSHA256("aws4_request", kService, {
			asBytes: true
		});
		return kSigning;
	}

	function getSignature(key, datestamp, timestamp, payload){
		
		var signatureKey = getSignatureKey(key, datestamp, "us-east-1", "kinesis");
		var stringToSign = getStringToSign(timestamp, datestamp, payload);
		return CryptoJS.HmacSHA256(stringToSign, signatureKey, {
			asBytes: true
		}).toString();
	}

	function getDatestamp(date) {
		var dateStamp = "" + date.getUTCFullYear() + padNumber(date.getUTCMonth() + 1) + padNumber(date.getUTCDate());
		return dateStamp;
	}

	function getTimestamp(time) {
		var timestamp = getDatestamp(time) + "T" + padNumber(time.getUTCHours()) + padNumber(time.getUTCMinutes()) + padNumber(time.getUTCSeconds()) + "Z";
		return timestamp;
	}

	function padNumber(n) {
		if (n < 10) {
			n = "0" + n;
		}
		return n;
	}

}