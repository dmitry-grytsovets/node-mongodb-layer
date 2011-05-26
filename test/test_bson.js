exports.test=function () {
var bson=require('bson');
var e=bson.encode({a2:1.333,a3:11111112312312312,a1:null,hello:"world",a:1,b:{z:3,a:"привет утф8",ar:[123,234],r:/[a]/ig}});
console.dir(e);
console.dir(bson.decode(e))
}
