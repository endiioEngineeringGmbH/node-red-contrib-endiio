'use strict';

module.exports = function (RED) {
  const SerialPort = require('serialport');
  const Readline = SerialPort.parsers.Readline;

  var sensors = {};
  sensors[0x60] = { name: "BME280", values: ["temperature", "humidity", "pressure"], units: ["°C", "rF", "hPa"] };
  sensors[0x61] = { name: "BME280Light", values: ["temperature", "humidity"], units: ["°C", "rF"] };
  sensors[0x78] = { name: "THMOD800", values: ["temperature"], units: ["°C"] };
  sensors[0x28] = { name: "HYT131", values: ["temperature", "humidity"],  units: ["°C", "rF"] };
  sensors[0x4A] = { name: "MAX44009", values: ["luminance"], units: ["lx"] };
  sensors[0xFC] = { name: "Battery", values: ["voltage"], units: ["V"] };
  sensors[0xFD] = { name: "RSSI", values: ["rssi"], units: ["dBm"] };
  sensors[0xFE] = { name: "System", values: ["voltage", "rssi"], units: ["V", "dBm"] };
  sensors[0x68] = { name: "MPU9250", values: ["acceleration_x", "acceleration_z", "gyro_z"], units: ["g", "g", "deg/s"] };
  sensors[0x72] = { name: "Shock", values: ["detected"], units: [""] };

  function EndiioConnectionNode(config) {
    RED.nodes.createNode(this, config);

    var node = this;

    node.serialport = null;
    node.drainInterval = null;
    node.reconnectTimeout = null;
    node.drain = false;

    node.on('close', function() {
      node.disconnect();
    });

    /*
     * Incoming data is redirected to the serial port.
     * This is used internally to generate and send packets.
     */
    node.on('input', function(message) {
      if (message.payload == null || message.payload == "") {
        return;
      }

      var msg = message.payload.toString();
      var port = node.serialport;
      if (port != null) {
        port.write(msg + "\r\n");
        port.drain(function(error) {
          if (error != null) {
            node.debug("Could not drain serial port!");
            node.onError();
          }
        });
      }
    });

    node.onDisconnected = function onDisconnected() {
      node.clearTimeouts();
      node.status({fill: "red", shape: "dot", text: "not connected"});
    };
    node.onConnected = function onConnected(error) {
      if (error != null) {
        node.error("Could not connect to serial port!");
        node.disconnect();
        node.reconnectTimeout = setTimeout(node.connect, 3000);
        return;
      }

      node.clearTimeouts();
      node.status({fill: "green", shape: "dot", text: "connected"});

      var parser = new Readline();
      parser.on('data', node.decodeProtocol);
      parser.on('error', node.onError);
      node.serialport.pipe(parser);

      node.log("Connected to serial port!");

      // Timeout detection for Windows implementation
      node.drain = false;
      node.drainInterval = setInterval(node.onDrainInterval, 3000);
    };
    node.onError = function onError() {
      node.error("Connection to serial port lost!");
      node.onDisconnected();
      node.disconnect();
      node.reconnectTimeout = setTimeout(node.connect, 3000);
    };
    node.onDrainInterval = function onDrainInterval() {
      var port = node.serialport;
      if (port != null) {
        if (node.drain) { // Timeout
            node.debug("Drain interval is overlapping!");
            node.debug("The serial port might be unresponsive!");
            node.onError();
            return;
        }

        node.debug("Draining serial port!");

        node.drain = true;
        port.drain(function(error) {
          if (error == null) {
            node.drain = false;
          }
        });
      }
    };
    node.clearTimeouts = function clearTimeouts() {
      var drainInterval = node.drainInterval;
      if (drainInterval != null) {
        node.drainInterval = null;
        clearInterval(drainInterval);
      }
      var reconnectTimeout = node.reconnectTimeout;
      if (reconnectTimeout != null) {
        node.reconnectTimeout = null;
        clearTimeout(reconnectTimeout);
      }

      node.drain = false;
    };

    node.connect = function connect() {
      node.clearTimeouts();

      var port = config.port;
      var configuration = node.getSerialProperties();
      if (port == null || port === "") {
        node.status({fill: "red", shape: "ring", text: "no port"});
        return;
      }

      node.debug("Connecting to serial port!");
      node.serialport = new SerialPort(port, configuration, node.onConnected);
    };
    node.disconnect = function disconnect() {
      node.clearTimeouts();

      var port = node.serialport;
      if (port != null) {
        node.serialport = null;
        port.close(function() {}, null);
      }
    };

    node.getSerialProperties = function getSerialProperties() {
      return {
        baudRate: +config.baudrate || 9600,
        dataBits: +config.bits || 8,
        parity: config.paritybit || 'none',
        stopbit: +config.stopbit || 1
      };
    };

    // Helper functions
    node.decodeHex = function decodeHex(data) {
      var length = data.length - 1;
      var result = new Array(data.length >> 1);

      for (var i = 0, j = 0; i < length; i += 2, j++) {
        result[j] = parseInt(data.substring(i, i+2), 16);
      }

      return result;
    };
    node.decodeFloat = function decodeFloat(offset, data) {
      if (data.length < offset + 4) {
        return NaN;
      }

      var buf = new ArrayBuffer(4);
      var view = new DataView(buf);

      for(var i = 0; i < 4; i++) {
        view.setUint8(i, data[offset + i]);
      }

      return view.getFloat32(0, true);
    };

    node.decodeProtocol = function decodeProtocol(message) {
      // Ensure that we have serial port to respond on
      var port = node.serialport;
      if (port == null) {
        return;
      }

      var message = ("" + message).trim();
      if (message == "") {
        return;
      }

      node.debug("Message: \"" + message + "\"");

      if (message == "-WCMDRDY=1") {
        port.write("EN-GWCMD\r\n");
        port.drain(function(error) {
          if (error) {
            node.debug("Could not respond on serial port!");
            node.onError();
          }
        });
        return;
      }

      if (message.startsWith("-PAIRING=")) {
        var sensorUnitId = parseInt(message.substring("-PAIRING=".length).trim(), 16);
        node.send({
          topic: node.name,
          payload: {
            type: "paired",
            source: sensorUnitId,
            "source-hex": sensorUnitId.toString(16).padStart(8, '0')
          }
        });
        return;
      }

      if (!message.startsWith("EN-GWCMD=")) {
        node.debug("Unknown message");
        node.send({
          topic: node.name,
          payload: {
            type: "raw",
            value: message
          }
        });
        return;
      }

      // Remove command prefix
      var payload = message.substring("EN-GWCMD=".length).trim();

      // The command always consists of 4 parts separated by ','
      var splitData = payload.split(",", 5);
      if (splitData.length != 4) {
        node.debug("Could not decode payload!");
        return;
      }

      // Unpack command data
      var rxAddr = parseInt(splitData[0], 16);
      var remBytes = parseInt(splitData[1], 10);
      var size = parseInt(splitData[2], 10);
      var data = node.decodeHex(splitData[3]);

      var timestamp = new Date().getTime();

      // Empty packet
      if (data.length == 0) {
        node.debug("Empty command");
        return;
      }

      // Decode command type
      switch (data[0]) {
        case 0x76: // v-Packet
          node.decodeSensorData(data.slice(1), timestamp, rxAddr);
          break;
        default:
          node.debug("Invalid command: " + data[0]);
          return;
      }

      if (remBytes > 0) {
        port.write("EN-GWCMD\r\n");
        port.drain(function(error) {
          if (error) {
            node.debug("Could not respond on serial port!");
            node.onError();
          }
        });
      }
    };
    node.decodeSensorData = function decodeSensorData(data, timestamp, source) {
      for (var i = 0; i < data.length; i++) {
        var sensorId = data[i];
        var sensorDefinition = sensors[sensorId];
        if (sensorDefinition == undefined) {
          node.debug("Unknown sensor " + sensorId);
          continue;
        }

        var sensorData = {
          type: "sensor-data",
          source: source,
          "source-hex": source.toString(16).padStart(8, '0'),
          id: sensorId,
          name: sensorDefinition.name,
          timestamp: timestamp,
          values: {},
          units: {}
        };

        var valueNames = sensorDefinition.values;
        var valueUnits = sensorDefinition.units;
        for (var j = 0; j < valueNames.length; j++, i += 4) {
          var sensorName = valueNames[j];
          var sensorUnit = valueUnits[j];
          var sensorValue = node.decodeFloat(i + 1, data);

          sensorData.values[sensorName] = sensorValue;
          sensorData.units[sensorName] = sensorUnit;
        }

        node.send({
          topic: node.name,
          payload: sensorData
        });
      }
    };

    node.onDisconnected();
    node.connect();
  }

  // Register node
  RED.nodes.registerType("endiio-connection", EndiioConnectionNode);
}