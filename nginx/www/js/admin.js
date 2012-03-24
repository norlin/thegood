$().ready(function(){
	var $admin = $('.b-admin');
	if (!g_server){
		return false;
	}
	
	g_server.saveAdminMarks = function(marks,callback,error){
		var data = {
			marks: marks
		};
		
		this.post('admin_update_marks',data,callback,error);
	};
	
	$admin.submit(function(e){
		e.preventDefault();
	});
	
	$admin.find('.b-mark-checkbox:checked').removeAttr('checked');
	
	g_actions.getMarks = function(params){
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
		
		if (params.all){
			data.all = true;
		}
		
		params.status = params.status || 'good';
		data.status = params.status;
		
		g_server.getMarks(data,function(response){
			var dustData;
			
			if (!response && !response.data){
				return false;
			}
			g_map.removeAllOverlays();
			
			dustData = {
				user:{
					'is_admin':true
				},
				adminMarks:response.data
			};
			
			dust.render('admin',dustData,function(err,html){
				if (!err){
					window.setTimeout(function(){
						g_actions.updatePage({page:'admin',title:'Админка'},html);
						
						$(".b-admin-data").html('<p>Количество меток: '+response.data.length+'</p>');
					},0);
					
				}else{
					window.location = g_domain + '/'+params.page;
				}
			});
			
			response.data.forEach(function(val,i){
				var geoPoint = new YMaps.GeoPoint(val.value.lng,val.value.lat);
				params = val.value;
				delete params.lat;
				delete params.lng;
				
				g_actions.addPoint(g_map,geoPoint,params);
			});
		});
	};
	
	g_actions.saveMarks = function(params){
		var data = {},
			status = params.status;
		
		$admin = $('.b-admin');
		
		$admin.find('.b-error').removeClass('b-error');
		
		$admin.find('.b-mark-checkbox:checked').each(function(){
			var id = $(this).val();

			if (id){
				data[id] = status;
			}
		});
		
		g_server.saveAdminMarks(data,function(response){
			if (response && response.data && response.data.length){
				response.data.forEach(function(val){
					$("#b-mark_"+val).remove();
				});
			}
			
			$admin.find('.b-mark-checkbox:checked').parents('.b-admin-list-item').addClass('b-error');
		},function(err){
			$admin.find('.b-mark-checkbox:checked').parents('.b-admin-list-item').addClass('b-error');
		});
	};
	
	g_actions.saveMark = function(params){
		var data = {};
			
		data[params.id] = params.status;
		
		g_server.saveAdminMarks(data,function(response){
			if (!response || !response.data || !response.data.length){
				$('#b-mark_'+params.id).addClass('b-error');
				return
			}
			
			$('#b-mark_'+response.data[0]).remove();
		},function(err){
			$('#b-mark_'+params.id).addClass('b-error');
		});
	};
	
	g_actions.init();
});