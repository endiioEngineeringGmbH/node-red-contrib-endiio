'use strict';

module.exports = function (RED) {
  function EndiioCommand(config) {
    RED.nodes.createNode(this, config);

    var node = this;

    var toBoolean = function toBoolean(value) {
      return (value == 'yes') || (value == 'on') || (value == '1') || (value == 'true');
    };

    node.on('input', function(message) {
      var command = null;

      switch (config.command) {
        case 'raw':
          command = config.command;
          break;

        case 'pairing':
          var mode = config.pairing;
          var result = null;
          switch ("" + mode) {
            case 'true':
              result = 1;
              break;
            case 'false':
              result = 0;
              break;
            case 'input':
              result = toBoolean(payload.message) ? 1 : 0;
              break;
          }

          command = 'EN-SPAIRING=' + result;
          break;

        case 'reset':
          command = 'EN-RESET';
          break;

        case 'version':
          command = 'EN-VER';
          break;
      }

      node.send({
        topic: node.name,
        payload: command
      });
    });
  }

  // Register node
  RED.nodes.registerType("endiio-command", EndiioCommand);
}