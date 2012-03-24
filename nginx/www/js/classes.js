// общение с сервером
var Server = function(url){
	this.url = url;
};

Server.prototype.post = function(method,data,callback,error){
	$.ajax({
		url: this.url+method,
		type: 'POST',
		dataType: 'json',
		data: {json:JSON.stringify(data)},
		success: callback,
		error: error
	});
};

Server.prototype.saveMark = function(mark,callback,error){
	this.post('save_mark',{mark:mark},callback,error);
};

Server.prototype.getMarks = function(params,callback,error){
	var markset = {
		'spam': 'get_spam_marks',
		'new': 'get_admin_marks',
		'good': 'get_good_marks'
	};
	params = params || {
		status: 'good'
	};
	
	this.post(markset[params.status],params,callback,error);
};

Server.prototype.getPage = function(page,callback,error){
	this.post(page,{},callback,error);
};

// метки
var Mark = function(geoPoint,settings,style){
	style = style || {
		style: "perekrili#icon"
	};
	this.placemark = new YMaps.Placemark(geoPoint,style);
	this.placemark.setBalloonContent('Загрузка...');
	
	//список параметров метки:
	//[тип, название, подсказка]
	settings = settings || [
		['string','title','Заголовок'],
		//['list','type','Тип перекрытия'],
		['date','date','Дата перекрытия'],
		['time','time','Примерное время'],
		['checkbox','tweet','Сообщить в твиттер']
	];
	
	//генерим шаблон редактирования настроек
	this.makeSettingsTemplate(settings);
	
	//вешаем события на метку
	//на открытие баллуна - редактирование настроек
	YMaps.Events.observe(this.placemark, this.placemark.Events.BalloonOpen, this.editSettings, this);
	
	//на закрытие баллуна - сохранение настроек
	YMaps.Events.observe(this.placemark, this.placemark.Events.BalloonClose, this.close, this);
	
};

Mark.prototype.setServer = function(server){
	//назначаем сервер
	this.server = server;
};

//список шаблонов для разных типов параметров
Mark.prototype.Templates = {
	edit:{
		//строка
		'string':'<input class="b-input b-mark-settings-string b-mark-%name%" onclick="return {type:\'string\',name:\'%name%\'}" name="%name%" type="text" value="" placeholder="%placeholder%" />',
		//дата
		'date':'<input class="b-input b-mark-settings-date b-mark-%name%" onclick="return {type:\'date\',name:\'%name%\'}" name="%name%" value="'+transform_date((new Date()),0,1)+'" placeholder="%placeholder%"/>',
		//время
		'time':'<input class="b-input b-mark-settings-string b-mark-%name%" onclick="return {type:\'string\',name:\'%name%\'}" name="%name%" type="text" value="" placeholder="%placeholder%" />',
		//ссылка
		'link':'<input class="b-input b-mark-settings-string b-mark-%name%" onclick="return {type:\'string\',name:\'%name%\'}" name="%name%" type="text" value="" placeholder="%placeholder%" />',
		
		'checkbox':'<label class="b-mark-settings-label"><input type="checkbox" class="b-input b-mark-settings-checkbox b-mark-%name%" onclick="return {type:\'checkbox\',name:\'%name%\'}" name="%name%" value="%name%" /> %placeholder%</label>',
		'list':'<select class="b-input b-mark-settings-list b-mark-%name%" onclick="return {type:\'list\',name:\'%name%\'}" name="%name%"><option value="escort">Кортеж</option><option value="dtp">ДТП</option><option value="alarm">ЧП</option><option value="work">Регулирование</option></select><div class="b-mark-list-data">'+
		'<div class="b-mark-settings-list-data b-mark-list-escort"></div>'+
		'<div class="b-mark-settings-list-data b-mark-list-dtp"></div>'+
		'<div class="b-mark-settings-list-data b-mark-list-alarm"></div>'+
		'<div class="b-mark-settings-list-data b-mark-list-work"></div>'+
		'</div>'
	},
	show:{
		//строка
		'string':'<span class="b-show b-mark-show-string b-mark-%name%">%%name%value%</span>',
		//дата
		'date':'<span class="b-show b-mark-%name%">%%name%value%</span>',
		//время
		'time':'<span class="b-show b-mark-show-string b-mark-%name%">%%name%value%</span>',
		'checkbox':'',
		'list':''
	}
};

Mark.prototype.makeSettingsTemplate = function(settings){
	var _this = this;
	_this.template = [
		'<div class="b-mark-settings"><form id="markSettings">', //шаблон для редактирование параметров метки
		'<div class="b-mark-show">' //шаблон для показа параметров метки
	];
	
	//проходим по списку необходимых параметров
	settings.forEach(function(val,i){
		//склеиваем html формы настроек
		//для редактирования
		_this.template[0] += (_this.Templates.edit[val[0]] || '').replace(/%name%/gi,val[1]).replace(/%placeholder%/gi,val[2]);
		
		//для отображения
		_this.template[1] += (_this.Templates.show[val[0]] || '').replace(/%name%/gi,val[1]);
	});
	
	_this.template[0] += '</form></div>';
	_this.template[1] += '</div>';
};

//отрисовка метки на карте
Mark.prototype.draw = function(map){
	map.addOverlay(this.placemark);
	
	//если у метки нет параметров - открывем баллун с редактированием
	if (!this.params){
		this.placemark.openBalloon();
	}else{
		//this.params.title && this.placemark.setIconContent(this.params.title);
	}
};

Mark.prototype.saveParams = function(){
	var $input = $("#markSettings").find('.b-input'), //.getRootNodes(),
		mark = this,
		params = {};

	//обрабатываем все поля настроек этой метки
	$input.each(function(){
		var $this = $(this),
			//получаем параметры поля
			setting = this.onclick(),
			value;
		
		//если это дата - значение получается по-другому
		if (setting.type == 'date'){
			value = $this.val();
		}else if (setting.type == 'checkbox'){
			value = $this.is(':checked')||false;
		}else{
		//по-дефолту считаем, что поле - инпут
			value = $this.val();
		}
		
		if (value){
		//если есть какое-то значение - сохраняем настройки
			//сохраняем текущее поле
			params[setting.name] = value;
			
			//если поле - заголовок, прописываем его в метку на карте
			if (setting.name == 'title'){
				//mark.placemark.setIconContent(value);
			}
		}
	});
	
	if (!params.title || !$input.length){
		return false;
	}
	
//    console.log("geocoder");
	
	params.sys_lat = mark.placemark.getGeoPoint().getLat();
	params.sys_lng = mark.placemark.getGeoPoint().getLng();
	
	mark.params = params;
	
	return true;
};
/*
Mark.prototype.setParams = function(){
	var $balloon = $("#markSettings"), //.getRootNodes(),
		mark = this; 
		
	if (!mark.params){
		return false;
	}

	//обрабатываем поля настроек этой метки
	$balloon.find('.b-input').each(function(){
		var $this = $(this),
			//получаем параметры поля
			setting = this.onclick(),
			//берём сохранённое значение этого поля
			value = mark.params[setting.name];
		
		//если это дата - значение получается по-другому
		if (setting.type == 'date'){
			$this.val(value);
		}else{
		//по-дефолту считаем, что поле - инпут
			$this.val(value);
		}
	});
};
*/

Mark.prototype.setParams = function(){
	var $balloon = $("#markSettings"),
		mark = this; 
		
	if (mark.params){
		return false;
	}

	// инициализируем настроек этой метки
	$balloon.find('.b-input').each(function(){
		var $this = $(this),
			//получаем параметры поля
			setting = this.onclick();
		
		//если это список - инициализируем
		if (setting.type == 'list'){
			$this.val(value);
		}
	});
};

Mark.prototype.showParams = function(){
	var template = this.template[1],
		value,
		param;
	
	//проставляем значения всех сохранённых параметров
	for (param in this.params){
		if (this.params[param]){
			/*if (param == 'date'){
				//переводим дату в человеческий вид
				value = parseInt(this.params[param],10);
				if (typeof (value) == 'number'){
					value = transform_date(*1000,1);
				}else{
					value = this.params[param];
				}
			}else{*/
				value = this.params[param];
			/*}*/
			template = template.replace('%'+param+'value%',value);
		}
	}
	
	//чистим метки для тех параметров, которые не были сохранены
	template = template.replace(/%[^%]+%/g,'');
	
	return template;
};

//отрисовка метки на карте
Mark.prototype.close = function(){
	var mark = this;
	//при закрытии баллуна пытаемся сохранить параметры метки
	if (this.saveParams()){
		//надо сохранить на сервере
		this.server.saveMark(this.params,function(){
			//console.log('saved!', arguments);
		},function(){
			alert('Простите, сохранить не получилось');
		});
	}else if (!this.params){
		//метка без параметров нам не нужна - удаляем
		this.placemark.getMap().removeOverlay(this.placemark);
	}
};

//удаление метки с карты
Mark.prototype.remove = function(){
	this.placemark.RemoveFromMap();
};

//редактирование метки
Mark.prototype.editSettings = function(){
	var isNew = this.params ? 0 : 1,
		template;
	//рисуем баллун с полями для конкретной метки
	
	if (isNew){
		//если это новая метка - берём шаблон редактирования
		template = this.template[0];
	}else{
		//если метка с параметрами - делаем шаблон отображения
		template = this.showParams();
	}
	
	this.placemark.setBalloonContent(template);

	this.setParams();
};