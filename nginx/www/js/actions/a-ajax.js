Block.prototype.Actions.ajax = function (options, queue) {
	var app = this.app || this,
		ajaxData,
		response;

	if (typeof(options) === 'string') {
		queue = options;
		options = app.ajaxQueue[options][0];
	} else if (queue) {
		app.ajaxQueue[queue] = app.ajaxQueue[queue] || [];
		app.ajaxQueue[queue].push(options);

		if (app.ajaxQueue[queue].length > 1) {
			return;
		} else {
			app.ajax(queue);
			return;
		}
	}

	ajaxData = typeof(options) === 'object' ? $.extend({ajax: true}, options.data) : null;

	if (!options) {
		return "No ajax params";
	}

	function onSuccess(data) {
		response = data;

		if (typeof (options.success) === 'function') {
			options.success(data);
		}

		app.Actions.initBlocks();
	}

	function onError(data) {
		if (typeof (options.error) === 'function') {
			options.error(data);
		}
	}

	function onComplete() {
		if (typeof (options.complete) === 'function') {
			options.complete(response, queue ? app.ajaxQueue[queue].length === 1 : undefined);
		}

		if (queue) {
			app.ajaxQueue[queue].shift();
			app.ajax(queue);
		}
	}

	options.dataType = options.dataType || 'json';
	options.method = options.method || 'POST';
	options.contentType = options.contentType || 'application/x-www-form-urlencoded';

	response = null;
	if (options.url) {
		app.ajaxRequest[options.url] = $.ajax({
			url: options.url,
			traditional: true,
			data: ajaxData,
			type: options.method,
			dataType: options.dataType,
			contentType: options.contentType,
			success: onSuccess,
			error: onError,
			complete: onComplete
		});
	} else {
		throw "No url for ajax";
	}
};