$().ready(function(){
    var nojs = $("#nojs").length,
        $window = $(window), $body = $('body'), $content = $('#content'), $index = $('#index'),
        $mapContainer = $('#map'),
        $search = $('#search'),
        $steps = $('.b-steps'),
        // создаём объект для общения с сервером
        g_inited = false,
        //классы элементов
        classNames = {
            mapFullScreen: 'b-map_full',
            bodyFullScreen: 'fullscreen'
        };
        
    //разные функции
    window.g_actions = {
        init:function(){
            $('.action').unbind('click').bind('click',function(e){
                var params = {};
                     
                if (typeof(this.onclick) == 'function'){
                    params = this.onclick();
                
                    if (params.action && typeof(g_actions[params.action]) == 'function'){
                        g_actions[params.action].call(this,params);
                    }
                }
                
                return false;
            });
        },
        login:function(params){
            g_actions.hideFirstStep();
            makeAuthWindow(params.provider,g_auth_retpath,function(user,html){
                g_user = user;

                g_actions.updatePage();

                g_actions.showFirstStep();
            });
        },
        logout:function(){
            g_actions.login({provider:'logout'});
        },
        switchFullScreen: function(params){
            var pixelCenter1 = g_map.converter.coordinatesToClientPixels(g_map.getCenter()),
                pixelCenter2,
                coordsCenter;
                
            if (params.on){
                $body.addClass(classNames.bodyFullScreen);
                $mapContainer.addClass(classNames.mapFullScreen);
                window.document.documentElement.scrollTop = 0;
                //ресайзим карту
                onResize();
                
                pixelCenter2 = g_map.converter.coordinatesToClientPixels(g_map.getCenter());
                
                pixelCenter1 = pixelCenter1.diff(pixelCenter2);
                pixelCenter2 = pixelCenter2.moveBy(pixelCenter1);
                
                coordsCenter = g_map.converter.clientPixelsToCoordinates(pixelCenter2);
                g_map.setCenter(coordsCenter);
                
                //вешаем событие на изменение размеров окна
                $window.bind('resize',onResize);
            } else {
                //снимаем событие на изменение размеров окна
                $(window).unbind('resize',onResize);
                //убираем ресайзы карты
                $mapContainer.removeClass(classNames.mapFullScreen).removeAttr('style');
                $body.removeClass(classNames.bodyFullScreen);
                
                //перерисовываем карту
                g_map.redraw();

                pixelCenter2 = g_map.converter.coordinatesToClientPixels(g_map.getCenter());

                pixelCenter1 = pixelCenter1.diff(pixelCenter2);
                pixelCenter2 = pixelCenter2.moveBy(pixelCenter1);
                
                coordsCenter = g_map.converter.clientPixelsToCoordinates(pixelCenter2);
                g_map.setCenter(coordsCenter);
            }
        },
        hideFirstStep:function(callback){
            if ($body.is('.b-second')){
                callback && callback();
                return false;
            }
            
            $steps.find('.b-step2').animate({'margin-left':-230},1000,callback);
            $steps.find('.b-step1').addClass('b-first-closed');
        },
        showFirstStep:function(callback){
            if ($body.is('.b-second') || !$steps.find('.b-step1').is('.b-first-closed')){
                callback && callback();
                return false;
            }
            
            $steps.find('.b-step2').animate({'margin-left':-23},1000,callback);
            $steps.find('.b-step1').removeClass('b-first-closed');
        },
        hideSteps:function(callback){
            if ($steps.is('.b-closed')){
                callback && callback();
                return false;
            }
            
            g_actions.showFirstStep(function(){
                $body.addClass('b-second');
                $steps.find('.b-step2,.b-step3').animate({'margin-left':-250},1000,callback);
                $steps.addClass('b-closed');
            });
        },
        showSteps:function(callback){
            if (!$steps.is('.b-closed')){
                callback && callback();
                return false;
            }
            
            $steps.find('.b-step2,.b-step3').animate({'margin-left':-23},1000,function(){
                $body.removeClass('b-second');
                $steps.removeClass('b-closed');
                callback && callback();
            });
        },
        addPoint: function(map,point,params){
            var mark = new Mark(point);
            
            mark.setServer(g_server);
            
            mark.params = params;
            
            mark.draw(map);
        },
        page:function(params,no_state){
            var page = params.page == '' ? 'index' : params.page,
                template = params.template || page;

            if (nojs){
                window.location = g_domain + '/'+params.page;
                return false;
            }
            g_actions.hideSteps();
            g_server.getPage(page,function(data){
                g_start_marks = data.marks ? JSON.parse(data.marks) || [] : [];

                if (template == 'news' && data.news && data.news.length == 1){
                    params.title = data.news[0].value.title || params.title;
                }
                dust.render(template,data,function(err,html){
                    if (!err){
                        window.setTimeout(function(){
                            g_actions.updatePage(params,html);
                        },0);
                        
                        g_actions.writeHistory(params,no_state);
                    }else{
                        window.location = g_domain + '/'+params.page;
                    }
                });
            },function(){
                window.location = g_domain + '/'+params.page;
            });
        },
        updateIndex:function(markscount){
            markscount = markscount || g_start_marks.length;
            dust.render('markscount',{
                marks_count:markscount,
                marks_word:word_end(['перекрытий','перекрытия','перекрытие'],markscount)
            },function(err,html){
                if (!err){
                    $("#marks_count").html(html);
                }else{
                    $("#marks_count").html('');
                }
            });
        },
        updatePage:function(params,html){
            var title;
            if (g_user){
                $('.b-username').html(g_user.name);
                $('.b-userinfo').removeClass('g-hidden');
                $('.b-login').addClass('g-hidden');
                $steps.addClass('b-authed');
            }else{
                $('.b-username').html('');
                $('.b-userinfo').addClass('g-hidden');
                $('.b-login').removeClass('g-hidden');
                $steps.removeClass('b-authed');
            }
            
            if(g_user && g_user.status >= 100){
                $('.b-admin-link').removeClass('g-hidden');
            }else{
                $('.b-admin-link').addClass('g-hidden');
            }
            
            if (params){
                if (nojs){
                    Init();
                }else{
                    $(".b-page-title").html(params.title);
                    $("title").html("Перекрыли"+ (params.title ? ": "+params.title : ''));
                    if (params.page == 'index' || params.page == '' || g_admin){
                        $body.addClass('b-index');
                        $content.html(html);
                        g_actions.updateIndex();
                        $index.slideDown(700,function(){
                            window.setTimeout(Init,100);
                        });
                        !g_admin && g_actions.showSteps();
                    }else{
                        $body.removeClass('b-index');
                        $index.slideUp(1000,function(){
                            $content.html(html);
                        });
                    }
                }
            }
            
            g_actions.init();
        },
        writeHistory:function(params,no_state){
            if (window.history && !no_state){
                window.history.pushState(params, params.title, '/'+params.page);
            }
        },
        getMarks: function(params){
            var data = {};
            params = params || {};
            
            if (params.today){
                params.from = (new Date((new Date()).toDateString())).getTime();
                params.till = (new Date(params.from)).getTime()+86400000;
                data = {
                    from: params.from,
                    till: params.till
                }
            }
            
            data.status = params.status || 'good';
            
            g_server.getMarks(data,function(response){
                var boundLB = {},
                    boundRT = {};
                    
                if (!response || !response.data){
                    return false;
                }
                
                g_actions.updateIndex(response.data.length);
                
                g_map.removeAllOverlays();
                
                if (!response.data.length){
                    return false;
                }
                
                boundLB.lng = response.data[0].value.lng;
                boundLB.lat = response.data[0].value.lat;
                
                boundRT.lng = response.data[0].value.lng;
                boundRT.lat = response.data[0].value.lat;
                
                response.data.forEach(function(val,i){
                    var geoPoint = new YMaps.GeoPoint(val.value.lng,val.value.lat),
                        markParams = {};
                    
                    if (boundLB.lng > val.value.lng){
                        boundLB.lng = val.value.lng;
                    }
                    if (boundLB.lat > val.value.lat){
                        boundLB.lat = val.value.lat;
                    }
                    
                    if (boundRT.lng < val.value.lng){
                        boundRT.lng = val.value.lng;
                    }
                    if (boundRT.lat < val.value.lat){
                        boundRT.lat = val.value.lat;
                    }
                    
                    markParams = val.value;
                    delete markParams.lat;
                    delete markParams.lng;
                    
                    g_actions.addPoint(g_map,geoPoint,markParams);
                });
                
                g_map.setBounds(
                    new YMaps.GeoBounds(
                        new YMaps.GeoPoint(boundLB.lng,boundLB.lat),
                        new YMaps.GeoPoint(boundRT.lng,boundRT.lat)
                    )
                );
                
                
            });
        }
    };
    
    window.g_map = false;
    window.g_server = new Server('/ajax/');
    
    function onResize(){
        var w,h;
        
        w = $window.width();
        //высота окна минус высота хедера
        h = $window.height() - $mapContainer.offset()['top'];
        
        //изменяем размеры
        $mapContainer.width(w).height(h);
        
        g_map && g_map.redraw();
    }

    function Init(){
        var toolbar,
            buttonFullScreen,
            buttonToday,
            trafficControl,
            style,
            position;

        if (!g_map && g_inited && ($body.is('.b-index') || g_admin)){
     /*создаём карту ======================= */
            position = new YMaps.GeoPoint(37.64,55.74);
            g_map = new YMaps.Map($mapContainer);
            
            if (YMaps.location) {
                position = new YMaps.GeoPoint(YMaps.location.longitude, YMaps.location.latitude);
            }
            
            /*
            if (navigator && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(result){
                    var newPosition = {
                        lat: result.coords.latitude,
                        lng: result.coords.longitude
                    };
                    
                    if (newPosition.lat && newPosition.lng){
                        position = new YMaps.GeoPoint(newPosition.lng,newPosition.lat);
                    }
                    
                    g_map.setCenter(position, 10);
                });
            }
            */
            
            /*создаём контрол пробок*/
            trafficControl = new YMaps.Traffic.Control({
                    //отключаем баллуны о пробках
                    layerOptions:{
                        hasBalloon: false,
                        cursor: YMaps.Cursor.INHERIT
                    },
                    //чекбокс Дорожных событий
                    showInfoSwitcher: true
                }, {
                    //показывать пробки при старте
                    shown: false,
                    //не показывать дорожные события при старте
                    infoLayerShown: false
                }
            );
            
            toolbar = new YMaps.ToolBar();
    
            // Создает кнопку дял fullscreen
            buttonFullScreen = new YMaps.ToolBarToggleButton({ 
                caption: "На весь экран"
            });
            
            // Если кнопка активна, разворачивает карту на весь экран
            YMaps.Events.observe(buttonFullScreen, buttonFullScreen.Events.Select, function () {
                g_actions.switchFullScreen({on:1});
            });
            
            // Если кнопка неактивна, устанавливает фиксированный размер карты
            YMaps.Events.observe(buttonFullScreen, buttonFullScreen.Events.Deselect, function () {
                g_actions.switchFullScreen({on:0});
            });
    
            //добавляем кнопку на тулбар
            toolbar.add(buttonFullScreen);
            
            //создаём кнопку сегодняшних событий
            buttonToday = new YMaps.ToolBarToggleButton({ 
                caption: "Перекрытия за весь день"
            });
            
            // по клику получаем метки за сегодня
            YMaps.Events.observe(buttonToday, buttonToday.Events.Select, function () {
                g_actions.getMarks({today:true});
            });
            
            // по второму клику - текущие метки
            YMaps.Events.observe(buttonToday, buttonToday.Events.Deselect, function () {
                g_actions.getMarks();
            });
            
            //добавляем кнопку на тулбар
            toolbar.add(buttonToday);
    
            //центр карты - Москва
            g_map.setCenter(position, 10);
            
            //добавляем контрол инструментов
            g_map.addControl(toolbar);
            
            //добавляем контрол зума
            g_map.addControl(new YMaps.Zoom());
            
            //добавляем контрол пробок в верхний правый угол с отступом 5px сверху и справа
            g_map.addControl(trafficControl, new YMaps.ControlPosition(YMaps.ControlPosition.TOP_RIGHT, new YMaps.Point(5, 5)));
            
            //включаем зум по колёсику
            g_map.enableScrollZoom();
            
            //инициализируем добавление меток
            YMaps.Events.observe(g_map, g_map.Events.Click, function(map, event){
                var point = event.getGeoPoint(),
                    geocoder = new YMaps.Geocoder(point,{results:1});

                YMaps.Events.observe(geocoder, geocoder.Events.Load, function () {
                    if (this.length()){
                        $search.find('input').val(this.get(0).text);
                    }
                });
                
                if (g_user && g_user.status > 0){
                    g_actions.addPoint(map,event.getGeoPoint());
                }
            });
            
            style = new YMaps.Style();
            
            style.iconStyle = new YMaps.IconStyle();
            
            style.iconStyle.href = "/i/icon.gif";
            style.iconStyle.size = new YMaps.Point(30, 30);
            style.iconStyle.offset = new YMaps.Point(-15, -20);
            
            YMaps.Styles.add('perekrili#icon',style);
            
    //карта готова =======================
            
            //инициализируем строку поиска
            $search.submit(function(){
                var text = $search.find('input').val() || '',
                    geocoder;
                
                if (text){
                    geocoder = new YMaps.Geocoder(text);
                    
                    YMaps.Events.observe(geocoder, geocoder.Events.Load, function () {
                        if (this.length()){
                            
                            g_map.panTo(this.get(0).getGeoPoint(),{
                                flying: !!!nojs,
                                callback: function(){
                                    g_map.setZoom(10,{
                                        smooth: true
                                    });
                                }
                            });
                        }
                    });
                    YMaps.Events.observe(geocoder, geocoder.Events.Fault, function (geocoder, errorMessage) {
                        alert("Произошла ошибка: " + errorMessage)
                    });
                }
                
                return false;
            });
            
            if (g_start_marks && g_start_marks.forEach){
                g_start_marks.forEach(function(val,i){
                    g_actions.addPoint(g_map,new YMaps.GeoPoint(val.value.lng,val.value.lat),{
                        title:val.value.title,
                        date:val.value.date,
                        time:val.value.time,
                        sys_lat:val.value.lat,
                        sys_lng:val.value.lng
                    });
                });
            }
        }
        
        if (!g_inited){
            window.addEventListener('popstate', function(e){
                var params = e.state || {
                    page:'',
                    title:''
                };
                
                if (e.state || window.location.pathname == '/'){
                    g_actions.page(params,true);
                }
            }, false);
            
            //инициализируем линки действий
            g_actions.init();

            if ($body.is('.b-index') || g_admin){
                window.setTimeout(function(){
                    g_actions.updatePage({page:'',title:g_admin ? 'Админка' : ''});
                },1000);
            }
            
            g_inited = true;
        }
    }
    
    //Поехали!
    Init();
});