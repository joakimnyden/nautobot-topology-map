import { Site, Device, DeviceStatus, Link, Policy } from './types';

export const MOCK_SITES: Site[] = [
  { 
    id: 'site-1', 
    name: 'New York DC', 
    coordinates: [-74.006, 40.7128], 
    deviceCount: 124, 
    linkCount: 450, 
    region: 'North America', 
    country: 'United States of America', 
    status: 'Active',
    imageUrl: 'https://images.unsplash.com/photo-1558441719-ffb4d4520a67?auto=format&fit=crop&q=80&w=1000'
  },
  { 
    id: 'site-2', 
    name: 'London HQ', 
    coordinates: [-0.1278, 51.5074], 
    deviceCount: 86, 
    linkCount: 210, 
    region: 'Europe', 
    country: 'United Kingdom', 
    status: 'Active',
    imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000'
  },
  { 
    id: 'site-3', 
    name: 'Tokyo Branch', 
    coordinates: [139.6503, 35.6762], 
    deviceCount: 42, 
    linkCount: 95, 
    region: 'Asia', 
    country: 'Japan', 
    status: 'Degraded',
    imageUrl: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=1000'
  },
  { 
    id: 'site-4', 
    name: 'Sydney Hub', 
    coordinates: [151.2093, -33.8688], 
    deviceCount: 35, 
    linkCount: 78, 
    region: 'Oceania', 
    country: 'Australia', 
    status: 'Active',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1000'
  },
  { 
    id: 'site-5', 
    name: 'Frankfurt IX', 
    coordinates: [8.6821, 50.1109], 
    deviceCount: 210, 
    linkCount: 890, 
    region: 'Europe', 
    country: 'Germany', 
    status: 'Active',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1000'
  },
];

export const MOCK_DEVICES: Device[] = [
  // New York
  { 
    id: 'dev-1', name: 'nyc-core-01', siteId: 'site-1', role: 'Core Switch', platform: 'Arista EOS', vendor: 'Arista', status: DeviceStatus.ACTIVE, primaryIp: '10.1.0.1',
    vlans: [10, 20, 100, 200], protocols: ['BGP', 'MLAG', 'VXLAN'], prefixes: ['10.1.0.0/24', '10.255.0.1/32'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-1/'
  },
  { 
    id: 'dev-2', name: 'nyc-core-02', siteId: 'site-1', role: 'Core Switch', platform: 'Arista EOS', vendor: 'Arista', status: DeviceStatus.ACTIVE, primaryIp: '10.1.0.2',
    vlans: [10, 20, 100, 200], protocols: ['BGP', 'MLAG', 'VXLAN'], prefixes: ['10.1.0.0/24', '10.255.0.2/32'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-2/'
  },
  { 
    id: 'dev-3', name: 'nyc-dist-01', siteId: 'site-1', role: 'Distribution', platform: 'Cisco IOS-XE', vendor: 'Cisco', status: DeviceStatus.ACTIVE, primaryIp: '10.1.1.1',
    vlans: [10, 20, 30], protocols: ['OSPF', 'HSRP'], prefixes: ['10.1.1.0/24'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-3/'
  },
  { 
    id: 'dev-4', name: 'nyc-dist-02', siteId: 'site-1', role: 'Distribution', platform: 'Cisco IOS-XE', vendor: 'Cisco', status: DeviceStatus.ACTIVE, primaryIp: '10.1.1.2',
    vlans: [10, 20, 30], protocols: ['OSPF', 'HSRP'], prefixes: ['10.1.1.0/24'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-4/'
  },
  { 
    id: 'dev-5', name: 'nyc-edge-01', siteId: 'site-1', role: 'Edge Router', platform: 'Juniper JunOS', vendor: 'Juniper', status: DeviceStatus.ACTIVE, primaryIp: '192.168.1.1',
    vlans: [100, 200], protocols: ['BGP', 'OSPF'], prefixes: ['192.168.1.0/24'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-5/'
  },
  
  // London
  { 
    id: 'dev-lon-1', name: 'lon-core-01', siteId: 'site-2', role: 'Core Switch', platform: 'Arista EOS', vendor: 'Arista', status: DeviceStatus.ACTIVE, primaryIp: '10.2.0.1',
    vlans: [10, 50], protocols: ['BGP'], prefixes: ['10.2.0.0/24'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-lon-1/'
  },
  { 
    id: 'dev-lon-2', name: 'lon-edge-01', siteId: 'site-2', role: 'Edge Router', platform: 'Juniper JunOS', vendor: 'Juniper', status: DeviceStatus.ACTIVE, primaryIp: '192.168.2.1',
    vlans: [50], protocols: ['BGP', 'VRRP'], prefixes: ['192.168.2.0/24'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/devices/dev-lon-2/'
  },
  
  // Frankfurt
  { 
    id: 'dev-fra-1', name: 'fra-core-01', siteId: 'site-5', role: 'Core Switch', platform: 'Arista EOS', vendor: 'Arista', status: DeviceStatus.ACTIVE, primaryIp: '10.5.0.1',
    vlans: [10, 60], protocols: ['BGP', 'VXLAN'], prefixes: ['10.5.0.0/24']
  },
  { 
    id: 'dev-fra-2', name: 'fra-edge-01', siteId: 'site-5', role: 'Edge Router', platform: 'Juniper JunOS', vendor: 'Juniper', status: DeviceStatus.ACTIVE, primaryIp: '192.168.5.1',
    vlans: [60], protocols: ['BGP'], prefixes: ['192.168.5.0/24']
  },
];

export const MOCK_LINKS: Link[] = [
  // NYC Internal
  { 
    id: 'link-1', source: 'dev-1', target: 'dev-2', type: 'physical', bandwidth: '100Gbps', vlan: 10, 
    sourceInterface: 'Po1', targetInterface: 'Po1', isPortChannel: true,
    portChannelMembers: ['Eth1/1', 'Eth1/2'],
    nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-1/'
  },
  { id: 'link-2', source: 'dev-1', target: 'dev-3', type: 'physical', bandwidth: '40Gbps', vlan: 20, sourceInterface: 'Eth1/2', targetInterface: 'Gi1/0/1', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-2/' },
  { id: 'link-3', source: 'dev-2', target: 'dev-4', type: 'physical', bandwidth: '40Gbps', vlan: 20, sourceInterface: 'Eth1/2', targetInterface: 'Gi1/0/1', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-3/' },
  { id: 'link-4', source: 'dev-3', target: 'dev-4', type: 'logical', protocol: 'HSRP', vlan: 30, nautobotUrl: 'https://demo.nautobot.com/ipam/prefixes/link-4/' },
  { id: 'link-5', source: 'dev-1', target: 'dev-5', type: 'logical', protocol: 'BGP', vlan: 100, nautobotUrl: 'https://demo.nautobot.com/ipam/prefixes/link-5/' },
  
  // London Internal
  { id: 'link-lon-1', source: 'dev-lon-1', target: 'dev-lon-2', type: 'physical', bandwidth: '10Gbps', vlan: 50, sourceInterface: 'Eth1/1', targetInterface: 'Gi0/1', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-lon-1/' },

  // Frankfurt Internal
  { id: 'link-fra-1', source: 'dev-fra-1', target: 'dev-fra-2', type: 'physical', bandwidth: '100Gbps', vlan: 60, sourceInterface: 'Eth1/1', targetInterface: 'Gi0/1', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-fra-1/' },

  // Inter-site Links (Backbone)
  { id: 'link-nyc-lon', source: 'dev-5', target: 'dev-lon-2', type: 'physical', bandwidth: '10Gbps', sourceInterface: 'Gi0/0', targetInterface: 'Gi0/0', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-nyc-lon/' },
  { id: 'link-lon-fra', source: 'dev-lon-2', target: 'dev-fra-2', type: 'physical', bandwidth: '40Gbps', sourceInterface: 'Gi0/2', targetInterface: 'Gi0/2', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-lon-fra/' },
  { id: 'link-fra-nyc', source: 'dev-fra-2', target: 'dev-5', type: 'physical', bandwidth: '10Gbps', sourceInterface: 'Gi0/0', targetInterface: 'Gi0/1', nautobotUrl: 'https://demo.nautobot.com/dcim/cables/link-fra-nyc/' },
];

export interface InterSiteConnection {
  id: string;
  from: string; // Site ID
  to: string; // Site ID
  status: 'active' | 'degraded' | 'down';
}

export const MOCK_INTER_SITE_LINKS: InterSiteConnection[] = [
  { id: 'isl-1', from: 'site-1', to: 'site-2', status: 'active' },
  { id: 'isl-2', from: 'site-2', to: 'site-5', status: 'active' },
  { id: 'isl-3', from: 'site-5', to: 'site-1', status: 'degraded' },
];

export const MOCK_POLICIES: Policy[] = [
  {
    id: 'pol-1',
    name: 'Read-Only Network Engineers',
    description: 'Allows network engineers to view all devices but not modify them.',
    status: 'active',
    rego: `package nautobot.authz

default allow = false

allow {
    input.user.groups[_] == "network-engineers"
    input.action == "view"
    input.resource.type == "device"
}`
  },
  {
    id: 'pol-2',
    name: 'Site-Specific Admin',
    description: 'Allows admins to manage devices only within their assigned sites.',
    status: 'draft',
    rego: `package nautobot.authz

allow {
    input.user.role == "site-admin"
    input.resource.site_id == input.user.assigned_sites[_]
}`
  }
];
