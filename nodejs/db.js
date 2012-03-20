var sys = require('util'),
	crypto = require('crypto'),
	couchdb = require('felix-couchdb');

//служебные функци
function getTime(){
	return (new Date()).getTime();
}

function doNothing(){}

function normalize(text){
	text = text.toLowerCase();
	text = text.replace(/[^0-9a-zа-яё\s\-]/gi,'');
	text = text.replace(/[йо]/gi,'е');
	text = text.replace(/[йу]/gi,'ю');
	text = text.replace(/[йа]/gi,'я');
	text = text.replace(/[ё]/gi,'е');
	text = text.replace(/ться/gi,'тся');
	text = text.replace(/нн/gi,'н');
	text = text.replace(/\s+/gi,' ');
	text = text.replace(/^\s+|\s+$/gi,'');

	return text;
}

function copyObj(obj){
	if (typeof(obj) != 'object' || (obj instanceof Array)){
		return obj;
	}
	var copy = {};
	
	for (var key in obj){
		copy[key] = copyObj(obj[key]);
	}
	
	return copy;
}

function equalsObj(obj1,obj2,log){
	if (typeof(obj1)=='object' && typeof(obj2)=='object'){
		return (JSON.stringify(obj1) == JSON.stringify(obj2));
	}
	sys.log('ERROR: cant compare objs! WTF??');
}

function is_true(user,fact){
	if (user.id == fact.from){
		if (fact.no){
			return -1;
		}else{
			return 1;
		}
	}else{
		return 0;
	}
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

var g_months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function transform_date(timestamp,without_date){
	var date = new Date(timestamp),
		year = date.getFullYear(),
		month = date.getMonth(),
		day = date.getDate(),
		hour = date.getHours(),
		minute = date.getMinutes(),
		second = date.getSeconds(),
		now_year, now_month, now_day;
		
	function make_time(time){
		if (time < 10){
			time = '0'+time;
		}
		return time;
	}
	
	date = new Date();
	now_year = date.getFullYear();
	now_month = date.getMonth();
	now_day = date.getDate();
	
	date = '';
	
	if (now_year == year){
		if (now_month == month){
			if (now_day == day){
				date+='сегодня';
			}else if (now_day-1 == day){
				date+='вчера';
			}else if (now_day+1 == day){
				date+='завтра';
			}else{
				date+=day+' '+g_months[month];
			}
		}else{
			date+=day+' '+g_months[month];
		}
	}else{
		date+=day+' '+g_months[month]+' '+year;
	}
	
	if (!without_date){
		date+=', '+make_time(hour)+':'+make_time(minute)+':'+make_time(second);	
	}
	
	return date;
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

//внешние интерфейсы
exports.createInterface = function(port,host,login,pass,db){
	var interface = new Interface();
	
	
	var client = couchdb.createClient(port, host, login, pass, 100);
	interface._db = client.db(db);
	
	return interface;
};

var Interface = exports.interface = function(){
	
};

Interface.prototype.saveMark = function(mark,login,cb){
	var interface = this;
	
	mark.sys_type = 'mark';
	mark.sys_date = getTime();
	//mark.human_date = transform_date(mark.sys_date);
	mark.sys_status = 0;
	mark.author = login;
	mark._id = 'mark' + mark.sys_date;
	
	function callbackMark(err,data){
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
		
		saveDoc.apply(interface,[user._id,user,doNothing]);
	}
	
	saveDoc.apply(interface,[mark._id,mark,callbackMark]);
	
	getDoc.apply(interface,['user_'+login,callbackUser]);
};

Interface.prototype.getMarks = function(params,cb){
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

Interface.prototype.saveMarkStatus = function(marks,login,cb){
	var interface = this,
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
		
		if (typeof(marks[mark._id]) == 'number'){
			mark.sys_status = marks[mark._id] || -1;
			mark.admined = login;
			saved.push(mark._id);
			saveDoc.apply(interface,[mark._id,mark,saveMarkCallback]);
		}else{
			saveMarkCallback();
		}
		
	}
	
	for (id in marks){
		count = count+1;
		getDoc.apply(interface,[id,getMarkCallback]);
	}
	
	if (count == 0){
		saveMarkCallback();
	}
};

Interface.prototype.getNews = function(params,cb){
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
			var i;
			
			if (err){
				sys.log(sys.inspect(err));
				cb(err);
				return false;
			}
			
			//sys.log(sys.inspect(doc.rows));
			
			for (i=0; i < doc.rows.length; i++){
				doc.rows[i].value.human_date = transform_date(doc.rows[i].value.sys_date);
			}
			
			cb(null,doc.rows);
		});
	}
};

Interface.prototype.saveNews = function(news,login,cb){
	var interface = this,
		news_to_save = {};
	
	delete news._rev;
	news_to_save.sys_type = 'news';
	if (!news.id){
		news_to_save.sys_date = getTime();
		news_to_save._id = 'news_' + news_to_save.sys_date;
	}else{
		news_to_save._id = news.id;
	}
	//news_to_save.human_date = transform_date(news_to_save.sys_date);
	news_to_save.sys_status = 0;
	news_to_save.author = login;
	
	news_to_save.author_name = news.author_name;
	news_to_save.text = news.text;
	news_to_save.title = news.title;
	news_to_save.description = news.description;
	
	function callbackGetNews(err,data){
		if (err){
			if (err.error == 'not_found'){
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
		
		saveDoc.apply(interface,[news_to_save._id,news_to_save,callbackSaveNews]);
	}
	
	function callbackSaveNews(err,data){
		if (err){
			cb(err);
			return false;
		}
		
		cb(null,news_to_save);
	}
	
	getDoc.apply(interface,[news_to_save._id,callbackGetNews]);

	//прописываем пользователя
	function callbackUser(err,user){
		if (err){
			return;
		}
		
		user.news = user.news || [];
		user.news.push(news_to_save._id);
		
		saveDoc.apply(interface,[user._id,user,doNothing]);
	}
	
	getDoc.apply(interface,['user_'+login,callbackUser]);
};

Interface.prototype.makeAuth = function(login,pass,cb){
	function callback(err,user){
		//makePassword(login,pass);
		if (err){
			cb({status:0});
			return;
		}
		
		if (user.passwd == makePassword(login,pass)){
			cb({status:user.status,login:user.login,name:user.name},login+'__'+makePassword(login,user.passwd));
		}else{
			cb({status:-1});
		}
	}
	
	getDoc.apply(this,['user_'+login,callback]);
};

Interface.prototype.saveSocialUser = function(provider,data,token,cb){
	var interface = this,
		user;
	
	function callback(err,data){
		if (err){
			cb({status:0});
			return;
		}
		
		cb({status:user.status,login:user.login,name:user.name},user.login+'__'+makePassword(user.login,user.passwd));
	}
	
	function getUserCallback(err,response){
		if (err){
			if (err.error == 'not_found'){
				user = {
				   _id:'user_'+provider+data.id,
				   login:provider+data.id,
				   name:data.name,
				   status:10,
				   sys_type:'user',
				   provider:provider,
				   token:{}
				};
				
				user.token = token;
			}else{
				cb({status:0});
			}
		}else{
			user = response;
			user.name = data.name;
			user.token = token;
		}
		
		user.passwd = makePassword(user.login,user.token);
		saveDoc.apply(interface,[user._id,user,callback]);
	}
	
	getDoc.apply(interface,['user_'+provider+data.id,getUserCallback]);
};

Interface.prototype.checkAuth = function(cookie,cb){
	var cookie = cookie ? cookie.split('__') : [0,0],
		login = cookie[0];
		
		cookie = cookie[1];
		
	function callback(err,user){
		if (err){
			cb({status:0});
			return;
		}
		
		if (cookie == makePassword(login,user.passwd)){
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
Interface.prototype.getPointsByUid = function(uid,cb){
	var interface = this;

	interface._db.request({
		method:'POST',
		path:'/_design/facts/_view/getUserPoints',
		data:JSON.stringify({keys:[uid.toString(10)]})
	},function(err,doc){
		if (err){
			errorCallback(err,cb);
			return false;
		}

		cb(null,doc.rows[0].value);
	});
};

Interface.prototype.makeAuth = function(data,cb){
	var interface = this;

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
		
		saveDoc.apply(interface,[user._id,user,callback]);
	}

	getDoc.apply(interface,[data.viewer_id,getUserCallback]);
}

Interface.prototype.checkAuth = function(query,cb){
	var interface = this;

	if (!query || !query.viewer_id || !query.cookie){
		cb(false);
		return;
	}
	var uid = query.viewer_id.toString(10);
	interface._db.request({
		method:'POST',
		path:'/_design/facts/_view/getUserAuth',
		data:JSON.stringify({keys:[uid],limit:1})
	},authRender);
	
	function authRender(err,doc){
		if (err || !doc || !doc.rows || !doc.rows[0] || !doc.rows[0].value){
			cb(false);
			return;
		}

		if (doc.rows[0].value == query.cookie){
			cb(true);
		}else{
			cb(false);
		}
	}
}

Interface.prototype.getTopFacts = function(cb){
	var interface = this;
	interface._db.view('facts','getTopFacts',function(err,doc){
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

Interface.prototype.getStat = function(cb){
	var interface = this;
	var result = [];
	
	function emit(){
		if (result[0] && result[1]){
			cb(null,result);
		}
	}
	
	result = [1,2];
	emit();
	
	return;
	
	
	interface._db.view('facts','getUsersCount',function(err,doc){
		if (err){
			sys.log(sys.inspect(err));
			result[0]=-1;
			emit();
			return false;
		}
		
		result[0] = doc.rows[0].value||-1;
		
		emit();
	});
	interface._db.view('facts','getFactsCount',function(err,doc){
		if (err){
			sys.log(sys.inspect(err));
			result[1]=-1;
			emit();
			return false;
		}
		
		result[1] = doc.rows[0].value||-1;
		
		emit();
	});
}
*/