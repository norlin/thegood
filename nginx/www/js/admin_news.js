include('tiny_mce/jquery.tinymce.js');

$().ready(function(){
	var $admin = $('.b-admin'),
		$editor = $("#newsEditor");
	if (!g_server){
		return false;
	}
	
	g_server.saveNews = function(news,callback,error){
		var data = {
			news: news
		};
		
		this.post('save_news',data,callback,error);
	};
	
	g_actions.saveNews = function(params){
		var data = {},
			$form = $('#news_form'),
			$title = $form.find('[name=title]');
		
		if (params.id){
			data.id = params.id;
		}
		data.title = $title.val();
		data.text = $editor.tinymce().getContent();
		data.description = $("#newsEditor").text();
		
		data.description = data.description.replace(/(\&[^;\s]*;)|\n/gi,' ').replace(/\s+/gi,' ');
		if (data.description.length > 100){
			data.description = data.description.slice(0,200) + '...';
		}
		
		g_server.saveNews(data,function(response){
			if (!response || !response.data){
				alert('не получилось сохранить новость!');
				return;
			}
			
			window.location.reload();
		},function(err){
			alert('не получилось сохранить новость!');
		});
	};
	
	g_actions.init();
	
	//tiny_mce
	
	$editor.tinymce({
		script_url: '/js/tiny_mce/tiny_mce.js',
		theme : "advanced",
		plugins : "media,inlinepopups", 
				
		// Theme options - button# indicated the row# only
		theme_advanced_buttons1 : ",undo,redo,|,link,unlink,anchor,|,image,media,|,justifyleft,justifycenter,justifyright",
		theme_advanced_buttons2 : "bold,italic,underline,|,forecolor,fontsizeselect,formatselect,|,bullist,numlist,code",     
		theme_advanced_buttons3 : "",     
		theme_advanced_toolbar_location : "top",
		theme_advanced_toolbar_align : "left",
		theme_advanced_resizing : true
	});
});