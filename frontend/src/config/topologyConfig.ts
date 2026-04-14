import { Firewall, Router, Globe, Cloud, SwitchLayer_2, ServerProxy, Wifi, BareMetalServer, Box } from '@carbon/icons-react';

/**
 * ICON_MAPPING defines which Lucide icon to use for each Device Role.
 * Users can customize this mapping before building.
 */
export const ROLE_ICON_MAPPING: Record<string, any> = {
  'firewall': {
    icon: Firewall,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    label: 'Firewall',
  },
  'router': {
    icon: Router,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Router',
  },
  'sdwan': {
    icon: Globe,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    label: 'SD-WAN',
  },
  'cloud': {
    icon: Cloud,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    label: 'Cloud Infrastructure',
  },
  'core': {
    icon: SwitchLayer_2,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    label: 'Core Switch',
  },
  'distribution': {
    icon: SwitchLayer_2,
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Distribution',
  },
  'access': {
    icon: SwitchLayer_2,
    color: 'text-slate-100',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    label: 'Access Switch',
  },
  'load-balancer': {
    icon: ServerProxy,
    color: 'text-white',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    label: 'Load Balancer',
  },
  'access-point': {
    icon: Wifi,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    label: 'Access Point',
  },
  'server': {
    icon: BareMetalServer,
    color: 'text-indigo-300',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    label: 'Server',
  },
  'generic': {
    icon: Box,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    label: 'Generic Device',
  }
};

/**
 * VENDOR_LOGOS defines the logo URLs for different vendors.
 * Uses simpleicons.org for high-quality SVG logos.
 */
export const VENDOR_LOGOS: Record<string, string> = {
  'cisco': '/static/nautobot_topology/icons/cisco.svg',
  'juniper': '/static/nautobot_topology/icons/juniper.svg',
  'arista': '/static/nautobot_topology/icons/arista.svg',
  'fortinet': '/static/nautobot_topology/icons/fortinet.svg',
  'palo alto': '/static/nautobot_topology/icons/palo-alto.svg',
  'f5': '/static/nautobot_topology/icons/f5.svg',
  'nokia': '/static/nautobot_topology/icons/nokia.svg',
  'dell': '/static/nautobot_topology/icons/dell.svg',
  'hp': '/static/nautobot_topology/icons/hp.svg',
  'aruba': '/static/nautobot_topology/icons/aruba.svg',
};

export const getRoleConfig = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('firewall')) return ROLE_ICON_MAPPING['firewall'];
  if (r.includes('sdwan') || r.includes('sd-wan')) return ROLE_ICON_MAPPING['sdwan'];
  if (r.includes('cloud')) return ROLE_ICON_MAPPING['cloud'];
  if (r.includes('router')) return ROLE_ICON_MAPPING['router'];
  if (r.includes('core')) return ROLE_ICON_MAPPING['core'];
  if (r.includes('dist')) return ROLE_ICON_MAPPING['distribution'];
  if (r.includes('access') && !r.includes('point')) return ROLE_ICON_MAPPING['access'];
  if (r.includes('access') && r.includes('point')) return ROLE_ICON_MAPPING['access-point'];
  if (r.includes('load') || r.includes('balancer')) return ROLE_ICON_MAPPING['load-balancer'];
  if (r.includes('server')) return ROLE_ICON_MAPPING['server'];
  return ROLE_ICON_MAPPING['generic'];
};

export const getVendorLogo = (vendor: string) => {
  const v = vendor.toLowerCase();
  for (const key in VENDOR_LOGOS) {
    if (v.includes(key)) return VENDOR_LOGOS[key];
  }
  return null;
};
