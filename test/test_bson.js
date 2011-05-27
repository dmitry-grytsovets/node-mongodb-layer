exports.test=function () {
var bson=require('bson'),assert=require('assert');
	
var o={ 
	bool:true,bool1:false,a2:1.333,a3:11111112312312312,a1:null,
	hello:"world",a:1,b:{z:3,a:"привет утф8 あ",ar:[123,234]},
	d:new Date()};
var e=bson.encode(o);
var d=bson.decode(e);
assert.eql(o,d);
var o1={ nan:NaN,inf:Infinity,minf:-Infinity,
	bool:true,bool1:false,a2:1.333,a3:11111112312312312,a1:null,
	hello:"world",a:1,b:{z:3,a:"привет утф8 あ",ar:[123,234],r:/[a]/ig},
	f:function(a){return a+1;},d:new Date()
	};
assert.eql(JSON.stringify(o1),JSON.stringify(bson.decode(bson.encode(o1))));
}
