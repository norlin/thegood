Block.prototype.Actions.example = function(params) {
	var block = this,
		app = this.app || this;

	/**
	 * Some js code
	 *
	 * for example, making ajax-call:
	 */

	app.ajax({
		url: '/ajax/method',
		data: {
			someParam: block.params.someParam/*,
			moreParams: ...
			*/
		},
		success: function (result) {
			//...
		},
		error: function () {
			alert('Oops, that\'s not good!');
		}
	});
};