Block.prototype.Actions.initBlocks = function(params) {
	var app = this,
		target = params && params.target ? params.target : '.js-pseudo-block',
		parent = params ? $(params.parent) : null,
		bodyBlock;
	/* инициализация блоков */

	if (parent && parent.length > 0 && typeof(target) === 'string') {
		target = parent.find(target);
	} else {
		target = $(target);
	}

	if (target.length === 0) {
		return;
	}

	target.each(function () {
		new Block(this, app);
	}).removeClass('js-pseudo-block');

	bodyBlock = app.params.body.data('Block');
	if (bodyBlock) {
		bodyBlock = bodyBlock.keyboardControl;
	}

	if (bodyBlock && bodyBlock.update) {
		bodyBlock.update();
	}
};