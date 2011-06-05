var net = require('net'),
bson = require('bson'),
sys = require('sys'),
events = require('events');
function MongoDB(dbname, host, port) {
	if (!this instanceof MongoDB) {
		return new MongoDB(dbname, host, port);
	}
	events.EventEmitter.call(this);
	this.dbname = dbname;
	var _=this;
	var reader = this.reader = new MongoDBReader();
	var writer = this.writer = new MongoDBWriter(dbname==undefined?'test':dbname);
	var con=this.con = net.createConnection(port == undefined ? 27017: port, host == undefined ? 'localhost': host);
	this.con.on('connect', function() {
		_.con.setEncoding('binary');
		_.emit('connect', null, {
			host: (host == undefined ? 'localhost': host),
			port: (port == undefined ? 27017: port),
			db: (dbname == undefined? 'test':dbname)
		});
	});
	this.con.on('error', function(err) {
		con.destroy();
		_.emit('error', err);
	});
	this.con.on('data', function(data) {
		console.log('receiving data');
		_.reader.appendData(data);
		var result = _.reader.read();
		if (result != - 1) {
			//TODO parse result here and use err if QueryFailed or CursorNotFound
			console.log('pushing result '+result.responseTo);
			_.emit('response_' + result.responseTo, null, result);
		}
	});
	this.close = function() {
		this.con.destroy();
	};
	process.on('exit', function() {
		_.close();
	});
	this.find = function(collection, callback, selector, options) {
		var packet = writer.query(selector == undefined ? {}: selector, options, collection);
		this.con.write(packet.data,'binary');
		console.log('sending packet '+packet.id);
		if (callback != undefined && callback != null) {
			this.on('response_' + packet.id, callback);
		}
	};
	this.runCommand = function(obj, callback) {
		this.find('$cmd', obj);
	};

}
sys.inherits(MongoDB, events.EventEmitter);
exports.use = function(dbname, host, port) {
	return function(func, nolock) {
		return function() {
			var args = [];
			for (var i = 0; i < arguments.length; i++) {
				args.push(arguments[i]);
			}
			var state = {
				reader: new bson.BinaryReader('')
			};
			return function(callback) {
				var con = net.createConnection(port == undefined ? 27017: port, host == undefined ? 'localhost': host);

				con.addListener('connect', function() {
					con.setEncoding('binary');
					var writer = new bson.BinaryWriter();
					var bsonData = bson.encode({
						$eval: func,
						args: args,
						nolock: (nolock == undefined ? true: nolock)
					});
					writer.writeInt32(1); //requestId
					writer.writeInt32( - 1); //reponseTo
					writer.writeInt32(2004); //OP_QUERY
					writer.writeInt32(0); //flags
					writer.writeZeroTermString(dbname + '.$cmd'); //collection name
					writer.writeInt32(0); //skip
					writer.writeInt32( - 1); //return
					var packet = writer.stream + bsonData;
					writer.stream = '';
					writer.writeInt32((packet.length) + 4); //packet length
					con.write(writer.stream + packet, 'binary');
				});
				con.addListener('error', function(err) {
					if (callback != undefined) {
						callback(err);
					}
					con.destroy();

				});
				con.addListener('data', function(data) {
					state.reader.stream += data;
					var reader = state.reader;
					if (reader.available() > 4) {
						reader.mark();
						var len = reader.readInt32();
						if (reader.available() >= len - 4) {
							var reqId = reader.readInt32();
							var responseTo = reader.readInt32();
							var opCode = reader.readInt32();
							var responseFlags = reader.readInt32();
							var cursorId = reader.readInt64();
							var startingFrom = reader.readInt32();
							var numberReturned = reader.readInt32();
							//	console.dir('len='+len+' reqId='+reqId+' responseTo='+responseTo+' opCode='+opCode+' flags='+
							//		responseFlags+' cursorId='+cursorId+' startingFrom='+startingFrom+' numberReturned='+numberReturned);
							var ar = [];
							for (var i = 0; i < numberReturned; i++) {
								ar.push(bson.decode(reader));
							}
							if (callback != undefined) {
								if (ar.length == 1 && ar[0]['errno'] != undefined) {
									callback(ar[0]);
								} else {
									callback(null, ar.length == 1 ? ar[0] : ar);
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
function MongoDBWriter(dbname) {
	if (!this instanceof MongoDBWriter) {
		return new MongoDBWriter(dbname);
	}
	this.requestId = 1;
	this.packet = function(body, code, flags, collection) {
		var writer = new bson.BinaryWriter();
		var requestId = this.requestId++;
		writer.writeInt32(requestId); //requestId
		writer.writeInt32( - 1); //reponseTo
		writer.writeInt32(code);
		writer.writeInt32(flags); //flags in OP_QUERY and ZERO for OP_UPDATE,OP_REMOVE etc
		writer.writeZeroTermString(collection); //collection name
		body(writer);
		var packet = writer.stream;
		writer.stream = '';
		writer.writeInt32((packet.length) + 4); //packet length
		return {
			id: requestId,
			data: writer.stream + packet
		};

	}
	this.update = function(selector, update, options, collection) {
		options = (options == undefined || options == null) ? {}: options;
		return this.packet(function(writer) {
			writer.writeInt32(options.flags == undefined ? 2: options.flags); //0 - Upsert 1-multiupdate 2-31 reserver
			writer.stream += bson.encode(selecter) + bson.encode(update);

		},
		2001, 0, dbname + '.' + collection);
	};
	this.insert = function(documents, options, collection) {
		options = (options == undefined || options == null) ? {}: options;
		return this.packet(function(writer) {
			for (var i = 0; i < documents.length; i++) {
				writer.stream += bson.encode(documents[i]);
			}

		},
		2002, options.flags == undefined ? 0: options.flags, dbname + '.' + collection);
	}
	this.query = function(obj, options, collection) {
		options = (options == undefined || options == null) ? {}: options;
		return this.packet(function(writer) {
			var bsonData = bson.encode(obj);
			if (options.filter != undefined) {
				bsonData += bson.encode(options.filter);
			}
			writer.writeInt32(options.skip == undefined ? 0: options.skip); //skip
			writer.writeInt32(options.ret == undefined ? 0 : options.ret); //return
			writer.stream += bsonData;
		},
		2004, options.flags == undefined ? 0: options.flags, dbname + '.' + collection);

	};
	this.more = function(cursorId, options, collection) {
		options = (options == undefined || options == null) ? {}: options;
		return this.packet(function(writer) {
			writer.writeInt32(options.ret == undefined ? 0: options.ret); //return
			writer.writeHexString(cursorId.substring(9, cursorId.length - 1)); //may be special cursorID will be used to store int64 as a string
		},
		2005, 0, dbname + '.' + collection);

	};
	this.remove = function(selector, options, collection) {
		options = (options == undefined || options == null) ? {}: options;
		return this.packet(function(writer) {
			writer.writeInt32(options.flags == undefined ? 0: options.flags); //bit 0 - single remove 
			writer.stream += bson.encode(selecter);

		},
		2006, 0, dbname + '.' + collection);
	};
	this.killCursors = function(cursors, collection) {
		return this.packet(function(writer) {
			writer.writeInt32(cursors.length);
			for (var i = 0; i < cursors.length; i++) {
				writer.writeInt64(cursors[i]);
			}
		});
	};

}
function MongoDBReader() {
	if (!this instanceof MongoDBReader) {
		return new MongoDBReader();
	}
	this.reader = null;
	this.appendData = function(data) {
		if (this.reader == null) {
			this.reader = new bson.BinaryReader(data);
		} else {
			this.reader.stream += data;
		}
	}
	this.read = function() {
		if (this.reader.available() > 4) {
			this.reader.mark();
			var len = this.reader.readInt32();
			if (this.reader.available() >= len - 4) {
				var response = {};
				response.reqId = this.reader.readInt32();
				response.responseTo = this.reader.readInt32();
				var opCode = this.reader.readInt32();
				if (opCode != 1) {
					throw new Error("Unknown opcode " + opCode);
				}
				response.opCode = opCode;
				var responseFlags = this.reader.readInt32();
				// bits 0x01 -CursorNotFound  0x02 - QueryFailed 0x04 - ShardConfigStale 0x08 - AwaitCapable
				//
				response.flagsRaw = responseFlags;
				response.flags = {
					cursorNotFound: (responseFlags & 1) > 0,
					queryFailed: (responseFlags & 2) > 0,
					shardConfigStale: (responseFlags & 4) > 0,
					awaitCapable: (responseFlags & 8) > 0
				};
				response.cursorId = 'CursorId(' + this.reader.readBytesAsHexString(8) + ')';
				response.startingFrom = this.reader.readInt32();
				response.numberReturned = this.reader.readInt32();
				var ar = [];
				for (var i = 0; i < response.numberReturned; i++) {
					ar.push(bson.decode(this.reader));
				}
				response.documents = ar;
				this.reader.compact();
				return response;
			} else {
				reader.reset();
				return - 1;
			}

		} else {
			return - 1;
		}
	}

}
var mongo = new MongoDB('test');
mongo.on('connect', function(err, result) {
	console.log('Connected');
	console.dir(result);
	mongo.find('test', function(err, result) {
		console.dir(result);
		mongo.close();

	},{},{ret:2});
});

mongo.on('error' , function(err, result) {
	console.dir(err);
});

