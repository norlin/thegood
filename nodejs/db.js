/*jslint node: true, sloppy: true, white: true, nomen: true, maxerr: 50, indent: 4 */
var sys = require('util'),
	crypto = require('crypto'),
	couchdb = require('felix-couchdb');

//служебные функци
function getTime(){
	return (new Date()).getTime();
}

function doNothing(){}

function copyObj(obj){
	var key,
		copy;

	if (typeof(obj) !== 'object' || (obj instanceof Array)){
		return obj;
	}
	copy = {};
	
	for (key in obj){
		if (obj.hasOwnProperty(key)){
			copy[key] = copyObj(obj[key]);
		}
	}
	
	return copy;
}

function equalsObj(obj1,obj2){
	if (typeof(obj1) === 'object' && typeof(obj2) === 'object'){
		return (JSON.stringify(obj1) === JSON.stringify(obj2));
	}
	sys.log('ERROR: cant compare objs! WTF??');
}

function is_true(user,fact){
	if (user.id === fact.from){
		if (fact.no){
			return -1;
		}
		return 1;
	}

	return 0;
}

//работа с БД
function getDoc(id,cb){
	if (!id){
		cb({error:'not enough params to get doc!'});
		return false;
	}
	this._db.getDoc(id,cb);
}
	
function saveDoc(id,doc,cb){
	if (!id || !doc){
		cb({error:'not enough params to save doc!'});
		return false;
	}
	//setTimeout(cb,1000);
	
	this._db.saveDoc(id,doc,cb);
}

function errorCallback(err,cb){
	cb(err);
}

//авторизация
function makePassword(login,password){
	var secret = 'q2k3jriuyefvgi8msuey4gtri8w3ygfowuy83',
		password_hash = password + '-' + secret + login;
	
	password_hash = crypto.createHash('md5').update(password_hash,'utf-8').digest('hex');
	
	return password_hash;
}

var Database = function(){
	
};

Database.prototype.saveMark = function(mark,login,cb){
	var Interface = this;
	
	mark.sys_type = 'mark';
	mark.sys_date = getTime();

	mark.sys_status = 0;
	mark.author = login;
	mark._id = 'mark' + mark.sys_date;
	
	function callbackMark(err){
		if (err){
			cb(err);
			return false;
		}
		
		cb(null,mark);
	}
	
	function callbackUser(err,user){
		if (err){
			return;
		}
		
		user.marks = user.marks || [];
		user.marks.push(mark._id);
		
		saveDoc.apply(Interface,[user._id,user,doNothing]);
	}
	
	saveDoc.apply(Interface,[mark._id,mark,callbackMark]);
	
	getDoc.apply(Interface,['user_'+login,callbackUser]);
};

Database.prototype.getMarks = function(params,cb){
	var request = {};
	params = params || {};
	params.state = params.state || 'marks';
	
	//метки от такой даты
	request.startkey = params.from || (new Date()).getTime()-7200000;
	
	//до такой
	request.endkey = params.till || request.startkey+7200000;

	this._db.view('marks',params.state,request,function(err,doc){
		if (err){
			sys.log(sys.inspect(err));
			cb(err);
			return false;
		}
		
		//sys.log(sys.inspect(doc.rows));
		cb(null,doc.rows);
	});
};

Database.prototype.saveMarkStatus = function(marks,login,cb){
	var Interface = this,
		id,
		saved = [],
		count = 0;
	
	function saveMarkCallback(){
		if (count <= 0){
			cb(null,saved);
		}
	}
	
	function getMarkCallback(err,mark){
		count = count-1;
		
		if (err){
			saveMarkCallback();
			return false;
		}
		
		if (typeof(marks[mark._id]) === 'number'){
			mark.sys_status = marks[mark._id] || -1;
			mark.admined = login;
			saved.push(mark._id);
			saveDoc.apply(Interface,[mark._id,mark,saveMarkCallback]);
		}else{
			saveMarkCallback();
		}
		
	}
	
	for (id in marks){
		if (marks.hasOwnProperty(id)){
			count = count+1;
			getDoc.apply(Interface,[id,getMarkCallback]);
		}
	}
	
	if (count === 0){
		saveMarkCallback();
	}
};

Database.prototype.getNews = function(params,cb){
	var request = {};
	params = params || {};
	
	if (params.news_id){
		getDoc.apply(this,['news_'+params.news_id,function(err,doc){
			if (err || !doc){
				cb(err);
				return false;
			}
			
			delete doc.description;
			delete doc._rev;
			
			cb(null, [{value:doc}]);
		}]);
	}else{
		params.page = params.page || 0;
		
		request.limit = params.limit || 10;
		request.skip = params.page * request.limit;
		request.descending = true;
		
		this._db.view('marks','news',request,function(err,doc){
			if (err){
				sys.log(sys.inspect(err));
				cb(err);
				return false;
			}
			
			cb(null,doc.rows);
		});
	}
};

Database.prototype.saveNews = function(news,login,cb){
	var Interface = this,
		news_to_save = {};
	
	delete news._rev;
	news_to_save.sys_type = 'news';
	if (!news.id){
		news_to_save.sys_date = getTime();
		news_to_save._id = 'news_' + news_to_save.sys_date;
	}else{
		news_to_save._id = news.id;
	}

	news_to_save.sys_status = 0;
	news_to_save.author = login;
	
	news_to_save.author_name = news.author_name;
	news_to_save.text = news.text;
	news_to_save.title = news.title;
	news_to_save.description = news.description;

	//прописываем пользователя
	function callbackUser(err,user){
		if (err){
			return;
		}
		
		user.news = user.news || [];
		user.news.push(news_to_save._id);
		
		saveDoc.apply(Interface,[user._id,user,doNothing]);
	}
	
	function callbackSaveNews(err){
		if (err){
			cb(err);
			return false;
		}
		
		cb(null,news_to_save);
	}

	function callbackGetNews(err,data){
		if (err){
			if (err.error === 'not_found'){
				callbackGetNews(null,news);
			}else{
				cb(err);
			}
			
			return;
		}
		
		if (data._rev){
			news_to_save.sys_date = data.sys_date;
			news_to_save._rev = data._rev;
		}
		
		saveDoc.apply(Interface,[news_to_save._id,news_to_save,callbackSaveNews]);
	}
	
	getDoc.apply(Interface,[news_to_save._id,callbackGetNews]);
	
	getDoc.apply(Interface,['user_'+login,callbackUser]);
};

Database.prototype.makeAuth = function(login,pass,cb){
	function callback(err,user){
		//makePassword(login,pass);
		if (err){
			cb({status:0});
			return;
		}
		
		if (user.passwd === makePassword(login,pass)){
			cb({status:user.status,login:user.login,name:user.name},login+'__'+makePassword(login,user.passwd));
		}else{
			cb({status:-1});
		}
	}
	
	getDoc.apply(this,['user_'+login,callback]);
};

Database.prototype.saveSocialUser = function(provider,data,token,cb){
	var Interface = this,
		user;
	
	function callback(err){
		if (err){
			cb({status:0});
			return;
		}
		
		cb({status:user.status,login:user.login,name:user.name},user.login+'__'+makePassword(user.login,user.passwd));
	}
	
	function getUserCallback(err,response){
		if (err){
			if (err.error === 'not_found'){
				user = {
					_id:'user_'+provider+data.id,
					login:provider+data.id,
					name:data.name,
					status:10,
					social_id: data.id,
					sys_type:'user',
					provider:provider,
					token:{}
				};
				
				if (typeof(token) === 'object') {
					user.token = token.token;
					user.token_secret = token.secret;
				} else {
					user.token = token;
				}
			}else{
				cb({status:0});
			}
		}else{
			user = response;
			user.name = data.name;
				
			if (typeof(token) === 'object') {
				user.token = token.token;
				user.token_secret = token.secret;
			} else {
				user.token = token;
			}
		}
		
		user.passwd = makePassword(user.login,user.token);
		saveDoc.apply(Interface,[user._id,user,callback]);
	}
	
	getDoc.apply(Interface,['user_'+provider+data.id,getUserCallback]);
};

Database.prototype.checkAuth = function(cookie,cb){
	var login;
	
	cookie = cookie ? cookie.split('__') : [0,0];
	login = cookie[0];
	cookie = cookie[1];
		
	function callback(err,user){
		if (err){
			cb({status:0});
			return;
		}
		
		if (cookie === makePassword(login,user.passwd)){
			cb({
				status:user.status,
				login:user.login,
				name:user.name,
				token:user.token
			},login+'__'+cookie);
		}else{
			cb({status:-1});
		}
	}
	
	getDoc.apply(this,['user_'+login,callback]);
};

/*
Database.prototype.getPointsByUid = function(uid,cb){
	var Interface = this;

	Interface._db.request({
		method:'POST',
		path:'/_design/outreach/_view/getUserPoints',
		data:JSON.stringify({keys:[uid.toString(10)]})
	},function(err,doc){
		if (err){
			errorCallback(err,cb);
			return false;
		}

		cb(null,doc.rows[0].value);
	});
};

Database.prototype.makeAuth = function(data,cb){
	var Interface = this;

	if (!checkAuth(data)){
		cb(false);
	}

	function getUserCallback(err,user){
		if (err){
			cb(false);
			return;
		}
		
		user.auth = vk.makeCookie(user._id,data.secret);
		user.last_date = getTime();
		
		function callback(err,data){
			if (err){
				cb(false);
				return;
			}
			cb(true,user.auth);
		}
		
		saveDoc.apply(Interface,[user._id,user,callback]);
	}

	getDoc.apply(Interface,[data.viewer_id,getUserCallback]);
}

Database.prototype.checkAuth = function(query,cb){
	var Interface = this;

	if (!query || !query.viewer_id || !query.cookie){
		cb(false);
		return;
	}
	var uid = query.viewer_id.toString(10);
	Interface._db.request({
		method:'POST',
		path:'/_design/outreach/_view/getUserAuth',
		data:JSON.stringify({keys:[uid],limit:1})
	},authRender);
	
	function authRender(err,doc){
		if (err || !doc || !doc.rows || !doc.rows[0] || !doc.rows[0].value){
			cb(false);
			return;
		}

		if (doc.rows[0].value === query.cookie){
			cb(true);
		}else{
			cb(false);
		}
	}
}

Database.prototype.getTopFacts = function(cb){
	var Interface = this;
	Interface._db.view('outreach','getTopFacts',function(err,doc){
		if (err){
			errorCallback(err,cb);
			return false;
		}

		function sort(b,a){
			return a['key'] - b['key'];
		}

		var result = doc.rows.sort(sort);
		result = result.splice(0,10);
		cb(null,result);
		
	});
}
*/

Database.prototype.getStat = function(cb){
	var Interface = this,
		result = false;
	
	function emit(){
		//if (result[0] && result[1]){
			cb(null,result);
		//}
	}
	
	Interface._db.view('outreach','getUsersCount',function(err,doc){
		if (err){
			sys.log(sys.inspect(err));
			result = false;
			emit();
			return false;
		}

		result = doc.rows[0].value||false;
		
		emit();
	});
/*
	Interface._db.view('outreach','getFactsCount',function(err,doc){
		if (err){
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
exports.createDatabase = function(port,host,login,pass,db){
	var Interface = new Database(),
		client;
	
	client = couchdb.createClient(port, host, login, pass, 100);
	Interface._db = client.db(db);
	
	return Interface;
};