var bson=require('bson'),assert=require('assert');
	
var o={ 
	bl:true, b1:false, a2:1.333,a3:11111112312312312,a1:null,
	hello:"world",a:-1,b:{z:3,a:"привет утф8 あ",ar:[123,234]},
	d:new Date(),r:/[a]/gi,f:function(a){return a+1;}};
var e=bson.encode(o);
var d=bson.decode(e);
assert.deepEqual(o.r.toString(),d.r.toString());
assert.deepEqual(o.f.toString(),d.f.toString());
delete o['f'];
delete d['f'];
delete o['r'];
delete d['r'];
assert.deepEqual(o,d);
//assert.eql(JSON.stringify(o1),JSON.stringify(bson.decode(bson.encode(o1))));
