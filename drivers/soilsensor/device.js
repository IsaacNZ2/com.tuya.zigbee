'use strict';

const { Cluster } = require('zigbee-clusters');
const TuyaSpecificCluster = require('../../lib/TuyaSpecificCluster');
const TuyaSpecificClusterDevice = require('../../lib/TuyaSpecificClusterDevice');

Cluster.addCluster(TuyaSpecificCluster);

// Add alternates some TS0601 variants use
const dataPoints = {
  humidity: [3, 2, 102],       // main, alt, alt2
  temperature: [5, 1, 101],    // main, alt, alt2
  temperature_unit: [9],
  battery_state: [14],
  battery: [15, 103],
};

const isDp = (dp, list) => (Array.isArray(list) ? list.includes(dp) : dp === list);

const dataTypes = {
  raw: 0, // [ bytes ]
  bool: 1, // [0/1]
  value: 2, // [ 4 byte value ]
  string: 3, // [ N byte string ]
  enum: 4, // [ 0-255 ]
  bitmap: 5, // [ 1,2,4 bytes ] as bits
};

const convertMultiByteNumberPayloadToSingleDecimalNumber = (chunks) => {
  let value = 0;

  for (let i = 0; i < chunks.length; i++) {
    value = value << 8;
    value += chunks[i];
  }

  return value;
};

const getDataValue = (dpValue) => {
  switch (dpValue.datatype) {
    case dataTypes.raw:
      return dpValue.data;
    case dataTypes.bool:
      return dpValue.data[0] === 1;
    case dataTypes.value:
      return convertMultiByteNumberPayloadToSingleDecimalNumber(dpValue.data);
    case dataTypes.string:
      let dataString = '';
      for (let i = 0; i < dpValue.data.length; ++i) {
        dataString += String.fromCharCode(dpValue.data[i]);
      }
      return dataString;
    case dataTypes.enum:
      return dpValue.data[0];
    case dataTypes.bitmap:
      return convertMultiByteNumberPayloadToSingleDecimalNumber(dpValue.data);
  }
}

class soilsensor extends TuyaSpecificClusterDevice {

  async onNodeInit({ zclNode }) {

    this.printNode();

    zclNode.endpoints[1].clusters.tuya.on("response", value => this.updateData(value));

    await zclNode.endpoints[1].clusters.basic.readAttributes(['manufacturerName', 'zclVersion', 'appVersion', 'modelId', 'powerSource', 'attributeReportingStatus'])
    .catch(err => {
        this.error('Error when reading device attributes ', err);
    });
  }

async updateData(data) {
  const dp = data.dp;
  const value = getDataValue(data);

  if (isDp(dp, dataPoints.humidity)) {
    // Most TS0601 soil sensors send RH in tenths (e.g., 568 -> 56.8 %)
    const rh = value > 1000 ? value / 10 : value;
    this.log("Humidity:", value, "→", rh);
    this.setCapabilityValue('measure_humidity', rh).catch(this.error);
    return;
  }

  if (isDp(dp, dataPoints.temperature)) {
    // Temperature is reported in deci-degrees C (e.g., 214 -> 21.4 °C)
    const t = value / 10;
    this.log("Temperature:", value, "→", t);
    this.setCapabilityValue('measure_temperature', t).catch(this.error);
    return;
  }

  if (isDp(dp, dataPoints.battery)) {
    // Battery usually 0–100; clamp defensively
    const bat = Math.max(0, Math.min(100, value));
    this.log("Battery:", value, "→", bat);
    this.setCapabilityValue('measure_battery', bat).catch(this.error);
    return;
  }

  if (isDp(dp, dataPoints.battery_state)) {
    // 2=good, 1=warning, 0=low → alarm true when low
    const alarm = value === 0;
    this.log("Battery state:", value, "→ alarm:", alarm);
    this.setCapabilityValue('alarm_battery', alarm).catch(this.error);
    return;
  }

  // Optional: temperature_unit (DP 9) or any other unknown DPs
  if (isDp(dp, dataPoints.temperature_unit)) {
    this.log("Temperature unit (ignored):", value);
    return;
  }

  // Helpful while validating: see what else the device sends
  this.log('Unhandled Tuya DP', dp, 'raw value', value, data);
  this.log(`📡 DP: ${data.dp}, Raw:`, data.data, '→ Decoded:', getDataValue(data));

}

  onDeleted(){
		this.log("Soil sensor removed");
	}
}

module.exports = soilsensor;

// Cluster 61184 is a custom cluster
// The device has 5 datapoints.
// 3: Humidity
// 5: temperature
// 9: temperature unit
// 14: battery state, 2 = good, 1 = warning, 0 = low
// 15: battery precentage

/*
  "ids": {
    "modelId": "TS0601",
    "manufacturerName": "_TZE200_myd45weu"
  },
  "endpoints": {
    "modelId": "TS0601",
    "manufacturerName": "_TZE200_myd45weu",
    "capabilities": {
      "type": "Buffer",
      "data": [
        128
      ]
    },
    "endpointDescriptors": [
      {
        "status": "SUCCESS",
        "_reserved": 20,
        "endpointId": 1,
        "applicationProfileId": 260,
        "applicationDeviceId": 81,
        "applicationDeviceVersion": 0,
        "_reserved1": 1,
        "inputClusters": [
          4,
          5,
          61184,
          0
        ],
        "outputClusters": [
          25,
          10
        ]
      }
    ],
    "touchlinkGroupIds": [],
    "extendedEndpointDescriptors": {
      "1": {
        "clusters": {
          "groups": {
            "attributes": [
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 0,
                "name": "nameSupport",
                "value": {
                  "type": "Buffer",
                  "data": [
                    0
                  ]
                },
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65533,
                "name": "clusterRevision",
                "value": 2,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              }
            ]
          },
          "scenes": {
            "attributes": [
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 0,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 1,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 2,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 3,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 4,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65533,
                "name": "clusterRevision",
                "value": 2,
                "reportingConfiguration": {
                  "status": "NOT_FOUND",
                  "direction": "reported"
                }
              }
            ]
          },
          "basic": {
            "attributes": [
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 0,
                "name": "zclVersion",
                "value": 3
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 1,
                "name": "appVersion",
                "value": 72
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 2,
                "name": "stackVersion",
                "value": 0
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 3,
                "name": "hwVersion",
                "value": 1
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 4,
                "name": "manufacturerName",
                "value": "_TZE200_myd45weu"
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 5,
                "name": "modelId",
                "value": "TS0601"
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 6,
                "name": "dateCode",
                "value": ""
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 7,
                "name": "powerSource",
                "value": "battery"
              },
              {
                "acl": [
                  "readable",
                  "writable",
                  "reportable"
                ],
                "id": 65502
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65533,
                "name": "clusterRevision",
                "value": 2
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65534,
                "name": "attributeReportingStatus",
                "value": "PENDING"
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65506
              },
              {
                "acl": [
                  "readable",
                  "reportable"
                ],
                "id": 65507
              }
            ]
          }
        },
        "bindings": {
          "ota": {},
          "time": {}
        }
      }
    }
  }
*/
