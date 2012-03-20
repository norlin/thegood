var sys = require('util'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	fs = require('fs'),
	dust = require('dust'),
	db = require('./db'),
	jsmin = require('./jsmin').minify,
	config = require('./config').config,
	twitter = require('./twitter');

/*
глобальные настройки
*/

var g_domain = config.host,
	g_node_path = config.node,
	g_www_path = config.www,
	g_version = '0.0.1',
	g_auth_retpath = 'http://'+g_domain+'/auth/',
	g_node_port = config.port,
	g_data = db.createInterface(config.db.port,g_domain,config.db.user,config.db.password,config.db.name,12),
	g_requests = {};
	
sys.print('loading');	

function logError(err){
	if (err){
		sys.log('! uncaught ERROR ! ' + sys.inspect(err));
		
	}
}
process.on('uncaughtException', logError);

function getTemplates(callback){
	var path = g_node_path+'/templates',
		templates = '';
	sys.print('.');

	g_pages.forEach(function(val){
		g_pages_hash[val.url] = 1;
	});
	
	fs.readdir(path,function(err,files){
		var cnt = files.length,
			i = 0;
			
		files.forEach(function(val){
			var file_path = path+'/'+val;
			
			fs.readFile(file_path,'utf8',function(err,data){
				var compiled,
					name = val.replace('.dust','');
				
				sys.print('.');
				compiled = dust.compile(data,name);
				
				//if (g_pages_hash[name]){
					templates+=compiled;
				//}
				
				dust.loadSource(compiled);
				
				i++;
				if (i == cnt){
					sys.print('.');
					
					fs.writeFile(g_www_path+'/js/templates.js',templates,function(){
						jsmin(g_www_path+'/js/scripts.js');
						jsmin(g_www_path+'/js/admin.js');
						jsmin(g_www_path+'/js/admin_news.js');
						jsmin(g_www_path+'/css/styles.css');
						jsmin(g_www_path+'/css/styles-ie.css');
						jsmin(g_www_path+'/css/admin.css');
						
						callback.call();
					});
				}
			});
		});
	});
}

function getTime(){
	return (new Date).getTime();
}

function word_end(word,num){
	var num100 = num % 100;
	if (num100 > 10 && num100 < 20){
		return word[0];
	}
	if ( (num % 5 >= 5) && (num100 <= 20) ){
		return word[0];
	}else{
		num = num % 10;
		if (((num >= 5) && num <= 9) || (num == 0)){
			return word[0];
		}
		if ((num >= 2) && (num <= 4)){
			return word[1];
		}
		if (num == 1){
			return word[2];
		}
	}
	return word[0];
}

function getData(protocol,host,path,token,callback){
	var response = '';
	
	protocol.get({
		host:host,
		path:path
	}, function(res) {
		res.on('data', function(d) {
			response += d;
		}).on('end',function(){
			callback(null,response,token);
		});
	}).on('error', function(e) {
		callback(e);
	});
}

function checkAdmin(user){
	if (!user || user.status < 100){
		return false;
	}
	return true;
}

function textValidate(text){
	
	//меняем англ. c на русскую с ;)
	text = text.replace('<sc','<sс');
	text = text.replace('</sc','</sс');
	
	return text;
}

var Resolver = function(req,resp,callback){
	var interface = this;
	/*
	основная внешняя функция

	*/
	
	this.debugMode = true;
	
	this._time1 = getTime();
	this._request = req;
	this._response = resp;
	this._data = {};
	this.action = [];
	this.status = 500;
	this.template = 'error';
	this.headers = {
		'Content-Type':'text/html; charset=utf-8'
	};
	
	this.cookies = {};
	(req.headers.cookie || '').split('; ').forEach(function(val){
		if (!val){
			return;
		}
		var name = val.split('=');
		interface.cookies[name[0]] = name[1];
	});
	
	if (typeof callback == 'function'){
		interface._cb = callback;
		
		process.on('uncaughtException', function(err){
			interface.debug('exeption!' + (sys.inspect(err) + console.trace()).replace(/\n/g,' '));
			interface.__print();
		});
	}
	
	if (req.post_data){
		this._post = url.parse('http://'+g_domain+'/?'+req.post_data,true).query || {};
	}else{
		this._post = {};
	}

	if (this._post.json){
		this._post.json = JSON.parse(this._post.json);
	}else{
		this._post.json = {};
	}

	this._url = url.parse(req.url,true)||{};
	this._url.pathname = this._url.pathname.replace(/\/+/g,'/');
	this._url.pathname = this._url.pathname.replace(/(^\/)|(\/$)/g,'');
	
	if (this._url.pathname && this._url.pathname != '/'){
		this.action = this._url.pathname.split('/');
	}
	
	if (this.action.length < 1){
		this.action = ['index'];
	}

	function onAuth(user,cookie){
		interface.user = user;
		interface.user.name = user.name || user.login;
		interface.authDone.call(interface,cookie);
	}	
	
	this.is_action = (typeof(g_actions[interface.action[0]]) === 'function');
	
	if (!interface.is_action && g_pages_hash[interface.action[0]]){
		interface.action = ['page'].concat(interface.action);
	}
	
	if (interface.action.length > 0 && typeof(g_actions[interface.action[0]]) === 'function'){
		interface.status = 200;

		if (this.action[0] == 'auth'){
		   onAuth({status:0});
		}else if (this._post.login && this._post.pass){
			g_data.makeAuth(this._post.login,this._post.pass,onAuth);
		}else if (this.cookies['login']){
			g_data.checkAuth(this.cookies['login'],onAuth);
		}else{
		   onAuth({status:0});
		}
	}else{
		g_actions['404'].call(interface);
	}

	return this;
}

Resolver.prototype.authFail = function(){
	g_actions['404'].call(this);
}

Resolver.prototype.debug = function(msg){
	if (this.debugMode){
		msg = msg || '';
		sys.log(
			msg+'; '+
			sys.inspect(this.action)+' '+(this.user ? this.user.login+' '+this.user.status : 'undef')+'; '+
			'GET: '+sys.inspect(this._url.query)+'; '+
			//'POST: '+sys.inspect(this._post)+
			'cookie: '+sys.inspect(this._cookie)
		);
	}
}

Resolver.prototype.authDone = function(cookie){
	var interface = this;
	/*if (this.user.status == -1){
		//если авторизация провалилась - посылаем
		this.authFail();
		return true;
	}*/

	if (cookie && !this.cookies['login']){
		this.headers['Set-Cookie'] = 'login='+cookie+'; path=/;';
	}
	//если всё ок - работаем дальше
	//if (interface.action[0] == 'index'){
	//	sys.log('index > user: '+interface.user.login+', status: '+interface.user.status);
	//}
	
	if (!interface._post.json){
	   interface._post.json = {};
	}
	
	/*
	interface._request_str = interface._url.pathname + interface._post.json + interface.user.login;

	if (g_requests[interface._request_str]){
		interface.action[0] = 'ajax';
		interface.action[1] = 'wait';
	}else{
		g_requests[interface._request_str] = 1;
	}
	*/
	
	this._data.info = {
		domain:'http://'+g_domain,
		action:this.action,
		query:sys.inspect(this._url.query),
		version:g_version,
		retpath:g_auth_retpath
	};
		
	if (this.user && this.user.status > 0){
		this._data.user = {
			name:this.user.name,
			status:this.user.status,
			is_admin:checkAdmin(this.user)
		};
	}
	
	this._data.pages = g_pages;
	
	this._data.full = true;
	
	g_actions[interface.action[0]].call(interface);
}

Resolver.prototype.__print = function(){
	var _Resolver = this;

	_Resolver._response.writeHead(_Resolver.status,_Resolver.headers);

	dust.stream(_Resolver.template, _Resolver._data)
		.on('data', function(data) {
			_Resolver._response.write(data);
		})
		.on('end', function(data){
			_Resolver.__printEnd();
		})
		.on('error', function(err) {
			_Resolver._response.write('Что-то пошло не так!');
			_Resolver._response.write(sys.inspect(err));
			
			_Resolver.__printEnd(err);
		});
}

Resolver.prototype.__printEnd = function(err){
	var time;
	
	if (this.debugMode == 2 && 
		this.template != 'ajax' &&
		this.template != 'ajax_page'
	){
		time = getTime() - this._time1;
		time = time + "";
		this._response.write(time);
	}
	this._response.end();
	
	if (this._cb){
		this._cb(err);
	}
	
	if (g_requests[this._request_str]){
		delete g_requests[this._request_str];
	}
}

var g_actions = {
/*
обработчики
*/
	'admin':function(ajax){
		var interface = this;
		
		this.debug('log_admin');
		
		this.template = 'admin';
		
		if (checkAdmin(this.user)){
			this._data.info.admin = true;
			//g_data.getMarks({state:'adminMarks'},callback);
		}else{
			callback();
		}

		function callback(err,data){
			if (data){
				interface._data.marks = JSON.stringify(data);
				interface._data.adminMarks = data;
			}
			
			if (ajax){
				ajax();
			}else{
				interface.__print();
			}
		}
		
	},
	'admin_news':function(ajax){
		var interface = this,
			params = {};
		
		this.debug('log_admin_news');
		
		this.template = 'admin_news_list';
		this._data.info.second = true;

		function callback(err,data){
			if (data){
				interface._data.news = data;
				if (interface.action[1]){
					interface.template = 'admin_news';
				}
			}
			
			if (ajax){
				ajax();
			}else{
				interface.__print();
			}
		}
		
		if (checkAdmin(this.user)){
			if (this.action[1]){
				params.news_id = this.action[1].replace('news_','');
			}
			
			this._data.info.admin = true;
			g_data.getNews(params,callback);
		}else{
			callback();
		}
	},
	'index':function(ajax){
		var interface = this,
			ready = 2;
		
		this.debug('log_index');

		this.template = 'index';
		this._data.index = true;
		this._data.marks_count = 0;
		this._data.marks_word = 'перекрытий';
		
		function callback(){
			//if (ready){
			//	return;
			//}
			
			if (ajax){
				ajax();
			}else{
				interface.__print();
			}
		}
		callback();
		/*
		function callbackMarks(err,data){
			if (!err){
				if (data){
					interface._data.marks = JSON.stringify(data);
					interface._data.marks_count = data.length;
					interface._data.marks_word = word_end(['перекрытий','перекрытия','перекрытие'],interface._data.marks_count);
				}
			}
			ready--;
			callback();
		}
		
		function callbackNews(err,data){
			if (!err){
				interface._data.news = data;
			}
			ready--;
			callback();
		}
		
		g_data.getMarks({},callbackMarks);
		g_data.getNews({limit:4},callbackNews);
		*/
	},
	'news':function(ajax){
		var interface = this,
			params = {};
		
		this.debug('log_news');

		this.template = 'news_list';
		
		function callback(err,data){
			if (data){
				interface._data.news = data;

				if (data.length == 1){
					interface.template = 'news';
					interface._data.news_single = true;
				}
			}else{
				g_actions['404'].call(interface);
				return;
			}
			
			if (ajax){
				ajax();
			}else{
				interface.__print();
			}
		}
		
		if (this.action[1]){
			params.news_id = this.action[1].replace('news_','');
		}
		
		g_data.getNews(params,callback);
	},
	'auth':function(){
	   
		this.debug('log_auth');
		
		var interface = this,
			provider = this.action[1],
			providers = {
				facebook:{
					protocol:https,
					host:'graph.facebook.com',
					authUrl:'/oauth/access_token?client_id='+g_config.oauth.fb[0]+'&redirect_uri='+g_auth_retpath+provider+'&client_secret='+g_config.oauth.fb[1]+'&code=',
					infoUrl:'/me?method=GET&format=json&fields=id,name&access_token=',
					onauth:function(err,data){
						var token,
							expires;
							
						if (err || !data){
							interface.template = 'auth';
							interface.__print();
						}else{
							token = data.split('&');
							
							if (!token || token.length < 2){
								token = token[0];
							}else{
								expires = token[1].split('=')[1];
								token = token[0].split('=')[1];
							}
							
							getData(
								providers[provider].protocol,
								providers[provider].host,
								providers[provider].infoUrl+token,
								[token,expires],
								providers[provider].oninfo
							);
						}
					},
					oninfo:function(err,data,token){
						if (err || !data){
							g_actions['500'].call(interface);
						}else{
							data = JSON.parse(data)||0;
							
							if (!data){
								interface.template = 'auth';
								interface.__print();
								return false;
							}
							
							g_data.saveSocialUser(provider,data,token[0],function(user,cookie){
								interface.headers['Set-Cookie'] = 'login='+cookie+'; path=/;';
								interface.template = 'auth';
								
								interface._data.user = {
									name:user.name||user.login,
									status:user.status
								};
								
								interface.__print();
							});
							
						}
					}
				},
				vkontakt:{
					protocol:https,
					host:'oauth.vk.com',
					hostInfo:'api.vk.com',
					authUrl:'/access_token?client_id='+g_config.oauth.vk[0]+'&client_secret='+g_config.oauth.vk[1]+'&code=',
					infoUrl:'/method/getProfiles?uid=',
					infoUrlEnd:'&access_token=',
					onauth:function(err,data){
						var token,
							expires,
							uid;
						
						data = data ? JSON.parse(data) || 0 : 0;

						if (err || !data || data.error){
							interface.template = 'auth';
							interface.__print();
						}else{
							token = data.access_token;
							expires = data.expires_in;
							uid = data.user_id;

							getData(
								providers[provider].protocol,
								providers[provider].hostInfo,
								providers[provider].infoUrl+uid+providers[provider].infoUrlEnd+token,
								[token,expires,uid],
								providers[provider].oninfo
							);
						}
					},
					oninfo:function(err,data,token){
						if (err || !data){
							interface.template = 'auth';
							interface.__print();
						}else{
							
							data = data ? JSON.parse(data) || 0 : 0;
							
							if (err || !data || data.error){
								g_actions['500'].call(interface);
								return false;
							}
							
							data = data.response[0];
							
							data = {
								id:data.uid,
								name:[data.first_name,data.last_name].join(' ')
							};
							
							g_data.saveSocialUser(provider,data,token[0],function(user,cookie){
								interface.headers['Set-Cookie'] = 'login='+cookie+'; path=/;';
								interface.template = 'auth';
								
								interface._data.user = {
									name:user.name||user.login,
									status:user.status
								};
								interface.__print();
							});
							
						}
					}
				}
			};
			
		if (!provider || 
			!this._url.query || 
			!this._url.query.code
		){
			if (providers[provider]){
				providers[provider].onauth(1);
			}else{
				sys.log('! -- unknown provider: '+provider+' user: ' + this.user.login);
				g_actions['500'].call(interface);
			}
			return false;
		}

		getData(
			providers[provider].protocol,
			providers[provider].host,
			providers[provider].authUrl+this._url.query.code,
			0,
			providers[provider].onauth
		);
	},
	'logout':function(){
		this.debug('log_logout');
		
		delete this._data.user;
		
		this.headers['Set-Cookie'] = 'login=; expires='+(new Date(getTime()-3600000)).toString()+'; path=/;';
		this.template='auth';
		this.__print();
	},
	'ajax':function(){
		var interface = this;
		
		function callback(err,data){
			interface.headers['Content-Type'] = 'application/json';
			interface.template = 'ajax';
			interface._data.ajax[interface.action[1]] = 1;
			
			if (err){
				interface._data['ajax'] = {
					error:1,
					status:err.msg||err.message||'ошибка',
				};
			}else{
				interface._data['data'] = JSON.stringify(data);
			}
			interface.__print();
		}
		
		function callbackPage(){
			interface.headers['Content-Type'] = 'application/json';
			interface.template = 'ajax_page';

			interface._data['data'] = JSON.stringify(interface._data);
			
			interface.__print();
		}
		
		this.debug('log_ajax');
		
		interface._data.ajax = {};
		
		if (typeof(g_actions[interface.action[1]]) == 'function'){
			//выполнение какого-либо действия в аякс-запроса
			interface._data.ajax = 1;
			interface._data.full = false;
			
			//убираем первый элемент 'ajax' из массива action
			interface.action.shift();
			
			g_actions[interface.action[0]].call(interface,callbackPage);
		}else if(g_pages_hash[interface.action[1]]){
			//отдача странички в аякс запросе
			interface._data.ajax = 1;
			interface._data.full = false;
			g_actions['page'].call(interface,callbackPage);
		}else{
			//выполнение аякс-действия
			if (!interface.user || interface.user.status < 0 || typeof(g_ajax_actions[this.action[1]]) != 'function'){
				g_actions['404'].call(interface);
				return false;
			}
	
			g_ajax_actions[this.action[1]].call(this,callback);
		}

	},
	'404':function(){
		this.debug('log_404');
		
		this.status = 404;
		this._data.info = {
			action:this.action,
			query:sys.inspect(this._url.query)
		}
		this.template = '404';
		this.__print();
	},
	'500':function(){
		this.debug('log_500');
		
		this.status = 500;
		this.template = 'error';
		this.__print();
	},
	'page':function(ajax){
		this.debug('log_page');
		
		this.template = this.action[1];
		
		if (ajax){
			ajax();
		}else{
			this.__print();
		}
	}
},
g_ajax_actions = {
	'wait':function(callback){
		callback({msg:'wait'});
	},
	'notifyall':function(callback){
		callback({msg:'what\'s up??'});
		return;
		//g_data.sendNotification(callback);
	},
	'save_mark':function(callback){
		var interface = this;
		g_data.saveMark(this._post.json.mark,this.user.login,function(err,mark){
			var text;
			
			if (!err && interface.user.status >= 10 && mark.tweet){
				text = mark.title.length > 100 ? mark.title.slice(0,100)+'...' : mark.title;
				text+= ' #перекрыли #bot';
				
				twitter.sendTweet({
					status:text,
					lat:mark.sys_lat,
					long:mark.sys_lng
				});
			}
			
			callback(err,mark);
		});
	},
	//админка
	'admin_update_marks':function(callback){
		if (!checkAdmin(this.user)){
			callback({msg:'нет прав'});
			return false;
		}
		
		this._data['ajax']['is_action'] = 1;
		
		g_data.saveMarkStatus(this._post.json.marks,this.user.login,callback);
	},
	'save_news':function(callback){
		var news = this._post.json.news,
			text,
			newNews = !news.id;
			
		if (!checkAdmin(this.user) || !news || !news.text){
			callback({msg:'нет прав'});
			return false;
		}
		
		this._data['ajax']['is_action'] = 1;
		
		news.text = textValidate(news.text);
		news.title = textValidate(news.title);
		news.author_name = this.user.name;
		
		g_data.saveNews(news,this.user.login,function(err,news){
			if (newNews){
				text = news.title.length > 100 ? news.title.slice(0,97)+'...' : news.title;
				text+= ' http://'+g_domain+'/news/'+news._id;
				text+= ' #новости #bot';
				
				twitter.sendTweet({
					status: text
				});
			}
			
			callback(err,news);
		});
	},
},
g_pages = [
	{
		url:'about',
		title:'О проекте'
	},
	{
		url:'faq',
		title:'FAQ'
	},
	{
		url:'contacts',
		title:'Контакты'
	}
],
g_pages_hash = {};

function Init(){
	sys.print(' starting');

	function serverCallback(req, resp){
		var _post = '';
	
		function onData(chunk){
			_post+=chunk;
		}
		
		function onRequestEnd(){
			req.post_data = _post;
			
			var main = new Resolver(req,resp,logError);
		}
		
		req.on('data',onData);
		req.on('end',onRequestEnd);
	}
	sys.print('.');
	
	var srv = http.createServer(serverCallback);
	sys.print('.');
	srv.listen(g_node_port);
	sys.print('.');
	
	sys.print(' done!\n');
}

getTemplates(Init);
