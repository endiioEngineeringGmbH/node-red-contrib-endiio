node-red-contrib-endiio
=======================

This extension provides nodes to interact with endiio protocol devices using UART.

Install
-------

Install node red by following the setup instructions at [Installing Node.js via package manager](https://nodejs.org/en/download/package-manager/).
Run the following command in the Node-RED user directory `~/.node-red` to install the node-red-contrib-endiio package:

```bash
npm install node-red-contrib-endiio
```

Communication
-------------

After the installation of the package the server is ready for use.
Add the endiio connection node to the current flow to communicate with an endiio dongle.
Commands can be issued by attaching one or more endiio command nodes to the left side of the node.
The output of the dongle is available by attaching nodes to the right side of the connection node.

![endiio connection node](https://raw.githubusercontent.com/endiioEngineeringGmbH/node-red-contrib-endiio/master/doc/connection_node.png "endiio connection node")

Adding sensor units
-------------------

To add sensor units to the network the dongle need to be set into pairing mode.
For this add a trigger node and an endiio command node.
The boolean value `true` might be used as output of the trigger node since it is only used as set off for the pairing command.
To monitor the current status of the pairing process a debug node should be appended to the right side of the endiio connection node.
The debug output can be seen by switching to the debug tab on the right side of the user interface.

![Setting the dongle into pairing mode](https://raw.githubusercontent.com/endiioEngineeringGmbH/node-red-contrib-endiio/master/doc/command_pairing_execute.png "Setting the dongle into pairing mode")

![Pairing command settings](https://raw.githubusercontent.com/endiioEngineeringGmbH/node-red-contrib-endiio/master/doc/command_pairing.png "Pairing command settings")

When clicking on the trigger button the command is confirmed by an `EN-SPAIRING=OK` message seen below.

```json
{
  "type": "raw",
  "value": "EN-SPAIRING=OK"
}
```

Now set the desired sensor unit into pairing mode to add it to the network.
The newly registered sensor unit should now be listed in the debug output with an assigned sensor unit id.
When attaching additional sensor units to the network both devices, new sensor unit and dongle, have to be set into pairing mode.

```json
{
  "type": "paired",
  "source": 4118160908
}
```

Depending on the attached sensors the output will be splitted into multiple sensor records.
Each record contains the source id of the sensor unit and the name of the attached sensor.
The values and units object contained in the payload structure hold the measured data and can be processed by further nodes.

```json
{
  "type": "sensor-data",
  "source": 4118160908,
  "id": 252,
  "name": "Battery",
  "timestamp": 1526309649634,
  "values": {
    "voltage": 3.5747478008270264
  },
  "units": {
    "voltage": "V"
  }
}
```
