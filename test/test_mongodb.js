var mongodb=require('mongodb'),assert=require('assert');
var test=mongodb.use('test','localhost',27017);
var o={ 
	bl:true, b1:false, a2:1.333,a3:11111112312312312,a1:null,
	hello:"world",a:-1,b:{z:3,a:"привет утф8 あ",ar:[123,234]},
	d:new Date(),r:/[a]/gi,f:function(a){return a+1;}};

var saveAndLoad=test(function(a){
	db.test_mongodb_layer.remove({});
	db.test_mongodb_layer.save(a);
	var res=[];
	db.test_mongodb_layer.find().forEach(function(i){res.push(i)});
	return res;
});
var remove=test(function(a){
	db.test_mongodb_layer.remove(a);
	var res=[];
	db.test_mongodb_layer.find().forEach(function(i){res.push(i)});
	return res;
});
saveAndLoad(o)(function(err,result) {
	assert.deepEqual(err,null);
	var ret=result.retval[0];
	assert.deepEqual(ret.f(1),o.f(1));
	delete ret['f'];
	remove(ret)(
		function(err2,result2) {
			assert.deepEqual(err2,null);
			assert.deepEqual(result2,{retval:[],ok:1});
			delete ret['_id'];
			delete o['f'];
			assert.deepEqual(ret,o);

		});
});
