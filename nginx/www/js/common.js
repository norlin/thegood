if (typeof(Function.bind) !== "function") {
	Function.prototype.bind = function(bindTo) {
		var fn = this;

		return function() {
			fn.apply(bindTo,arguments);
		};
	};
}


if (typeof(Array.forEach) !== "function") {
	Array.prototype.forEach = function(fn, thisObj) {
		var i, l;

		for (i = 0, l = this.length; i < l; i++) {
			if (i in this) {
				fn.call(thisObj, this[i], i, this);
			}
		}
	};
}

if (typeof(Array.indexOf) !== "function") {
	Array.prototype.indexOf = function(elt /*, from*/) {
		var len = this.length,
			from = Number(arguments[1]) || 0;

		from = (from < 0) ? Math.ceil(from): Math.floor(from);
		if (from < 0) {
			from += len;
		}

		for (; from < len; from++) {
			if (from in this && this[from] === elt) {
				return from;
			}
		}
		return -1;
	};
}

if (typeof(Array.unique) !== "function") {
	Array.prototype.unique = function() {
		var result = [];

		this.forEach(function(val) {
			if (val && result.indexOf(val) === -1) {
				result.push(val);
			}
		});

		return result;
	};
}

function wordEnd(word, num) {
	//word = ['сайтов','сайта','сайт']
	var num100 = num % 100;

	if (num === 0) {
		return typeof(word[3]) !== 'undefined' ? word[3] : word[0];
	}

	if (num100 > 10 && num100 < 20) {
		return word[0];
	}

	if ( (num % 5 >= 5) && (num100 <= 20) ) {
		return word[0];
	} else {
		num = num % 10;

		if (((num >= 5) && num <= 9) || (num === 0)) {
			return word[0];
		}

		if ((num >= 2) && (num <= 4)) {
			return word[1];
		}

		if (num === 1) {
			return word[2];
		}
	}
	return word[0];
}

function getRandom(min,max) {
	min = min || 1;
	if (!max) {
		max = min;
		min = 0;
	}

	return Math.floor(Math.random()*(max-min) + min);
}

function humanize(date, format, monthes, days) {
	/*
	Transform date in human-readable format

	format [optional] - bit mask
	default (0) -> yesterday, today, tomorrow, 14 march,
	+1 -> with time -> yesterday 15:44:30, today 15:44:30, tomorrow 15:44:30, 14 march 15:44:30
	+2 -> without monthes -> yesterday, today, tomorrov, 14
	+4 -> strict dates -> 12 march, 13 march, 14 march, 15 march

	so, if you want format with strict dates (+4) and time (+1) -> 12 march 15:44:30 -> you need format == 1+4 == 5

	monthes - Array of month names == ['jan', 'feb', 'mar',…]
	days - Array of near day names == ['yesterday', 'today', 'tomorrow']
	*/
	var nowDate = parseDate(new Date()),
		result;

	if (typeof (format) === 'object') {
		days = monthes;
		monthes = format;
		format = 0;
	}

	date = parseDate(date);

	result = '';

	/*jslint bitwise: true*/
	if (nowDate.year === date.year) {
		if (nowDate.month === date.month && !(format & 4)) {
			if (nowDate.day === date.day) {
				result = days[1];
			} else if (nowDate.day - 1 === date.day) {
				result = days[0];
			} else if (nowDate.day + 1 === date.day) {
				result = days[2];
			} else {
				result = date.day + ' ' + ((format & 2) ? '' : monthes[date.month]);
			}
		} else {
			result = date.day + ' ' + ((format & 2) ? '' : monthes[date.month]);
		}
	} else {
		result = date.day + ' ' + ((format & 2) ? '' : monthes[date.month] + ' ' + date.year);
	}

	if (format & 1) {
		result += ', ' + makeTime(date.hour) + ':' + makeTime(date.minute) + ':' + makeTime(date.second);
	}
	/*jslint bitwise: false*/

	return result;
}

function getWord (lang, section, key) {
	if (!window.i18n) {
		return 'i18n not found!';
	}

	if (!lang) {
		return 'Please, define language!';
	}
	if (!section) {
		return 'Please, define section!';
	}
	if (!key) {
		return 'What word do you need?';
	}
	return i18n[lang][section][key];
}

function makeAuthWindow(provider, client, retpath, callback) {
	var providers = {
			facebook: {
				url: 'https://www.facebook.com/dialog/oauth?client_id=' + client + '&redirect_uri=' + retpath + provider,
				width: 900,
				height: 400
			},
			vkontakt: {
				url: 'http://oauth.vk.com/authorize?client_id=' + client + '&display=popup&response_type=code&redirect_uri=' + retpath + provider,
				width: 600,
				height: 300
			},
			twitter: {
				url: retpath + provider,
				width: 600,
				height: 400
			},
			logout: {
				url: g_domain + '/logout',
				width: 600,
				height: 300
			}
		},
		width = providers[provider].width,
		height = providers[provider].height,
		left = (window.outerWidth / 2) - (width / 2),
		top = 200,
		auth_window;

	$('body').append('<div class="b-popup"><div class="b-block b-block__popup"><iframe class="b-auth-window" src="' + providers[provider].url + '"></iframe></div></div>');

	//auth_window = window.open(providers[provider].url, '_blank', 'location=no,menubar=no,resizable=no,scrollbar=no,status=no,toolbar=no,left=' + left + 'px,top=' + top + 'px,width=' + width + 'px,height=' + height + 'px');

	window.loginCallback = callback;
}
