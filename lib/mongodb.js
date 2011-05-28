var net=require('net'),bson=require('bson');
exports.use=function(dbname,host,port) {
	return function(func,nolock) {
		return function() {
			var args=[];
			for(var i=0;i< arguments.length;i++) {
				args.push(arguments[i]);
			}
			var state={reader:new bson.BinaryReader('')};
			return function(callback) {
				var con=net.createConnection(port==undefined?27017:port,host==undefined?'localhost':host);

				con.addListener('connect',function() {
					con.setEncoding('binary');
					var writer=new bson.BinaryWriter();
					var bsonData=bson.encode({$eval:func,args:args,nolock:(nolock==undefined?true:nolock)});
					writer.writeInt32(1);//requestId
					writer.writeInt32(-1);//reponseTo
					writer.writeInt32(2004);//OP_QUERY
					writer.writeInt32(0);//flags
					writer.writeZeroTermString(dbname+'.$cmd');//collection name
					writer.writeInt32(0);//skip
					writer.writeInt32(-1);//return
					var packet=writer.stream+bsonData;
					writer.stream='';
					writer.writeInt32((packet.length)+4);//packet length
					con.write(writer.stream+packet,'binary');
				});
				con.addListener('error',function(err) {
					if(callback!=undefined) {
						callback(err);
					}
					con.destroy();

				});	
				con.addListener('data',function(data) {
					state.reader.stream+=data;
					var reader=state.reader;
					if( reader.available()>4) {
						reader.mark();
						var len=reader.readInt32();
						if(reader.available()>=len-4) {
							var reqId=reader.readInt32();
							var responseTo=reader.readInt32();
							var opCode=reader.readInt32();
							var responseFlags=reader.readInt32();
							var cursorId=reader.readInt64();
							var startingFrom=reader.readInt32();
							var numberReturned=reader.readInt32();
							//	console.dir('len='+len+' reqId='+reqId+' responseTo='+responseTo+' opCode='+opCode+' flags='+
							//		responseFlags+' cursorId='+cursorId+' startingFrom='+startingFrom+' numberReturned='+numberReturned);
							var ar=[];
							for(var i=0;i<numberReturned;i++) {
								ar.push(bson.decode(reader));
							}
							if(callback!=undefined)	{
								if(ar.length==1&&ar[0]['errno']!=undefined) {
									callback(ar[0]);
								} else {
								callback(null,ar.length==1?ar[0]:ar);
								}

							}
							con.destroy();
						} else {
							reader.reset();
						}

					}
				});

			}
	}
	}
}

