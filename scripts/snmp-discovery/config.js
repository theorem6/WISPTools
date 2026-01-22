// SNMP discovery configuration defaults

const CENTRAL_SERVER = 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = '/etc/wisptools';
const LOG_FILE = '/var/log/wisptools-snmp-discovery.log';
const SNMP_COMMUNITIES = ['public', 'private', 'community'];
const SNMP_TIMEOUT = 2000;
const MAX_PARALLEL_PINGS = 50;
const MAX_PARALLEL_SNMP = 20;

const MIKROTIK_OIDS = {
  identity: '1.3.6.1.4.1.14988.1.1.1.1.1.3.0',
  version: '1.3.6.1.4.1.14988.1.1.1.1.1.4.0',
  serial: '1.3.6.1.4.1.14988.1.1.1.1.1.7.0',
  board: '1.3.6.1.4.1.14988.1.1.1.1.1.9.0',
  cpuLoad: '1.3.6.1.4.1.14988.1.1.1.3.1.0',
  temperature: '1.3.6.1.4.1.14988.1.1.1.8.2.0',
  uptime: '1.3.6.1.2.1.1.3.0'
};

const LLDP_OIDS = {
  lldpLocChassisId: '1.0.8802.1.1.2.1.3.2.0',
  lldpRemTable: '1.0.8802.1.1.2.1.4.1',
  lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5',
  lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
  lldpRemSysDesc: '1.0.8802.1.1.2.1.4.1.1.10',
  lldpRemManAddr: '1.0.8802.1.1.2.1.4.2.1.4',
  lldpRemLocalPortNum: '1.0.8802.1.1.2.1.4.1.1.7'
};

const CDP_OIDS = {
  cdpGlobalRun: '1.3.6.1.4.1.9.9.23.1.3.1.0',
  cdpCacheTable: '1.3.6.1.4.1.9.9.23.1.2.1',
  cdpCacheDeviceId: '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
  cdpCacheDevicePort: '1.3.6.1.4.1.9.9.23.1.2.1.1.7',
  cdpCachePlatform: '1.3.6.1.4.1.9.9.23.1.2.1.1.8',
  cdpCacheAddress: '1.3.6.1.4.1.9.9.23.1.2.1.1.4'
};

const STD_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysLocation: '1.3.6.1.2.1.1.6.0'
};

const IF_MIB_OIDS = {
  ifNumber: '1.3.6.1.2.1.2.1.0',
  ifTable: '1.3.6.1.2.1.2.2.1',
  ifIndex: '1.3.6.1.2.1.2.2.1.1',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifMtu: '1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20'
};

const IP_MIB_OIDS = {
  ipAdEntAddr: '1.3.6.1.2.1.4.20.1.1',
  ipAdEntNetMask: '1.3.6.1.2.1.4.20.1.3',
  ipAdEntIfIndex: '1.3.6.1.2.1.4.20.1.2',
  ipNetToMediaTable: '1.3.6.1.2.1.4.22.1',
  ipNetToMediaPhysAddress: '1.3.6.1.2.1.4.22.1.2',
  ipNetToMediaNetAddress: '1.3.6.1.2.1.4.22.1.3',
  ipNetToMediaIfIndex: '1.3.6.1.2.1.4.22.1.1',
  ipNetToMediaType: '1.3.6.1.2.1.4.22.1.4',
  ipRouteTable: '1.3.6.1.2.1.4.21.1',
  ipRouteDest: '1.3.6.1.2.1.4.21.1.1',
  ipRouteNextHop: '1.3.6.1.2.1.4.21.1.7',
  ipRouteMask: '1.3.6.1.2.1.4.21.1.11',
  ipRouteType: '1.3.6.1.2.1.4.21.1.8',
  ipRouteProto: '1.3.6.1.2.1.4.21.1.9'
};

module.exports = {
  CENTRAL_SERVER,
  API_URL,
  CONFIG_DIR,
  LOG_FILE,
  SNMP_COMMUNITIES,
  SNMP_TIMEOUT,
  MAX_PARALLEL_PINGS,
  MAX_PARALLEL_SNMP,
  MIKROTIK_OIDS,
  LLDP_OIDS,
  CDP_OIDS,
  STD_OIDS,
  IF_MIB_OIDS,
  IP_MIB_OIDS
};
