var net=require('net'),bson=require('bson');
exports.use=function(dbname) {
return function(func,callback) {
	var con=net.createConnection(27017,'localhost',function() {
		con.setEncoding('binary');	
	});
	con.addListener('error',function(err) {
		console.dir(err);
		con.destroy();
	});	
	con.addListener('data',function(data) {
		console.log(data);
	});
}
}
