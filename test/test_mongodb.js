var fs=require('fs');
var bson=require('bson');
var readPacket=function(reader) {
	var len=reader.readInt32()
		var reqId=reader.readInt32()
		var responseTo=reader.readInt32()
		var opCode=reader.readInt32();
	console.log('opcode='+opCode);
	var flags=reader.readInt32();
	var collectionName=reader.readZeroTermString();
	var skip=reader.readInt32();
	var ret=reader.readInt32();

	console.log('len='+len+' name='+collectionName+' skip='+skip+' ret= '+ret);

	console.dir(bson.decode(reader));
	console.log(reader.offset);

};
fs.readFile('dump','binary',function (err, data) {
	  if (err) throw err;
	  if(Buffer.byteLength(data)>=4) {
	    	var reader=new bson.BinaryReader(data);
		while(reader.available()>0) {
			readPacket(reader);
		}
	  } 
});

