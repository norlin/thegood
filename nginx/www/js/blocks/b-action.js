Block.prototype.blocks.action = function () {
	/* block for making js-functions on user-events */
	var block = this,
		trigger = block.params.trigger || 'click',
		prevent = typeof(block.params.prevent) === 'undefined' ? true : block.params.prevent;

	if (!block.params.action) {
		return false;
	}

	if (typeof(block.Actions[block.params.action]) !== 'function') {
		throw "Action '"+ block.params.action +"' not found!";
	}

	function actionClick(e) {
		var action;
		action = block.params.action;

		e.stopPropagation();

		if (prevent) {
			e.preventDefault();
		}

		if (block.params.disabled === true) {
			return true;
		}

		if (typeof (block.Actions[action]) !== 'function') {
			action = block.params.action;
		}

		block.Actions[action].call(block, block.params);
	}

	block.enable = function () {
		/**
		 * You can call this method from outside by
		 * $('#currentBlockSelector').data('Block').action.enable()
		 */
		block.params.disabled = false;
	};

	block.disable = function () {
		block.params.disabled = true;
	};

	this.$element.on(trigger, actionClick);

	if (block.params.active === true) {
		/**
		 * If "active" param - call action automatically with block init
		 */
		this.$element.trigger(trigger);
	}
};