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
function use(dbname) {
	var collection='';
	var requestId=1;
	this.packet=function(body,code,flags,collectionName) {
		var writer=new bson.BinaryWriter();
		writer.writeInt32(requestId++);//requestId
		writer.writeInt32(-1);//reponseTo
		writer.writeInt32(code);
		writer.writeInt32(flags);//flags in OP_QUERY and ZERO for OP_UPDATE,OP_REMOVE etc
		writer.writeZeroTermString(collectionName);//collection name
		body(writer);
		var packet=writer.stream;
		writer.stream='';
		writer.writeInt32((packet.length)+4);//packet length
		return writer.stream+packet;

	}
	this.update=function(selector,update,options) {
		options=(options==undefined||options==null)?{}:options;
		return this.packet(function(writer) {
			writer.writeInt32(options.flags==undefined?2:options.flags);//0 - Upsert 1-multiupdate 2-31 reserver
			writer.stream+=bson.encode(selecter)+bson.encode(update);

		},2001,0,dbname+'.'+collection);
	};
	this.insert=function(documents,options) {
		options=(options==undefined||options==null)?{}:options;
		return this.packet(function(writer) {
			for(var i=0;i<documents.length;i++) {
				writer.stream+=bson.encode(documents[i]);
			}

		},2002,options.flags==undefined?0:options.flags,dbname+'.'+collection);
	}
	this.query = function(obj,options) {
		options=(options==undefined||options==null)?{}:options;
		return this.packet(function(writer) {
			var bsonData=bson.encode(obj);
			if(options.filter!=undefined) {
				bsonData+=bson.encode(options.filter);
			}
			writer.writeInt32(options.skip==undefined?0:options.skip);//skip
			writer.writeInt32(options.ret==undefined?-1:options.ret);//return
			writer.stream+=bsonData;
		},2004,options.flags==undefined?0:options.flags,dbname+'.'+collection);

	};
	this.more = function(cursorId,options) {
		options=(options==undefined||options==null)?{}:options;
		return this.packet(function(writer) {
			writer.writeInt32(options.ret==undefined?-1:options.ret);//return
			writer.writeInt64(cursorId);//may be special cursorID will be used to store int64 as a string
		},2005,0,dbname+'.'+collection);


	};
	this.remove=function(selector,options) {
		options=(options==undefined||options==null)?{}:options;
		return this.packet(function(writer) {
			writer.writeInt32(options.flags==undefined?0:options.flags);//bit 0 - single remove 
			writer.stream+=bson.encode(selecter);

		},2006,0,dbname+'.'+collection);
	};
	this.killCursors=function(cursors) {
		return this.packet(function(writer) {
			writer.writeInt32(cursors.length);
			for(var i=0;i<cursors.length;i++) {
				writer.writeInt64(cursors[i]);
			}
		});
	};

}
