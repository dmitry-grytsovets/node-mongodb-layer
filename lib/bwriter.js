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

	this.writeHexString = function(s) {
		for(var i=0;i<s.length/2;i++) {
			this.writeByte(parseInt(s.substring(i*2,i*2+2),16));
		}
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
exports.BinaryWriter=BinaryWriter;
