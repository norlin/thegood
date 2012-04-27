/*jslint browser: true, sloppy: true, white: true, maxerr: 50, indent: 4 */
(function (window, $) {
	$().ready(function () {
		var nojs = $("#nojs").length,
			$body = $('body'),
			// создаём объект для общения с сервером
			g_inited = false;
			
		function Init() {
			/*
			if (!g_inited) {
				window.addEventListener('popstate', function (e) {
					var params = e.state || {
						page:'',
						title:''
					};
					
					if (e.state || window.location.pathname === '/') {
						g_actions.page(params,true);
					}
				}, false);
				
				//инициализируем линки действий
				g_actions.init();

				if ($body.is('.b-index') || g_admin) {
					window.setTimeout(function () {
						g_actions.updatePage({page:'',title:g_admin ? 'Админка' : ''});
					},1000);
				}
				
				g_inited = true;
			}
			*/

			g_actions.init();
		}

		//разные функции
		window.g_actions = {
			init:function () {
				$('.action').unbind('click').bind('click',function () {
					var params = {};
						 
					if (typeof(this.onclick) === 'function') {
						params = this.onclick();
					
						if (params.action && typeof(g_actions[params.action]) === 'function') {
							g_actions[params.action].call(this,params);
						}
					}
					
					return false;
				});
			},
			login:function (params) {
				makeAuthWindow(params.provider,params.client,g_auth_retpath,function (user) {
					g_user = user;

					g_actions.updatePage();
				});
			},
			logout:function () {
				g_actions.login({provider:'logout'});
			},
			addPoint: function (map,point,params) {
				var mark = new Mark(point);
				
				mark.setServer(g_server);
				
				mark.params = params;
				
				mark.draw(map);
			},
			/*page:function (params,no_state) {
				var page = params.page === '' ? 'index' : params.page,
					template = params.template || page;

				if (nojs) {
					window.location = g_domain + '/'+params.page;
					return false;
				}

				g_server.getPage(page,function (data) {
					g_start_marks = data.marks ? JSON.parse(data.marks) || [] : [];

					if (template === 'news' && data.news && data.news.length === 1) {
						params.title = data.news[0].value.title || params.title;
					}
					dust.render(template,data,function (err,html) {
						if (!err) {
							window.setTimeout(function () {
								g_actions.updatePage(params,html);
							},0);
							
							g_actions.writeHistory(params,no_state);
						}else{
							window.location = g_domain + '/'+params.page;
						}
					});
				},function () {
					window.location = g_domain + '/'+params.page;
				});
			},*/
			updateIndex:function () {
				/* */
			},
			updatePage:function (params,html) {
				window.location.reload();

				return;
				/*if (g_user) {
					$('.b-username').html(g_user.name);
					$('.b-userinfo').removeClass('g-hidden');
					$('.b-login').addClass('g-hidden');
				}else{
					$('.b-username').html('');
					$('.b-userinfo').addClass('g-hidden');
					$('.b-login').removeClass('g-hidden');
				}
				
				if(g_user && g_user.status >= 100) {
					$('.b-admin-link').removeClass('g-hidden');
				}else{
					$('.b-admin-link').addClass('g-hidden');
				}
				
				Init();
				
				g_actions.init();*/
			},
			writeHistory:function (params,no_state) {
				if (window.history && !no_state) {
					window.history.pushState(params, params.title, '/'+params.page);
				}
			}
		};
		
		window.g_server = new Server('/ajax/');
		
		//Поехали!
		Init();
	});
}(window,jQuery));