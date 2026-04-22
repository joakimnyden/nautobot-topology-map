export enum DeviceStatus {
  ACTIVE = 'active',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
}

export interface Site {
  id: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  deviceCount: number;
  linkCount: number;
  region: string;
  country: string; // e.g., 'USA', 'UK', 'Germany'
  status: 'Active' | 'Degraded' | 'Offline';
  imageUrl?: string;
}

export interface Device {
  id: string;
  name: string;
  siteId: string;
  role: string;
  platform: string;
  deviceType: string;
  vendor?: string; // e.g., 'Cisco', 'Arista', 'Juniper'
  status: DeviceStatus;
  primaryIp: string;
  vlans?: (string | number)[];
  protocols?: string[];
  prefixes?: string[];
  nautobotUrl?: string;
  type?: 'device' | 'group';
  deviceCount?: number;
}

export interface Link {
  id: string;
  source: string; // Device ID
  target: string; // Device ID
  sourceDeviceName?: string;
  targetDeviceName?: string;
  type: 'physical' | 'logical' | 'port-channel';
  protocol?: string; // e.g., 'BGP', 'HSRP', 'VXLAN'
  bandwidth?: string;
  speed?: number; // In Kbps
  vlan?: number;
  sourceInterface?: string; // e.g., 'GigabitEthernet1/0/1'
  sourceInterfaceType?: string;
  targetInterface?: string;
  sourceInterfaceUrl?: string;
  targetInterfaceUrl?: string;
  isPortChannel?: boolean;
  portChannelMembers?: string[]; // Legacy field
  lagMembers?: { 
    sourceInterface: string, 
    sourceInterfaceId: string, 
    targetInterface: string, 
    targetInterfaceId: string 
  }[];
  targetInterfaceType?: string;
  status?: string;
  description?: string;
  localAs?: string;
  remoteAs?: string;
  localIp?: string;
  remoteIp?: string;
  peerGroup?: string;
  nautobotUrl?: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rego: string;
  status: 'active' | 'draft';
}
