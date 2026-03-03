import { Shield, Network, Server, GitPullRequest, Cpu, HardDrive, Zap, GitBranch, Box } from 'lucide-react';

/**
 * ICON_MAPPING defines which Lucide icon to use for each Device Role.
 * Users can customize this mapping before building.
 */
export const ROLE_ICON_MAPPING: Record<string, any> = {
  'firewall': {
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    label: 'Firewall'
  },
  'core': {
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    label: 'Core Switch'
  },
  'distribution': {
    icon: GitBranch,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Distribution'
  },
  'access': {
    icon: Server,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    label: 'Access Switch'
  },
  'load-balancer': {
    icon: GitPullRequest,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    label: 'Load Balancer'
  },
  'server': {
    icon: HardDrive,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    label: 'Server'
  },
  'generic': {
    icon: Box,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/5',
    borderColor: 'border-slate-500/10',
    label: 'Generic Device'
  }
};

/**
 * VENDOR_LOGOS defines the logo URLs for different vendors.
 * Uses simpleicons.org for high-quality SVG logos.
 */
export const VENDOR_LOGOS: Record<string, string> = {
  'cisco': 'https://cdn.simpleicons.org/cisco/40B4E5',
  'juniper': 'https://cdn.simpleicons.org/junipernetworks/3E8E41',
  'arista': 'https://cdn.simpleicons.org/aristanetworks',
  'fortinet': 'https://cdn.simpleicons.org/fortinet/C02026',
  'palo alto': 'https://cdn.simpleicons.org/paloaltonetworks/F04E23',
  'f5': 'https://cdn.simpleicons.org/f5/E41C2D',
  'nokia': 'https://cdn.simpleicons.org/nokia/124191',
  'dell': 'https://cdn.simpleicons.org/dell/007DB8',
  'hp': 'https://cdn.simpleicons.org/hp/0096D6',
  'aruba': 'https://cdn.simpleicons.org/aruba/FF8300',
};

export const getRoleConfig = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('firewall')) return ROLE_ICON_MAPPING['firewall'];
  if (r.includes('core')) return ROLE_ICON_MAPPING['core'];
  if (r.includes('dist')) return ROLE_ICON_MAPPING['distribution'];
  if (r.includes('access')) return ROLE_ICON_MAPPING['access'];
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
