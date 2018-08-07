'use strict';

module.exports = function (RED) {
  function EndiioFilter(config) {
    RED.nodes.createNode(this, config);

    var node = this;

    var toBoolean = function toBoolean(value) {
      return (value == 'yes') || (value == 'on') || (value == '1') || (value == 'true');
    };

    node.on('input', function(message) {
      var payload = message.payload;
      if (!payload || !payload.type) {
        return;
      }

      switch (config.filter) {
        case 'sensor-unit':
          if (payload.type !== "sensor-data") {
            return;
          }

          if (payload.source !== parseInt(config['sensor-unit'], 16)) {
            return;
          }

          node.send({
            topic: node.name,
            payload: payload
          });
          return;

        case 'sensor-type':
          if (payload["type"] !== "sensor-data") {
            return;
          }

          if (payload["name"] !== config['sensor-type']) {
            return;
          }

          if (config['sensor-value'] !== "all") {
            if (payload.values[config['sensor-value']] === undefined) {
              return;
            }

            node.send({
              topic: node.name,
              payload: payload.values[config['sensor-value']]
            });
            return;
          }

          node.send({
            topic: node.name,
            payload: payload
          });
          return;
      }
    });
  }

  // Register node
  RED.nodes.registerType("endiio-filter", EndiioFilter);
}