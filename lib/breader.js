/**
 * Creates new BinaryReader
 * @author Grytsovets Dmitry
 * @constructor
 * @param {binary string} 
 * @return new BinaryReader 
 * @version 0.0.1
 *
 */
function BinaryReader(data) {
	if(!this instanceof BinaryReader) {
		return new BinaryReader(data);
	}	
	this.stream=data;
	this.offset=0;
	this.mark=0;
	/**
	 * reset mark
	 */
	this.reset=function() {
		this.offset=this.mark;
		this.mark=0;
	};
	/**
	 * set mark to current position
	 */
	this.mark = function() {
		this.mark=this.offset;
	};
	/**
	 * @return {number} bytes available in source binary string 
	 */
	this.available = function() {
		return this.stream.length-this.offset;
	};
	/**
	 * set binary string base to current position this.stream=this.stream.substring(this.offset);
	 */
	this.compact=function() {
		this.stream=this.stream.substring(this.offset);
		this.mark=0;
		this.offset=0;
	}
	/**
	 * @return {byte} 
	 */
	this.readByte = function() {
		if(this.available()==0) {
			throw new Error("No Data available");
		}
		//we must check char code and split it in bytes if code more than 0xFF
		var v=this.stream.charCodeAt(this.offset++) & 0xFF;
		return v;
	};
	/**
	 * @return {utf-8 char}
	 */
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
	/**
	 * @return {binary char}
	 */
	this.readChar= function() {
		return this.stream.charCodeAt(this.offset++);
	};
	/**
	 * @return {number}
	 */
	this.readInt32= function() {
		return this.readByte()+(this.readByte()<<8) + (this.readByte()<<16) +(this.readByte()<<24);  
	};
	/**
	 * @return {number}
	 */
	this.readUInt32= function() {
		return this.readByte()+(this.readByte()<<8) + (this.readByte()<<16) +(this.readByte()<<23)*2;  
	};
	/**
	 * @return {number} javascript number can be overflowed by big int64
	 */
	this.readInt64 = function() {
		var low = this.readUInt32();
		var high = this.readInt32();
		high = (high)* (1<<30)*2*2;
		return (low+high);
	};
	/**
	 * @return {number} 
	 */
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
	/**
	 * @param {number} length of returned binary string
	 * @return {binary string}
	 */
	this.readBytes=function(len) {
		var bin=this.stream.substring(this.offset,this.offset+len);	
		this.offset+=len;
		return bin;
	};
	/**
	 * @param {number} length of binary data
	 * @return {hex encoded binary string}
	 */
	this.readBytesAsHexString=function(len) {
		var hex='';
		for(var i=0;i<len;i++) {
			var ch=this.readByte().toString(16);
			if(ch.length==1) {
				ch='0'+ch;
			}
			hex+=ch;
		}
		return hex;
	};
	/**
	 * @param {string} delimiter tp read binary data until it
	 * @return {binary string}
	 */
	this.readUntil=function(end) {
		var ei=this.stream.indexOf(end,this.offset);
		var ret=this.stream.substring(this.offset,ei);
		this.offset=ei+end.length;
		return ret;


	};
	/**
	 * @return {zero terminated binary string}
	 */
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
	/**
	 * @return {zero terminated utf-8 string}
	 */
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
	/**
	 * @return {length encoded binary}
	 */
	this.readBinary=function() {
		var len=this.readInt32();
		var type=this.readByte();
		//do something here
		var binary=this.readBytes(len);
		return binary;
	};
	/**
	 * @return {boolean}
	 */
	this.readBoolean = function() {
		return this.readByte()==1;
	};
	/**
	 * @return {function}
	 */
	this.readCodeWithScope = function() {
		var len = int32();
		var elem = this.readBytes(len-4);
		//do anything here
		return elem;
	};
	/**
	 * @return {function}
	 */
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
exports.BinaryReader=BinaryReader
