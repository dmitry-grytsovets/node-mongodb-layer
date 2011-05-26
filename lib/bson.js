function BinaryReader(stream) {
	if(!this instanceof BinaryReader) {
		return new BinaryReader(stream);
	}	
	this.offset=0;
	this.mark=0;
	this.reset=function() {
		this.offset=this.mark;
	};

	this.mark = function() {
		this.mark=this.offset;
	};

	this.available = function() {
		return stream.length-this.offset;
	};

	this.readByte = function() {
		if(this.available()==0) {
			throw new Error("No Data available");
		}
		//we must check char code and split it in bytes if code more than 0xFF
		var v=stream.charCodeAt(this.offset++) & 0xFF;
		return v;
	};

	this.readUTF8Char= function() {
		var c=this.readChar();
		if (c < 0x80) {
			return String.fromCharCode(c);
		} else if((c > 0xBF) && (c < 0xE0)) {
			c2 = this.readChar();
			return String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F));
		} else {
			c2 = this.readChar();
			c3 = this.readChar();
			return String.fromCharCode(((c & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F));
		}
	};

	this.readChar= function() {
		return stream.charCodeAt(this.offset++);
	};

	this.readInt32= function() {
		return this.readByte()+(this.readByte()<<8) + (this.readByte()<<16) +(this.readByte()<<24);  
	};
	this.readUInt32= function() {
		return this.readByte()+(this.readByte()<<8) + (this.readByte()<<16) +(this.readByte()<<23)*2;  
	};

	this.readInt64 = function() {
		var low = this.readUInt32();
		var high = this.readInt32();
		high = (high)* (1<<30)*2*2;
		return (low+high);
	};

	this.readDouble = function() {
		var low = this.readUInt32();
		var high = this.readInt32();

		var exponent = ((Math.abs(high) >> 20) & 0x7FF) - 1023;
		var mhigh = Math.abs(high) & 0xFFFFF;
		if (exponent == 1024) {
			return low == 0 && mhigh == 0 ? (high < 0 ? -Infinity : Infinity)
				: NaN;
		}

		var d = 1;
		for (i = 1; i < 53; i++) {
			var bitValue = Math.pow(2, -i);
			if (i <= 20) {
				if (mhigh & (1 << (20 - i))) {
					d += bitValue;
				}
			} else {
				if (low & (1 << (31 - (i - 21)))) {
					d += bitValue;
				}
				;
			}
		}
		d *= Math.pow(2, exponent);

		if (high < 0) {
			d *= -1;
		}
		return d;
	};

	this.readBytes=function(len) {
		var bin=stream.substring(this.offset,this.offset+len);	
		this.offset+=len;
		return bin;
	};

	this.readUntil=function(end) {
		var ei=stream.indexOf(end,this.offset);
		var ret=stream.substring(this.offset,ei);
		this.offset=ei+end.length;
		return ret;


	};

	this.readZeroTermString = function() {
		var ch8='\0';
		var ret='';
		do {
			ch8=this.readUTF8Char();
			if(ch8!='\0') {//ignore last 0x00
				ret+=ch8;
			}

		} while(ch8!='\0');

		return ret;
	};

	this.readUTF8String = function() {
		var len=this.readInt32();
		var end=len;
		var ret='';
		while(end>0) {
			var ch8=this.readUTF8Char();
			end-=Buffer.byteLength(ch8);			
			if(ch8>0||end!=0) {//ignore last 0x00
				ret+=ch8;
			}

		}

		return ret;
	};

	this.readBinary=function() {
		var len=this.readInt32();
		var type=this.readByte();
		//do something here
		var binary=this.readBytes(len);
		return binary;
	};

	this.readBoolean = function() {
		return this.readByte()==1;
	};

	this.readCodeWithScore = function() {
		var len = int32();
		var elem = this.readBytes(len-4);
		//do anything here
		return elem;
	};

	this.readFunction = function() {
		var src = this.readUTF8String();
		// handle pure logick and db usage here
		eval("var code=" + src);
		return code;
	}

	this._toString = function(n, radix) {
		return ((n >> 24) & 0xFF).toString(radix) + " "
			+ ((n >> 16) & 0xFF).toString(radix) + " "
			+ ((n >> 8) & 0xFF).toString(radix) + " "
			+ (n & 0xFF).toString(radix);
	};

}

function BinaryWriter() {
	if(!this instanceof BinaryWriter) {
		return new BinaryWriter();
	}	
	this.stream='';
	this.writeByte = function(b) {
		this.stream+=String.fromCharCode(b & 0xFF);
		return this;
	};
	this.writeInt32 = function(n) {
		this.stream+=String.fromCharCode(n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF,
				(n >> 24) & 0xFF);
		return this;
	};


	this.writeInt64 = function(l) {
		var low=l&0xFFFFFFFF;
		var high=(l - (l > 0 ? 1 : -1) * (l & 0xFFFFFFFF))
			/ ((1<<30) * 2*2) ;
		this.writeInt32(low).writeInt32(high);
		return this;
	};
	this.writeDouble = function(d) {
		if (isNaN(d) || d == Infinity || d == -Infinity) {
			if (d==Infinity||d==-Infinity) {
				this.writeInt32(0).writeInt32((d < 0 ? -1 : 1) * (2047 << 20));
			} else {
				this.writeInt32(0).writeInt32((2047 << 20) | (1 << 19));

			}
			return this;
		} else {
			var mantissa = Math.abs(d);
			var exponent = Math.floor(Math.log(mantissa) / Math.LN2);
			mantissa *= Math.pow(2, -exponent);
			exponent += 1023;
			if (mantissa > 2) {
				mantissa /= 2;
				exponent++;
			}
			if (mantissa < 1) {
				mantissa *= 2;
				exponent--;
			}
			var high = (exponent << 20);
			var low = 0;
			mantissa-=1;
			for ( var i = 1; i < 53; i++) {
				var bitValue = Math.pow(2, -i);

				if (mantissa >= bitValue) {
					mantissa -= bitValue;
					if (i <= 20) {
						high |= (1 << (20 - i));
					} else {
						low |= (1 << (31 - (i - 21)));
					}
				}
			}
			this.writeInt32(low).writeInt32((d < 0 ? 1 << 31 : 0) | high);
			return this;

		}
	},
		this.writeZeroTermString = function(s) {
			for ( var i = 0; i < s.length; i++) {
				if (s.charCodeAt(i) == 0x00) {
					throw new Error("cstring can't contains zero char");
				}else {
					this.writeUTF8CharCode(s.charCodeAt(i));
				}

			}
			this.writeByte('\0');
			return this;
		};
	this.writeUTF8CharCode=function(ch) {
		if (ch < 0x80) {
			this.writeByte(ch);
		}  else if((ch > 0x7F) && (ch < 0x800)) {
			this.writeByte((ch >> 6) | 0xC0);
			this.writeByte((ch & 0x3F) | 0x80);
		} else {
			this.writeByte((ch >> 12) | 224);
			this.writeByte(((ch >> 6) & 0x3F) | 0x80);
			this.writeByte((ch & 0x3F) | 0x80);
		}
		return this;
	};
	this.writeString = function(s) {
		this.writeInt32(Buffer.byteLength(s) + 1); 
		for(var i=0;i<s.length;i++) {
			this.writeUTF8CharCode(s.charCodeAt(i));
		}
		this.writeByte('\0');
		return this;
	};
	this.writeBinary = function(type, s) {
		this.writeInt32(Buffer.byteLength(s.length)).writeByte(type);
		for(var i=0;i<s.length;i++) {
			this.writeUTF8CharCode(s.charCodeAt(i));
		}
		return this;
	};
	this.writeBoolean = function(b) {
		this.writeByte(b?1:0);
		return this;
	};
	this._toString = function(n, radix) {
		return ((n >> 24) & 0xFF).toString(radix) + " "
			+ ((n >> 16) & 0xFF).toString(radix) + " "
			+ ((n >> 8) & 0xFF).toString(radix) + " "
			+ (n & 0xFF).toString(radix);
	};

}

exports.decode=function(stream) {
	var reader=(stream instanceof BinaryReader)?stream:new BinaryReader(stream);

	var map;
	var objectSet=function(obj,k,v) {
		obj[k]=v;
	};
	var arraySet=function(ar,k,v) {
		if(parseInt(k)!=ar.length) {
			throw new Error("Bad Array Index "+k+" when array length is "+ar.length);		
		}
		ar.push(v);
	};
	var readDocument=function(obj,set) {
		var len=reader.readInt32();
		do {
			var b = reader.readByte();
			if(b==0x00) {
				return obj;	
			} 
			var name=reader.readZeroTermString();
			var read = map[b];
			if (read == undefined) {
				throw new Error("Can't parse binary packet, unknown data type "
						+ b+' with name '+name);
			}
			var val=read();
			set(obj,name,val);

		} while (true);
		return obj;

	};
	map = {
		0x01 : 	function() {return reader.readDouble();},
		0x02 : function() {return reader.readUTF8String();},

		0x03 : function(){return readDocument({},objectSet)},//document

		0x04 : function(){return readDocument([],arraySet)},//array
		0x05 : function(){return reader.readBinary()},
		0x07 : function() {return reader.readBytes(12);},//read 12 byte of objectId
		0x08 :  function(){return reader.readBoolean();},
		0x09 :  function(){var d=new Date();d.setTime(reader.readInt64());return d;},
		0x0A :  function(){return null;},
		0x0B :  function(){return new RegExp(reader.readZeroTermString(),reader.readZeroTermString());},//RegExp
		0x0D :  function(){return reader.readFunction();},
		0x0E :  function(){return reader.readString();},
		0x0F : null,//code with scope
		0x10 :  function(){return reader.readInt32();},
		0x11 :  function(){return reader.readInt64();},//wrap as timestamp
		0x12 :  function(){return reader.readInt64();},
		0x00 : null//document end

	};
	var obj=readDocument({},objectSet);
	return obj;
}

exports.encode= function(jsobj,writer) {
	if(writer==undefined) writer=new BinaryWriter();
	var map;
	var duckMap;
	var writeKey=function(key,value) {
		var type=toString.call(value);
		if(value==null) type="null";
		var write=type in map?map[type]:map["[object Object]"];
		write(key,value);
	};

	var writeDocument=function(obj,writeChildren) {
		var mark=writer.stream.length;	
		writeChildren(obj);
		writer.writeByte(0);
		var doc=writer.stream.substring(mark);
		writer.stream=writer.stream.substring(0,mark);
		writer.writeInt32(doc.length);
		writer.stream+=doc;
	}
	var writeObject=function(obj) {
		var keys=Object.keys(obj);
		for(var i=0,e=keys.length;i<e;i++) {
			writeKey(keys[i],obj[keys[i]]);
		}

	};
	var writeArray=function(ar) {
		for(var i=0,e=ar.length;i<e;i++) {
			writeKey(i.toString(),ar[i]);
		}
	};
	map= {
		"[object Number]": function(key,value){ 
			if(value==Math.floor(value)&&(!isNaN(value)&&value!=Infinity&&value!=-Infinity)) {
				if(value==(value&0xFFFFFFFF)) {
					writer.writeByte(0x10).writeZeroTermString(key).writeInt32(value);
				} else {
					writer.writeByte(0x12).writeZeroTermString(key).writeInt64(value);
				}
			} else {
				writer.writeByte(0x01).writeZeroTermString(key).writeDouble(value);
			}
		},
		"[object String]" : function(key,value){writer.writeByte(0x02).writeZeroTermString(key).writeString(value);} ,
		"[object Object]" : function(key,value){writer.writeByte(0x03).writeZeroTermString(key);writeDocument(value,writeObject);},
		"[object Array]" : function(key,value){writer.writeByte(0x04).writeZeroTermString(key);writeDocument(value,writeArray);},
		"[object Boolean]" : function(key,value){writer.writeByte(0x08).writeZeroTermString(key).writeBoolean(value);},
		"[object RegExp]": function(key,value){
			writer.writeByte(0x0B).writeZeroTermString(key).writeZeroTermString(value.source).writeZeroTermString(value.toString().substring(value.source.length+2))
		},
		"null":function(key,value){writer.writeByte(0x0A).writeZeroTermString(key);},
		"[object Function]":function(key,value){writer.writeByte(0x0D).writeZeroTermString(key).writeString(value.toString());},
		"[object Date]":function(key,value){writer.writeByte(0x09).writeZeroTermString(key).writeInt64(value.getTime());}


	};
	writeDocument(jsobj,writeObject);
	return writer.stream;

}
exports.BinaryReader=BinaryReader;
exports.BinaryWriter=BinaryWriter;
