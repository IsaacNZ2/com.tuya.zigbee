'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

class switch_3_gang extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    const { subDeviceId } = this.getData();
    const endpoint = subDeviceId === 'secondSwitch' ? 2 :
                     subDeviceId === 'thirdSwitch' ? 3 : 1;

    this.log(`Device initialized. subDeviceId: ${subDeviceId}, endpoint: ${endpoint}`);

    // Register capability listener for the ON/OFF cluster
    this.registerCapability('onoff', CLUSTER.ON_OFF, { endpoint });

    // Register report listener to update tile state when device is toggled physically
    zclNode.endpoints[endpoint].clusters.onOff.on('attr.onOff', value => {
      this.log(`Received onOff report for endpoint ${endpoint}: ${value}`);
      this.setCapabilityValue('onoff', value).catch(this.error);
    });

    // Optional: read device info only for main (non-sub) device
    if (!this.isSubDevice()) {
      try {
        await zclNode.endpoints[1].clusters.basic.readAttributes([
          'manufacturerName', 'zclVersion', 'appVersion', 'modelId', 'powerSource', 'attributeReportingStatus'
        ]);
      } catch (err) {
        this.error('Error reading basic attributes: ', err);
      }
    }
  }

  onDeleted() {
    const { subDeviceId } = this.getData();
    this.log(`3 Gang Switch, channel ${subDeviceId || 'main'} removed`);
  }
}

module.exports = switch_3_gang;
