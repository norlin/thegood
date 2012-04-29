var sys = require('util'),
	crypto = require('crypto'),
	http = require('http'),
	https = require('https'),
	config = require('./config').config.twitter;

var symbols = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
			   'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
			   '1','2','3','4','5','6','7','8','9','0'];

function makeHash(){
	var hash='',
		tmp;

	for (var i=0;i<32;i++){
		tmp = Math.floor(Math.random()*62);
		hash+=symbols[tmp];
	}
	
	return hash;
}

function percentEncode(str){
	return encodeURIComponent(str).replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function makeSign(oauth,data){
	var params_string = [],
		sign_string = [],
		tmp,
		token_secret = config.token_secret,
		consumer_secret = config.consumer_secret,
		key_string = percentEncode(consumer_secret) + '&' + percentEncode(token_secret),
		hmac;
	
		
	for (tmp in oauth){
		params_string.push(
			percentEncode(tmp)+'='+percentEncode(oauth[tmp])
		);
	}
	  
	for (tmp in data.params){
		params_string.push(
			percentEncode(tmp)+'='+percentEncode(data.params[tmp])
		);
	}
	
	params_string.sort();
	params_string = params_string.join('&');

	sign_string = data.request.method.toUpperCase();
	sign_string+= '&' + percentEncode(data.request.url);
	sign_string+= '&' + percentEncode(params_string); 
	
	hmac = crypto.createHmac('sha1',key_string);
	
	return hmac.update(sign_string).digest('base64');
}

function generateOAuth(data,oauth_callback){
	var oauth = {
			oauth_consumer_key: config.oauth_consumer_key,
			oauth_nonce: makeHash(),
			oauth_signature_method: 'HMAC-SHA1',
			oauth_timestamp: Math.floor((new Date()).getTime() / 1000),
			oauth_token:config.oauth_token,
			oauth_version: '1.0'
		},
		oauth_params = [],
		sign = '',
		tmp;

	if (oauth_callback) {
		oauth.oauth_callback = oauth_callback;
	}
	
	oauth.oauth_signature = makeSign(oauth,data);
	
	for (tmp in oauth){
		oauth_params.push(
			percentEncode(tmp)+'='+'"'+percentEncode(oauth[tmp])+'"'
		);
	}
	
	oauth_params.sort();
	oauth_params = oauth_params.join(', ');
	
	sign = 'OAuth '+oauth_params
	
	return sign;
}

exports.sendTweet = function(data,cb){
	if (false){
		return;
	}
	
	var options = {
		hostname: 'api.twitter.com',
		path: '/1/statuses/update.json',
		method: 'POST'
	},
	tweet = data,
	post_data = [],
	request,
	oauth = generateOAuth({
		request:{
			method:options.method,
			url:'https://'+options.hostname+options.path
		},
		params:tweet
	});
	
	options.headers = {
		'Authorization':oauth
	};
	
	request = https.request(options,function(response){
		response.setEncoding('utf8');
		
		response.on('data', function (chunk) {
			if (typeof(cb) == 'function'){
				cb(null,chunk);
			}
		});
	});
	
	request.on('error', function(err) {
		sys.log('twitter exeption: ' + err.message);
		
		if (typeof(cb) == 'function'){
			cb(e);
		}
	});
	
		
	for (tmp in tweet){
		post_data.push(
			tmp+'='+percentEncode(tweet[tmp])
		);
	}
	
	post_data = post_data.join('&');
	
	request.write(post_data);
	
	request.end();
}

exports.requestToken = function(oauth_callback,cb){
	if (false){
		return;
	}
	
	var options = {
		hostname: 'api.twitter.com',
		path: '/oauth/request_token ',
		method: 'POST'
	},
	post_data = [],
	request,
	oauth = generateOAuth({
		request:{
			method:options.method,
			url:'https://'+options.hostname+options.path
		}
	},oauth_callback);
	
	options.headers = {
		'OAuth':oauth
	};
	
	request = https.request(options,function(response){
		response.setEncoding('utf8');
		
		response.on('data', function (chunk) {
			if (typeof(cb) == 'function'){
				cb(null,chunk);
			}
		});
	});
	
	request.on('error', function(err) {
		sys.log('twitter exeption: ' + err.message);
		
		if (typeof(cb) == 'function'){
			cb(e);
		}
	});
	
	request.end();
}