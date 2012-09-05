/*jslint node: true, sloppy: true, white: true, maxerr: 50, indent: 4 */
/*jshint node: true, strict: false, white: true, maxerr: 50, indent: 4 */
var sys = require('util'),
	http = require('http'),
	https = require('https'),
	formidable = require('formidable'),
	url = require('url'),
	fs = require('fs'),
	dust = require('dustjs-linkedin'),
	db = require('./db'),
	jsmin = require('./jsmin').minify,
	g_config = require('./config').config,
	twitter = require('./twitter');

/*
глобальные настройки
*/

var g_domain = g_config.host,
	g_node_path = g_config.node,
	g_www_path = g_config.www,
	g_tmp_path = g_config.tmp,
	g_version = '0.0.5',
	g_auth_retpath = 'http://' + g_domain + '/auth/',
	g_node_port = g_config.port,
	g_data = db.createDatabase(g_config.db.port, g_domain, g_config.db.user, g_config.db.password, g_config.db.name, g_config.db.secret),
	g_requests = {},
	g_actions,
	g_ajax_actions,
	g_pages,
	g_pages_hash,
	g_twitter_tokens = {};

sys.print('loading');

function logError(err) {
	if (err) {
		sys.log('! uncaught ERROR ! ' + sys.inspect(err));

	}
}
process.on('uncaughtException', logError);

function getTime() {
	return (new Date()).getTime();
}

function word_end(word, num) {
	var num100 = num % 100;
	if (num100 > 10 && num100 < 20) {
		return word[0];
	}

	if (
		(num % 5 >= 5) && (num100 <= 20)
	) {
		return word[0];
	}

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

	return word[0];
}

function getData(protocol, host, path, token, callback) {
	var response = '';

	protocol.get({
		host: host,
		path: path
	}, function (res) {
		res.on('data', function (d) {
			response += d;
		}).on('end', function () {
			callback(null, response, token);
		});
	}).on('error', function (e) {
		callback(e);
	});
}

function checkAdmin(user) {
	if (!user || user.status < 100) {
		return false;
	}
	return true;
}

function textValidate(text) {
	//меняем англ. c на русскую с ;)
	text = text.replace('<sc', '<sс');
	text = text.replace('</sc', '</sс');

	return text;
}

var Resolver = function (req, resp, files, callback) {
	var Interface = this;
	/*
	основная внешняя функция

	*/

	this.debugMode = {
		login: true
	};

	this.time1 = getTime();
	this.request = req;
	this.response = resp;
	this.data = {};
	this.action = [];
	this.files = files;
	this.status = 500;
	this.template = 'error';
	this.headers = {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-store, no-cache, must-revalidate'
	};

	this.cookies = {
		//test:(new Date()).getTime()
	};
	(req.headers.cookie || '').split('; ').forEach(function (val) {
		if (!val) {
			return;
		}
		var name = val.split('=');
		Interface.cookies[name[0]] = name[1];
	});

	if (typeof(callback) === 'function') {
		Interface.cb = callback;

		process.on('uncaughtException', function (err) {
			Interface.debug('exeption!' + ((err ? sys.inspect(err) : 'no error') + console.trace()).replace(/\n/g, ' '));
			Interface.print();
		});
	}

	if (req.post_data && !req.multipart) {
		this.post = url.parse('http://' + g_domain + '/?' + req.post_data, true).query || {};
	} else {
		this.post = {};
	}

	if (this.post.json) {
		this.post.json = JSON.parse(this.post.json);
	} else {
		this.post.json = {};
	}

	this.url = url.parse(req.url, true) || {};
	this.url.pathname = this.url.pathname.replace(/\/ + /g, '/');
	this.url.pathname = this.url.pathname.replace(/(^\/)|(\/$)/g, '');

	if (this.url.pathname && this.url.pathname !== '/') {
		this.action = this.url.pathname.split('/');
	}

	if (this.action.length < 1) {
		this.action = ['morda'];
	}

	function onAuth(user, cookie) {
		Interface.user = user;
		Interface.user.name = user.name || user.login;
		Interface.authDone.call(Interface, cookie);
	}

	this.is_action = (typeof(g_actions[Interface.action[0]]) === 'function');

	if (!Interface.is_action && g_pages_hash[Interface.action[0]]) {
		Interface.action = ['page'].concat(Interface.action);
	}

	if (Interface.action.length > 0 && typeof(g_actions[Interface.action[0]]) === 'function') {
		Interface.status = 200;

		if (this.post.login && this.post.login === 'norlin' && this.post.pass) {
			g_data.makeAuth(this.post.login, this.post.pass, onAuth);
		} else if (this.cookies.login) {
			g_data.checkAuth(this.cookies.login, onAuth);
		} else {
			onAuth({status: 0});
		}
	} else {
		g_actions['404'].call(Interface);
	}

	return this;
};

Resolver.prototype.authFail = function () {
	g_actions['logout'].call(this);
};

Resolver.prototype.debug = function (msg) {
	if (this.debugMode) {
		msg = msg || '';
		sys.log(
			msg + '; ' +
			sys.inspect(this.action) + ' ' + (this.user ? this.user.login + ' ' + this.user.status : 'undef') + '; ' +
			'GET: ' + sys.inspect(this.url.query) + '; ' +
			//'POST: ' + sys.inspect(this.post) +
			'cookie: ' + sys.inspect(this.cookies)
		);
	}
};

Resolver.prototype.authDone = function (cookie) {
	var Interface = this;

	this.data.info = {
		domain: 'http://' + g_domain,
		action: this.action,
		query: sys.inspect(this.url.query),
		version: g_version,
		retpath: g_auth_retpath,
		social: {
			vk: g_config.oauth.vk[0],
			fb: g_config.oauth.fb[0]
		}
	};

	if (this.debugMode) {
		this.data.info.debug = this.debugMode;
	}

	if (this.user.status === -1) {
		//если авторизация провалилась - посылаем
		this.authFail();
		return true;
	}
	//если всё ок - работаем дальше

	if (cookie) {
		if (Interface.action[0] === 'morda') {
			if (this.cookies.login) {
				Interface.action[0] = 'index';
			} else {
				this.data.cookie = cookie;
				g_actions['login'].call(Interface);
				return;
			}
		}
	}
	if (!Interface.post.json) {
		Interface.post.json = {};
	}

	/*
	Interface.request_str = Interface.url.pathname + Interface.post.json + Interface.user.login;

	if (g_requests[Interface.request_str]) {
		Interface.action[0] = 'ajax';
		Interface.action[1] = 'wait';
	} else {
		g_requests[Interface.request_str] = 1;
	}
	*/

	if (this.user && this.user.status > 0) {
		this.data.user = {
			name: this.user.name,
			status: this.user.status,
			is_admin: checkAdmin(this.user)
		};
	}

	this.data.pages = g_pages;

	this.data.full = true;

	g_actions[Interface.action[0]].call(Interface);
};

Resolver.prototype.print = function () {
	var Interface = this;

	Interface.response.writeHead(Interface.status, Interface.headers);

	dust.stream(Interface.template, Interface.data)
		.on('data', function (data) {
			Interface.response.write(data);
		})
		.on('end', function () {
			Interface.printEnd();
		})
		.on('error', function (err) {
			Interface.response.write('Что-то пошло не так!');
			Interface.response.write(sys.inspect(err));

			Interface.printEnd(err);
		});
};

Resolver.prototype.printEnd = function (err) {
	var time;

	if (this.debugMode) {
		time = getTime() - this.time1;
		time = time.toString();
		this.response.write('<div class="b-debug">' + time + 'ms</div>');
	}

	this.response.end();

	if (this.cb) {
		this.cb(err);
	}

	if (g_requests[this.request_str]) {
		delete g_requests[this.request_str];
	}
};

g_actions = {
/*
обработчики
*/
	'admin': function (ajax) {
		var Interface = this;

		function callback(err, data) {
			if (!err && data) {
				Interface.data.marks = JSON.stringify(data);
				Interface.data.adminMarks = data;
			}

			if (ajax) {
				ajax();
			} else {
				Interface.print();
			}
		}

		this.debug('log_admin');

		this.template = 'admin';

		if (checkAdmin(this.user)) {
			this.data.info.admin = true;
			//g_data.getMarks({state: 'adminMarks'},callback);
		} else {
			callback();
		}
	},
	'admin_news': function (ajax) {
		var Interface = this,
			params = {};

		this.debug('log_admin_news');

		this.template = 'admin_news_list';
		this.data.info.second = true;

		function callback(err, data) {
			if (!err && data) {
				Interface.data.news = data;
				if (Interface.action[1]) {
					Interface.template = 'admin_news';
				}
			}

			if (ajax) {
				ajax();
			} else {
				Interface.print();
			}
		}

		if (checkAdmin(this.user)) {
			if (this.action[1]) {
				params.news_id = this.action[1].replace('news_', '');
			}

			this.data.info.admin = true;
			g_data.getNews(params, callback);
		} else {
			callback();
		}
	},
	'morda': function (ajax) {
		var Interface = this;

		this.debug('log_morda');

		this.template = 'morda';
		this.data.index = true;
		this.data.userCount = false;

		function callback(err, data) {
			if (!err && typeof(data) !== 'undefined') {
				Interface.data.userCount = data;
			}
			if (ajax) {
				ajax();
			} else {
				Interface.print();
			}
		}

		g_data.getStat(callback);
	},
	'index': function (ajax) {
		var Interface = this;

		this.debug('log_index');

		this.template = 'index';
		this.data.index = true;
		this.data.userCount = false;

		function callback(err, data) {
			if (!err && typeof(data) !== 'undefined') {
				Interface.data.userCount = data;
			}
			if (ajax) {
				ajax();
			} else {
				Interface.print();
			}
		}

		g_data.getStat(callback);
	},
	'test': function () {
		this.template = 'test';
		this.headers['Set-Cookie'] = 'test=' + (new Date()).getTime();
		this.print();
	},
	'upload': function () {
		var Interface = this,
			i,
			data,
			file,
			files = [],
			count = 0;

		function metadataCallback(err, metadata) {
			files.push(metadata);
			count = count - 1;

			// 55/1	5085/100	0/1
			//
			// 50	50.85		0
			//
			// 50 + (50.85/60) + (0/3600)
			//
			// Если S или W - то минус

			if (!count) {
				sys.log(sys.inspect(files));
				Interface.print();
			}
		}

		for (file in this.files) {
			if (this.files.hasOwnProperty(file)) {
				count = count + 1;

				im.readMetadata(this.files[file].path, metadataCallback);
			}
		}

		this.template = 'index';
	},
	'news': function (ajax) {
		var Interface = this,
			params = {};

		this.debug('log_news');

		this.template = 'news_list';

		function callback(err, data) {
			if (!err && data) {
				Interface.data.news = data;

				if (data.length === 1) {
					Interface.template = 'news';
					Interface.data.news_single = true;
				}
			} else {
				g_actions['404'].call(Interface);
				return;
			}

			if (ajax) {
				ajax();
			} else {
				Interface.print();
			}
		}

		if (this.action[1]) {
			params.news_id = this.action[1].replace('news_', '');
		}

		g_data.getNews(params, callback);
	},
	'auth': function () {

		this.debug('log_auth');

		var Interface = this,
			provider = this.action[1],
			providers = {
				facebook: {
					protocol: https,
					host: 'graph.facebook.com',
					authUrl: '/oauth/access_token?client_id=' + g_config.oauth.fb[0] + '&redirect_uri=' + g_auth_retpath + provider + '&client_secret=' + g_config.oauth.fb[1] + '&code=',
					infoUrl: '/me?method=GET&format=json&fields=id,name&access_token=',
					onauth: function (err, data) {
						var token,
							expires;

						if (err || !data) {
							Interface.template = 'auth';
							Interface.print();
						} else {
							token = data.split('&');

							if (!token || token.length < 2) {
								token = token[0];
							} else {
								expires = token[1].split('=')[1];
								token = token[0].split('=')[1];
							}

							getData(
								providers[provider].protocol,
								providers[provider].host,
								providers[provider].infoUrl + token,
								[token, expires],
								providers[provider].oninfo
							);
						}
					},
					oninfo: function (err, data, token) {
						if (err || !data) {
							g_actions['error'].call(Interface);
						} else {
							data = JSON.parse(data) || 0;

							if (!data) {
								Interface.template = 'auth';
								Interface.print();
								return false;
							}

							saveSocialUser(data, {oauth_token: token[0]});
						}
					}
				},
				vkontakt: {
					protocol: https,
					host: 'oauth.vk.com',
					hostInfo: 'api.vk.com',
					authUrl: '/access_token?client_id=' + g_config.oauth.vk[0] + '&client_secret=' + g_config.oauth.vk[1] + '&scope=notify,friends,offline&code=',
					infoUrl: '/method/getProfiles?uid=',
					infoUrlEnd: '&access_token=',
					onauth: function (err, data) {
						var token,
							expires,
							uid;

						data = data ? JSON.parse(data) || 0 : 0;

						if (err || !data || data.error) {
							Interface.template = 'auth';
							Interface.print();
						} else {
							token = data.access_token;
							expires = data.expires_in;
							uid = data.user_id;

							getData(
								providers[provider].protocol,
								providers[provider].hostInfo,
								providers[provider].infoUrl + uid + providers[provider].infoUrlEnd + token,
								[token, expires, uid],
								providers[provider].oninfo
							);
						}
					},
					oninfo: function (err, data, token) {
						if (err || !data) {
							Interface.template = 'auth';
							Interface.print();
						} else {

							data = data ? JSON.parse(data) || 0 : 0;

							if (err || !data || data.error) {
								g_actions['error'].call(Interface);
								return false;
							}

							data = data.response[0];

							data = {
								id: data.uid,
								name: [data.first_name, data.last_name].join(' ')
							};


							saveSocialUser(data, {oauth_token: token[0]});
						}
					}
				},
				twitter: {
					/* make all this things more better */
					protocol: https,
					host: 'api.twitter.com',
					tokenUrl: '/oauth/request_token',
					authUrl: '/oauth/authenticate',
					onauth: function (err, data) {
						var token,
							oauth = {};

						data = data ? JSON.parse(data) || 0 : 0;
						if (!err &&
							Interface.url.query &&
							Interface.url.query.oauth_token &&
							Interface.url.query.oauth_verifier
						) {
							token = Interface.url.query.oauth_token;
							if (g_twitter_tokens[token]) {
								twitter.accessToken({
									oauth_verifier: Interface.url.query.oauth_verifier,
									oauth_token: token,
									oauth_token_secret: g_twitter_tokens[token]
								}, providers[provider].oninfo);
								delete g_twitter_tokens[token];
							} else {
								Interface.status = 403;
								Interface.template = 'error';
								Interface.print();
							}
						} else {
							twitter.requestToken(g_auth_retpath + provider, function (err, data) {
								if (err) {
									Interface.status = 502;
									Interface.template = 'error';
									Interface.print();
									return;
								}

								data = data.split('&');
								data.forEach(function (val, i) {
									data[i] = val.split('=');
									oauth[data[i][0]] = data[i][1];
								});

								if (oauth.oauth_callback_confirmed === 'true') {
									g_twitter_tokens[oauth.oauth_token] = oauth.oauth_token_secret;

									Interface.template = 'auth';
									Interface.status = 302;
									Interface.headers.Location = 'https://' + providers[provider].host + providers[provider].authUrl + '?oauth_token=' + oauth.oauth_token;
								} else {
									Interface.status = 403;
									Interface.template = 'error';
								}

								Interface.print();
							});
						}

					},
					oninfo: function (err, data) {
						var oauth = {};

						if (err) {
							Interface.status = 502;
							Interface.template = 'error';
							Interface.print();
							return;
						}
						data = data.split('&');
						data.forEach(function (val, i) {
							data[i] = val.split('=');
							oauth[data[i][0]] = data[i][1];
						});

						twitter.getUserData(oauth, function (err, data) {
							var name = oauth.screen_name;
							data = data ? JSON.parse(data) : null;

							if (!err && data && data.name) {
								name = data.name;
							}

							data = {
								id: data.id,
								name: data.name
							};

							saveSocialUser(data, oauth);
						});
					}
				}
			};

		function saveSocialUser(data, oauth) {
			if (Interface.user) {
				data = data || {};

				data.existingUser = Interface.user;
			}

			g_data.saveSocialUser(provider, data, {
				token: oauth.oauth_token,
				secret: oauth.oauth_token_secret
			}, function (user, cookie) {
				Interface.headers['Set-Cookie'] = 'login=' + cookie + '; path=/;';
				Interface.template = 'auth';

				Interface.data.user = {
					name: user.name || user.login,
					status: user.status
				};
				Interface.print();
			});
		}

		if (!provider ||
			!this.url.query ||
			!this.url.query.code
		) {
			if (providers[provider]) {
				providers[provider].onauth();
			} else {
				sys.log('! -- unknown provider: ' + provider + ' user: ' + this.user.login);
				g_actions['error'].call(Interface);
			}
			return false;
		}

		getData(
			providers[provider].protocol,
			providers[provider].host,
			providers[provider].authUrl + this.url.query.code,
			0,
			providers[provider].onauth
		);
	},
	'login': function () {
		this.debug('log_login');


		this.headers['Set-Cookie'] = 'login=' + this.data.cookie + '; path=/;';

		this.template = 'auth';
		this.print();
	},
	'logout': function () {
		this.debug('log_logout');

		delete this.data.user;

		this.headers['Set-Cookie'] = 'login=; expires=' + (new Date(getTime() - 3600000)).toString() + '; path=/;';
		this.template = 'auth';
		this.print();
	},
	'ajax': function () {
		var Interface = this;

		function callback(err, data) {
			Interface.headers['Content-Type'] = 'application/json';
			Interface.template = 'ajax';
			Interface.data.ajax[Interface.action[1]] = 1;

			if (err) {
				Interface.data.ajax = {
					error: 1,
					status: err.msg || err.message || 'ошибка'
				};
			} else {
				Interface.data.data = JSON.stringify(data);
			}
			Interface.print();
		}

		function callbackPage() {
			Interface.headers['Content-Type'] = 'application/json';
			Interface.template = 'ajax_page';

			Interface.data.data = JSON.stringify(Interface.data);

			Interface.print();
		}

		this.debug('log_ajax');

		Interface.data.ajax = {};

		if (typeof(g_actions[Interface.action[1]]) === 'function') {
			//выполнение какого-либо действия в аякс-запроса
			Interface.data.ajax = 1;
			Interface.data.full = false;

			//убираем первый элемент 'ajax' из массива action
			Interface.action.shift();

			g_actions[Interface.action[0]].call(Interface, callbackPage);
		} else if (g_pages_hash[Interface.action[1]]) {
			//отдача странички в аякс запросе
			Interface.data.ajax = 1;
			Interface.data.full = false;
			g_actions.page.call(Interface, callbackPage);
		} else {
			//выполнение аякс-действия
			if (
				!Interface.user ||
				Interface.user.status < 0 ||
				typeof(g_ajax_actions[this.action[1]]) !== 'function'
			) {
				g_actions['404'].call(Interface);
				return false;
			}

			g_ajax_actions[this.action[1]].call(this, callback);
		}

	},
	'404': function () {
		this.debug('log_404');

		this.status = 404;
		this.data.info = {
			action: this.action,
			query: sys.inspect(this.url.query)
		};
		this.template = '404';
		this.print();
	},
	'500': function () {
		this.debug('log_500');

		this.status = 500;
		this.template = 'error';
		this.print();
	},
	'page': function (ajax) {
		this.debug('log_page');

		this.template = this.action[1];

		if (ajax) {
			ajax();
		} else {
			this.print();
		}
	}
};

g_ajax_actions = {
	'wait': function (callback) {
		callback({msg: 'wait'});
	},
	'notifyall': function (callback) {
		callback({msg: 'what\'s up??'});
		return;
		//g_data.sendNotification(callback);
	},
	'save_mark': function (callback) {
		var Interface = this;
		g_data.saveMark(this.post.json.mark, this.user.login, function (err, mark) {
			var text;

			if (!err && Interface.user.status >= 10 && mark.tweet) {
				text = mark.title.length > 100 ? mark.title.slice(0, 100) + '...' : mark.title;
				text += ' #перекрыли #bot';

				twitter.sendTweet({
					status: text,
					lat: mark.sys_lat,
					long: mark.sys_lng
				});
			}

			callback(err, mark);
		});
	},
	//админка
	'admin_update_marks': function (callback) {
		if (!checkAdmin(this.user)) {
			callback({msg: 'нет прав'});
			return false;
		}

		this.data.ajax.is_action = 1;

		g_data.saveMarkStatus(this.post.json.marks, this.user.login, callback);
	},
	'save_news': function (callback) {
		var news = this.post.json.news,
			text,
			newNews = !news.id;

		if (!checkAdmin(this.user) || !news || !news.text) {
			callback({msg: 'нет прав'});
			return false;
		}

		this.data.ajax.is_action = 1;

		news.text = textValidate(news.text);
		news.title = textValidate(news.title);
		news.author_name = this.user.name;

		g_data.saveNews(news, this.user.login, function (err, news) {
			if (newNews) {
				text = news.title.length > 100 ? news.title.slice(0, 97) + '...' : news.title;
				text += ' http://' + g_domain + '/news/' + news._id;
				text += ' #новости #bot';

				twitter.sendTweet({
					status: text
				});
			}

			callback(err, news);
		});
	}
};

g_pages = [
	{
		url: 'about',
		title: 'О проекте'
	},
	{
		url: 'faq',
		title: 'FAQ'
	},
	{
		url: 'contacts',
		title: 'Контакты'
	}
];

g_pages_hash = {};

function getTemplates(callback) {
	var path = g_node_path + '/templates',
		templates = '';
	sys.print('.');

	g_pages.forEach(function (val) {
		g_pages_hash[val.url] = 1;
	});

	fs.readdir(path, function (err, files) {
		var cnt = files.length,
			i = 0;

		if (err || !files) {
			return;
		}

		files.forEach(function (val) {
			var file_path = path + '/' + val;

			fs.readFile(file_path, 'utf8', function (err, data) {
				var compiled,
					name = val.replace('.dust', '');

				if (err) {
					return;
				}

				sys.print('.');
				compiled = dust.compile(data, name);

				//if (g_pages_hash[name]) {
				templates += compiled;
				//}

				dust.loadSource(compiled);

				i = i + 1;
				if (i === cnt) {
					sys.print('.');

					fs.writeFile(g_www_path + '/js/templates.js', templates, function () {
						jsmin(g_www_path + '/js/scripts.js');
						jsmin(g_www_path + '/js/admin.js');
						jsmin(g_www_path + '/js/admin_news.js');
						jsmin(g_www_path + '/css/styles.css');
						jsmin(g_www_path + '/css/styles-ie.css');
						jsmin(g_www_path + '/css/admin.css');

						callback.call();
					});
				}
			});
		});
	});
}

function Init() {
	sys.print(' starting');

	function serverCallback(req, resp) {
		var post = '',
			type = req.headers ? req.headers['content-type'] : '',
			form;

		function onData(chunk) {
			post += chunk;
		}

		function onRequestEnd(err, fields, files) {
			req.post_data = post;

			var main = new Resolver(req, resp, files, logError);
		}

		if (type && type.match('multipart/form-data')) {
			form = new formidable.IncomingForm();
			form.uploadDir = g_tmp_path;
			form.maxFieldsSize = 5 * 1024 * 1024;
			form.parse(req, onRequestEnd);
		} else {
			req.on('data', onData);
			req.on('end', onRequestEnd);
		}
	}
	sys.print('.');

	var srv = http.createServer(serverCallback);
	sys.print('.');
	srv.listen(g_node_port);
	sys.print('.');

	sys.print(' done!\n');
}

getTemplates(Init);
