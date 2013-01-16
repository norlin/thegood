var Block = function (n, dummy) {
	var BlockInstance = function (superBlock, n, params, dummy) {
		this.params = params;

		if (superBlock.blocks[this.params.type]) {
			/* если такой блок есть */
			if (this.params.type === 'dummy') {
				this.Actions = superBlock.Actions;
				this.blocks = superBlock.blocks;
			} else {
				/* для обычных блоков,
				создаваемых в верстке */
				this.dummy = dummy;
				this.element = n;
				this.$element = $(n);

				this.baseClass = 'b-' + this.params.type;

				this.$element.addClass(this.baseClass);
				this.$element.addClass('b-pseudo-block');

				blocksObject[this.params.type] = this;
			}
			/* инициализируем конкретный тип блока */
			superBlock.blocks[this.params.type].apply(this);
		}

		return this;
	},
	superBlock = this,
	blocksObject = {};
	/*
	инициализация блока (js-pseudo-block)
	*/

	if (typeof (n.params) === 'object') {
		superBlock.params = n.params;
	} else {
		if (typeof (n.onclick) !== 'function') {
			return 'No onclick function!';
		}

		/* получаем параметры... */
		superBlock.params = n.onclick();
	}

	/* ...проверяем наличие обязательных */
	if (!superBlock.params) {
		return 'No block params!';
	}

	if (superBlock.params instanceof Array) {
		superBlock.instances = [];
		superBlock.params.forEach(function (params) {
			var block;

			if (typeof (params) === 'object') {
				if (params.type) {
					block = new BlockInstance(superBlock, n, params, dummy);
				} else {
					$(n).data('Keyboard', {type:'element', params: params});
				}
			}

			superBlock.instances.push(block);
		});
	} else {
		superBlock = new BlockInstance(superBlock, n, superBlock.params, dummy);
	}

	$(n).data('Block', blocksObject);
	$(n).removeAttr('onclick');

	return superBlock;
};

Block.prototype.Actions = {
	//ACTIONS
};

Block.prototype.blocks = {
	//BLOCKS
};

Block.prototype.blocks.dummy = function () {
	var dummy = this,
		actions = {},
		action;

	if (dummy.inited) {
		return this;
	}

	for (action in dummy.Actions) {
		if (dummy.Actions.hasOwnProperty(action) && typeof(dummy.Actions[action]) === 'function') {
			actions[action] = dummy.Actions[action].bind(dummy);
		}
	}

	dummy.Actions = actions;

	dummy.classes = this.params.classes;

	dummy.render = function (template, data, callback) {
		dummy.params.dust.render(template, data, callback);
	};

	dummy.popups = [];
	dummy.timers = {};
	dummy.status = {};

	dummy.queue = {
		_timer: null,
		_queue: [],
		add: function(fn, context, time) {
			var setTimer = function(time) {
				dummy.queue._timer = setTimeout(function() {
					time = dummy.queue.doStep();

					if (dummy.queue._queue.length) {
						setTimer(time);
					}
				}, time || 2);
			};

			if (fn) {
				dummy.queue._queue.push([fn, context, time]);
				if (dummy.queue._queue.length == 1) {
					setTimer(time);
				}
				return;
			}
		},
		doStep: function () {
			var current,
				next;

			current = dummy.queue._queue.shift();
			if (!current) {
				return 0;
			}

			current[0].call(current[1] || window);

			next = dummy.queue._queue[0];
			return next ? next[2] : 0;

		},
		clear: function() {
			clearTimeout(dummy.queue._timer);
			dummy.queue._queue = [];
		}
	};

	/**
	 * dummy.getWord('word') достанет строку из window.i18n[dummy.params.lang].lang['word']
		dummy.getWord('word','section') достанет строку из window.i18n[dummy.params.lang]['section']['word']
		dummy.getWord('word','section', 'lang') достанет строку из window.i18n[lang]['section']['word']
	 */
	dummy.getWord = function (key, section, lang) {
		if (!key) {
			throw 'No key param!';
		}

		lang = lang || dummy.params.lang;
		section = section || 'lang';

		return getWord(lang, section, key);
	};

	function onEsc(e) {
		if (e.which === 27) {
			e.stopPropagation();
			e.preventDefault();
			dummy.Actions.popupClose.apply(dummy);
		}
	}

	$(document).off('keydown.popup').on('keydown.popup', onEsc);

	return this;
};