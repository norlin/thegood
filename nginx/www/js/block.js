var Block = function (n, app) {
	var BlockInstance = function (superBlock, n, params, app) {
		this.params = params;

		if (superBlock.blocks[this.params.type]) {
			/* if current block exists */
			this.Actions = superBlock.Actions;
			if (this.params.type === 'app') {
				/* create main block */
				this.blocks = superBlock.blocks;
			} else {
				/**
				 * create other blocks from DOM-nodes:
				 * for example:
				 * <a href="#" class="js-pseudo-block" onclick="return {type:'action', action:'example', someParam:value1, param2: ...}">Make JS-action</a>
				 */
				this.app = app;
				this.element = n;
				this.$element = $(n);

				/**
				 * add block-type classname for css-styling
				 */
				this.baseClass = 'b-' + this.params.type;

				this.$element.addClass(this.baseClass);
				this.$element.addClass('b-pseudo-block');

				blocksObject[this.params.type] = this;
			}
			/* initialize current block */
			superBlock.blocks[this.params.type].apply(this);
		}

		return this;
	},
	superBlock = this,
	blocksObject = {};
	/*
	block initialization (js-pseudo-block)
	*/

	if (typeof (n.params) === 'object') {
		superBlock.params = n.params;
	} else {
		if (typeof (n.onclick) !== 'function') {
			return 'No onclick function!';
		}

		/* get params... */
		superBlock.params = n.onclick();
	}

	/* ...check for params */
	if (!superBlock.params) {
		return 'No block params!';
	}

	if (superBlock.params instanceof Array) {
		/**
		 * Array means that current DOM-node has multiple blocks instances
		 * In current version you can't make more than one block of one type.
		 *
		 * p.s. actually, you CAN do this, but you can't access some of this block instances later
		 * but all of it will work
		 */
		superBlock.instances = [];
		superBlock.params.forEach(function (params) {
			var block;

			if (typeof (params) === 'object') {
				block = new BlockInstance(superBlock, n, params, app);
				superBlock.instances.push(block);
			}
		});
	} else {
		/**
		 * Only one block for current DOM-node
		 */
		superBlock = new BlockInstance(superBlock, n, superBlock.params, app);
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

Block.prototype.blocks.app = function () {
	var app = this,
		actions = {},
		action;

	if (app.inited) {
		return this;
	}

	for (action in app.Actions) {
		if (app.Actions.hasOwnProperty(action) && typeof(app.Actions[action]) === 'function') {
			actions[action] = app.Actions[action].bind(app);
		}
	}

	app.Actions = actions;

	app.classes = this.params.classes;

	app.ajaxRequest = {};

	app.ajaxQueue = {};

	/**
	 * localization
	 * app.getWord('word') return string from window.i18n[app.params.lang].lang['word']
		app.getWord('word','section') return string from window.i18n[app.params.lang]['section']['word']
		app.getWord('word','section', 'lang') return string from window.i18n[lang]['section']['word']
	 */
	app.getWord = function (key, section, lang) {
		if (!key) {
			throw 'No key param!';
		}

		lang = lang || app.params.lang;
		section = section || 'lang';

		return getWord(lang, section, key);
	};

	app.ajax = app.Actions.ajax;

	return this;
};