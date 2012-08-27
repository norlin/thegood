/*jslint node: true, sloppy: true, white: true, nomen: true, maxerr: 50, indent: 4 */
/*jshint node: true, strict: false, white: true, maxerr: 50, indent: 4 */
var sys = require('util'),
	crypto = require('crypto'),
	couchdb = require('felix-couchdb');

//служебные функци
function getTime() {
	return (new Date()).getTime();
}

function errorCallback(err, cb) {
	cb(err);
}

var Database = function (secret) {
	this.secret = secret;

	//работа с БД
	this.getDoc = function getDoc(id, cb) {
		if (!id) {
			cb({error: 'not enough params to get doc!'});
			return false;
		}
		this._db.getDoc(id, cb);
	};
		
	this.saveDoc = function saveDoc(id, doc, cb) {
		if (typeof(cb) !== 'function') {
			cb = function () {};
		}

		if (!id || !doc) {
			cb({error: 'not enough params to save doc!'});
			return false;
		}
		//setTimeout(cb, 1000);
		//TODO: error!
		this._db.saveDoc(id, doc, cb);
	};

	return this;
};

//авторизация
Database.prototype.makePassword = function (login, password) {
	var password_hash = password + '-' + this.secret + login;
	
	password_hash = crypto.createHash('md5').update(password_hash, 'utf-8').digest('hex');
	
	return password_hash;
};

Database.prototype.makeAuth = function (login, pass, cb) {
	var Interface = this;
	function callback(err, user) {
		if (err) {
			//юзер не найден
			cb({status: -1});
			return;
		}
		
		if (user.passwd === Interface.makePassword(login, pass)) {
			cb({status: user.status, login: user.login, name: user.name}, login + '__' + Interface.makePassword(login, user.passwd));
		} else {
			//юзер найден, но пароль не подходит
			cb({status: -1});
		}
	}
	
	this.getDoc('user_' + login, callback);
};

Database.prototype.saveSocialUser = function (provider, data, token, cb) {
	var Interface = this,
		existingUser = data.existingUser;

	function makeUser(provider, data) {
		return {
			_id: 'user_' + provider + data.id,
			login: provider + data.id,
			name: data.name,
			social_id: data.id,
			sys_type: 'user',
			status: 10,
			provider: provider,
			token: {}
		};
	}

	function callback(err) {
		if (err) {
			cb({status: 0});
			return;
		}

		cb(
			{
				status: this.status,
				login: this.login,
				name: this.name
			},
			this.login + '__' + Interface.makePassword(this.login, this.passwd)
		);
	}
	
	function getUserCallback(err, response) {
		var user,
			twink,
			mainUser,
			twinkUser;

		if (err) {
			if (err.error === 'not_found') {
				user = makeUser(provider, data);
			} else {
				cb({status: 0});
			}
		} else {
			user = response;
			user.name = data.name;
		}

		if (existingUser) {
			if (user.db_twinks || existingUser.db_link) {
				//ранее залогиненный - твинк,
				//новый - основной
				existingUser.db_link = user._id;
				delete existingUser.status;

				twinkUser = existingUser;
				mainUser = user;
			} else {
				//новый юзер - твинк,
				//ранее залогиненный - основной
				user.db_link = existingUser._id;
				delete user.status;

				twinkUser = user;
				mainUser = existingUser;
			}

			twink = {};
			twink.id = mainUser._id;
			twink.provider = twinkUser.provider; //TODO: надо это протестировать

			if (!mainUser.db_twinks) {
				mainUser.db_twinks = {};
			}
			mainUser.db_twinks[twink.id] = twink;

			Interface.saveDoc(twinkUser._id, twinkUser);
		} else {
			mainUser = user;

			if (mainUser.db_link) {
				//если этот юзер - твинк, то надо получить основного
				existingUser = mainUser;
				Interface.getDoc(mainUser.db_link, getUserCallback);

				return;
			}
		}
		
		if (typeof(token) === 'object') {
			mainUser.token = token.token;

			if (token.secret) {
				mainUser.token_secret = token.secret;
			}
		} else {
			mainUser.token = token;
		}

		mainUser.passwd = Interface.makePassword(mainUser.login, mainUser.token);
		Interface.saveDoc(mainUser._id, mainUser, callback.bind(mainUser));
	}

	function existingUserCallback(err, response) {
		existingUser = response;
		Interface.getDoc('user_' + provider + data.id, getUserCallback);
	}

	if (existingUser && existingUser.login) {
		Interface.getDoc('user_' + existingUser.login, existingUserCallback);
	} else {
		Interface.getDoc('user_' + provider + data.id, getUserCallback);
	}
};

Database.prototype.checkAuth = function (cookie, cb) {
	var login,
		Interface = this;
	
	cookie = cookie ? cookie.split('__') : [0, 0];
	login = cookie[0];
	cookie = cookie[1];
		
	function callback(err, user) {
		if (err) {
			cb({status: -1});
			return;
		}
		
		if (cookie === Interface.makePassword(login, user.passwd)) {
			if (user.db_link) {
				sys.log('ERROR: -> этого не должно было случиться! db.js checkAuth callback user.db_link');
				Interface.getDoc(user.db_link, getMainCallback);
			} else {
				getMainCallback(null, user);
			}
		} else {
			cb({status: -1});
		}
	}

	function getMainCallback(err, user) {
		var twinks = {},
			twinkCount = 0,
			provider,
			tmp;

		function getTwinkCallback(err, twink) {
			twinkCount = twinkCount - 1;
			if (twink && twink.provider) {
				twinks[twink.provider] = twink;
			}

			if (twinkCount <= 0) {
				cb({
					status: user.status,
					login: user.login,
					name: user.name,
					token: user.token,
					twinks: twinks
				}, login + '__' + cookie);
			}
		}

		if (user.db_twinks) {
			for (tmp in user.db_twinks) {
				if (user.db_twinks.hasOwnProperty(tmp)) {
					twinkCount = twinkCount + 1;
					//TODO: сделать балковый запрос!
					Interface.getDoc(user.db_twinks[tmp].id, getTwinkCallback);
				}
			}
		} else {
			twinkCount = 0;
			getTwinkCallback();
		}
	}
	
	this.getDoc('user_' + login, callback);
};

//Новости
Database.prototype.getNews = function (params, cb) {
	var request = {};
	params = params || {};
	
	if (params.news_id) {
		this.getDoc('news_' + params.news_id, function (err, doc) {
			if (err || !doc) {
				cb(err);
				return false;
			}
			
			delete doc.description;
			delete doc._rev;
			
			cb(null, [{value: doc}]);
		});
	} else {
		params.page = params.page || 0;
		
		request.limit = params.limit || 10;
		request.skip = params.page * request.limit;
		request.descending = true;
		
		this._db.view('marks', 'news', request, function (err, doc) {
			if (err) {
				sys.log(sys.inspect(err));
				cb(err);
				return false;
			}
			
			cb(null, doc.rows);
		});
	}
};

Database.prototype.saveNews = function (news, login, cb) {
	var Interface = this,
		news_to_save = {};
	
	delete news._rev;
	news_to_save.sys_type = 'news';
	if (!news.id) {
		news_to_save.sys_date = getTime();
		news_to_save._id = 'news_' + news_to_save.sys_date;
	} else {
		news_to_save._id = news.id;
	}

	news_to_save.sys_status = 0;
	news_to_save.author = login;
	
	news_to_save.author_name = news.author_name;
	news_to_save.text = news.text;
	news_to_save.title = news.title;
	news_to_save.description = news.description;

	//прописываем пользователя
	function callbackUser(err, user) {
		if (err) {
			return;
		}
		
		user.news = user.news || [];
		user.news.push(news_to_save._id);
		
		Interface.saveDoc(user._id, user);
	}
	
	function callbackSaveNews(err) {
		if (err) {
			cb(err);
			return false;
		}
		
		cb(null, news_to_save);
	}

	function callbackGetNews(err, data) {
		if (err) {
			if (err.error === 'not_found') {
				callbackGetNews(null, news);
			} else {
				cb(err);
			}
			
			return;
		}
		
		if (data._rev) {
			news_to_save.sys_date = data.sys_date;
			news_to_save._rev = data._rev;
		}
		
		Interface.saveDoc(news_to_save._id, news_to_save, callbackSaveNews);
	}
	
	Interface.getDoc(news_to_save._id, callbackGetNews);
	Interface.getDoc('user_' + login, callbackUser);
};

/*
Database.prototype.getPointsByUid = function(uid, cb) {
	var Interface = this;

	Interface._db.request({
		method: 'POST',
		path: '/_design/outreach/_view/getUserPoints',
		data: JSON.stringify({keys: [uid.toString(10)]})
	}, function(err, doc) {
		if (err) {
			errorCallback(err, cb);
			return false;
		}

		cb(null, doc.rows[0].value);
	});
};

Database.prototype.getTopFacts = function(cb) {
	var Interface = this;
	Interface._db.view('outreach', 'getTopFacts', function(err, doc) {
		if (err) {
			errorCallback(err, cb);
			return false;
		}

		function sort(b, a) {
			return a['key'] - b['key'];
		}

		var result = doc.rows.sort(sort);
		result = result.splice(0, 10);
		cb(null, result);
		
	});
}
*/

Database.prototype.getStat = function (cb) {
	var Interface = this,
		result = false;
	
	function emit() {
		//if (result[0] && result[1]) {
		cb(null, result);
		//}
	}
	
	Interface._db.view('outreach', 'getUsersCount', function (err, doc) {
		if (err) {
			sys.log(sys.inspect(err));
			result = false;
			emit();
			return false;
		}

		result = doc.rows[0].value || false;
		
		emit();
	});
/*
	Interface._db.view('outreach', 'getFactsCount', function(err, doc) {
		if (err) {
			sys.log(sys.inspect(err));
			result[1]=-1;
			emit();
			return false;
		}
		
		result[1] = doc.rows[0].value||-1;
		
		emit();
	});
*/
};

//внешние интерфейсы
exports.createDatabase = function (port, host, login, pass, db, secret) {
	var Interface = new Database(secret),
		client;

	client = couchdb.createClient(port, host, login, pass, 100);
	Interface._db = client.db(db);
	
	return Interface;
};