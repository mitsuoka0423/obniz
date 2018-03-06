
class PeripheralI2C {

  constructor(Obniz, id) {
    this.Obniz = Obniz;
    this.id = id;
    this.observers = [];
    this.state = {};
    this.used = false;
  
    this.onwritten = undefined;
  }

  addObserver(callback) {
    if(callback) {
      this.observers.push(callback);
    }
  }
  
  start(arg) {
    var err = ObnizUtil._requiredKeys(arg,["mode", "sda", "scl"]);
    if(err){ throw new Error("I2C start param '" + err +"' required, but not found ");return;}
    this.state = ObnizUtil._keyFilter(arg,["mode", "sda", "scl", "pull"]);
    
    var mode = this.state.mode;
    var clock = (typeof arg.clock === "number") ? parseInt(arg.clock) : null;
    var slave_address = (typeof arg.slave_address === "number") ? parseInt(arg.slave_address) : null;
    var slave_address_length = (typeof arg.slave_address_length === "number") ? parseInt(arg.slave_address_length) : null;
    
    if (mode !== "master" && mode !== "slave") {
      throw new Error("i2c: invalid mode "+mode)
    }
    if (mode === "master") {
      if (clock === null) {
        throw new Error("i2c: please specify clock when master mode");
      }
      if (clock <= 0 || clock > 1 * 1000 * 1000) {
        throw new Error("i2c: invalid clock " + clock);
      }
      if (typeof arg.pull === "5v" && clock > 400 * 1000) {
        throw new Error("i2c: please use under 400khz when internal 5v internal pull-up");
      }
      if (typeof arg.pull === "3v" && clock > 100 * 1000) {
        throw new Error("i2c: please use under 100khz when internal 3v internal pull-up");
      }
    } else {
      if (slave_address === null) {
        throw new Error("i2c: please specify slave_address");
      }
      if (slave_address < 0 || slave_address > 0x3FFF) {
        throw new Error("i2c: invalid slave_address");
      }
      if (slave_address < 0 || slave_address > 0x3FFF) {
        throw new Error("i2c: invalid slave_address");
      }
      if (slave_address_length !== null && slave_address_length !== 7 && slave_address_length !== 10) {
        throw new Error("i2c: invalid slave_address_length. please specify 7 or 10");
      }
    }
  
    this.Obniz.getIO(this.state.sda).drive("open-drain");
    this.Obniz.getIO(this.state.scl).drive("open-drain");
    
    if(this.state.pull){
       this.Obniz.getIO(this.state.sda).pull(this.state.pull);
       this.Obniz.getIO(this.state.scl).pull(this.state.pull);
    }else{
      this.Obniz.getIO(this.state.sda).pull(null);
      this.Obniz.getIO(this.state.scl).pull(null);
    }
    
    var startObj = ObnizUtil._keyFilter(this.state,["mode", "sda", "scl"]);
    if (mode === "master") {
      startObj.clock = clock;
    } else {
      startObj.slave_address = slave_address;
      if (slave_address_length) {
        startObj.slave_address_length = slave_address_length;
      }
    }
  
    var obj = {}; 
    obj["i2c"+this.id] = startObj;
    this.used = true;
    this.Obniz.send(obj);
  }

  write(address, data) {
    address = parseInt(address)
    if (isNaN(address)) {
      throw new Error("i2c: please specify address")
    }
    if (address < 0 || address > 0x3FFF) {
      throw new Error("i2c: invalid address")
    }
    if (address > 0x7F) {
      address = address | 0x8000; // mark 10bit mode
    }
    if (!data) {
      throw new Error("i2c: please provide data");
    }
    if (data.length > 1024) {
      throw new Error("i2c: data should be under 1024 bytes");
    }
    var obj = {};
    obj["i2c"+this.id] = {
      address,
      data
    };
    this.Obniz.send(obj);
  }

  write10bit(address, data) {
    return this.write(address | 0x8000, data);
  }

  readWait(address, length) {
    address = parseInt(address)
    if (isNaN(address)) {
      throw new Error("i2c: please specify address")
    }
    if (address < 0 || address > 0x3FFF) {
      throw new Error("i2c: invalid address")
    }
    if (address > 0x7F) {
      address = address | 0x8000; // mark 10bit mode
    }
    length = parseInt(length);
    if (isNaN(length) || length < 0) {
      throw new Error("i2c: invalid length to read");
    }
    if (length > 1024) {
      throw new Error("i2c: data length should be under 1024 bytes");
    }
    var self = this;
    return new Promise(function(resolve, reject){
      var obj = {};
      obj["i2c"+self.id] = {
        address,
        read: length
      };
      self.Obniz.send(obj);
      self.addObserver(resolve);
    });
  }

  read10bitWait(address, length) {
    return this.readWait(address | 0x8000, length);
  }

  notified(obj) {
    if (obj.mode === "slave" && typeof this.onwritten === "function") {
      this.onwritten(obj.data);
    } else {
      // TODO: we should compare byte length from sent
      var callback = this.observers.shift();
      if (callback) {
        callback(obj.data);
      }
    }
  }

  isUsed() {
    return this.used;
  }

  end() {
    this.state = {};
    var obj = {};
    obj["i2c"+this.id] = null;
    this.Obniz.send(obj);
    this.used = false;
  }
}