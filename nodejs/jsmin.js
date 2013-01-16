var sys = require('util'),
	fs = require('fs'),
	path = require('path'),
	exec = require('child_process').exec,

	regexp = {
		js:/include\(\'([^\']*)\'\)/,
		css:/@import\surl\(\"([^\"]*)\"\)/
	},

	result;

function parseFile(file,ext){
	var dir = path.dirname(file),
		lines = [],
		data;

	sys.print('.');

	data = fs.readFileSync(file,'utf8');

	data = data.split(/\n/);

	data.forEach(function(val,i){
		include = val.match(regexp[ext]);

		if (include && include[1]){
			lines = lines.concat(parseFile(dir+'/'+include[1],ext));
		}else{
			lines.push(val);
		}
	});

	return lines;
}


exports.minify = function(todo,no_compress){
	var dir = path.dirname(todo),
		ext = path.extname(todo).replace('.',''),
		name = path.basename(todo);

	result = parseFile(todo,ext);
	result = result.join('\n');

	fs.writeFileSync(dir+'/_'+name,result);

	if (!no_compress){
		if (ext == '.js'){
			exec('/sites/jsmin < ' + dir+'/_'+name + ' > '+dir+'/__'+name,function(){
				exec('mv '+dir+'/__'+name+' '+dir+'/_'+name);
			});
		}else{
			exec('java -jar /sites/yuic.jar -o "' + dir+'/__'+name + '" '+dir+'/_'+name,function(){
				exec('mv '+dir+'/__'+name+' '+dir+'/_'+name);
			});
		}
	}
};