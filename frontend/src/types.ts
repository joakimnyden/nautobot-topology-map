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
  vendor?: string; // e.g., 'Cisco', 'Arista', 'Juniper'
  status: DeviceStatus;
  primaryIp: string;
  vlans?: number[];
  protocols?: string[];
  prefixes?: string[];
  nautobotUrl?: string;
}

export interface Link {
  id: string;
  source: string; // Device ID
  target: string; // Device ID
  type: 'physical' | 'logical';
  protocol?: string; // e.g., 'BGP', 'HSRP', 'VXLAN'
  bandwidth?: string;
  vlan?: number;
  sourceInterface?: string; // e.g., 'GigabitEthernet1/0/1'
  targetInterface?: string;
  isPortChannel?: boolean;
  portChannelMembers?: string[]; // e.g., ['Eth1/1', 'Eth1/2']
  nautobotUrl?: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rego: string;
  status: 'active' | 'draft';
}
