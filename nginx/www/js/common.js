if (typeof(Array.forEach) != "function"){
	Array.prototype.forEach = function(fn, thisObj) {
		var i, l;
		
		for (i = 0, l = this.length; i < l; i++) {
			if (i in this) {
				fn.call(thisObj, this[i], i, this);
			}
		}
	};
}
if (typeof(Array.indexOf) != "function"){
	Array.prototype.indexOf = function(elt /*, from*/){
		var len = this.length,
			from = Number(arguments[1]) || 0;
			
		from = (from < 0) ? Math.ceil(from): Math.floor(from);
		if (from < 0){
			from += len;
		}
		
		for (; from < len; from++){
			if (from in this && this[from] === elt){
				return from;
			}
		}
		return -1;
	};
}
Array.prototype.unique = function(){
	var result = [];
	
	this.forEach(function(val){
		if (val && result.indexOf(val) == -1){
			result.push(val);
		}
	});
	
	return result;
}

var g_months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function transform_date(timestamp,without_date,exact){
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
	
	if (exact){
		date = make_time(now_day) +'.'+make_time(now_month+1)+'.'+now_year;
	}else{
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
	}
	
	return date;
}

function word_end(word,num){
	//word = ['сайтов','сайта','сайт']
	var num100 = num % 100;
	
	if (num == 0){
		return typeof(word[3]) != 'undefined' ? word[3] : word[0];
	}
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

function getRandom(min,max){
	min = min || 1;
	if (!max){
		max = min;
		min = 0;
	}
	
	return Math.floor(Math.random()*(max-min) + min);
};

function parseHash(hash){
	var result = {},
		item;
	
	if (typeof(hash) == 'string'){
		hash = hash.replace('^#','');
		hash = hash.split('&');
		
		hash.forEach(function(val,i){
			item = val.split('=');
			
			hash[item[0]] = item[1];
		});
	}
		
	return result;
}

function makeAuthWindow(provider,client,retpath,callback){
	var providers = {
			facebook:{
				url:'https://www.facebook.com/dialog/oauth?client_id='+client+'&redirect_uri='+retpath+provider,
				width:900,
				height:400
			},
			vkontakt:{
				url:'http://oauth.vk.com/authorize?client_id='+client+'&display=popup&response_type=code&redirect_uri='+retpath+provider,
				width:600,
				height:300
			},
			twitter:{
				url:retpath+provider,
				width: 600,
				height: 400
			},
			logout:{
				url:'http://theoutreach.info/logout',
				width:600,
				height:300
			}
		},
		width = providers[provider].width,
		height = providers[provider].height,
		left = (window.outerWidth/2)-(width/2),
		top = 200,
		auth_window;
	
	auth_window = window.open(providers[provider].url,'_blank','location=no,menubar=no,resizable=no,scrollbar=no,status=no,toolbar=no,left='+left+'px,top='+top+'px,width='+width+'px,height='+height+'px');
	
	window.loginCallback = callback;
	
	
}