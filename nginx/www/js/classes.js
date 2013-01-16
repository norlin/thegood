/*jslint browser: true, sloppy: true, white: true, maxerr: 50, indent: 4 */
// общение с сервером
var Server = function (url) {
	this.url = url;
};

Server.prototype.post = function (method, data, callback, error) {
	$.ajax({
		url: this.url + method,
		type: 'POST',
		dataType: 'json',
		data: {
			json: JSON.stringify(data)
		},
		success: callback,
		error: error
	});
};

Server.prototype.getPage = function (page, callback, error) {
	this.post(page, {}, callback, error);
};