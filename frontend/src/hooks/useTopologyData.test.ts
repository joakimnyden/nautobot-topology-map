import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTopologyData } from './useTopologyData';
import { Device, Link, DeviceStatus } from '../types';
describe('useTopologyData', () => {
  const mockDevices: Device[] = [
    { id: 'dev1', name: 'Core-01', siteId: 'site1', role: 'core', status: DeviceStatus.ACTIVE, primaryIp: '1.1.1.1', platform: 'ios', deviceType: 'cat' },
    { id: 'dev2', name: 'AP-01', siteId: 'site1', role: 'access-point', status: DeviceStatus.ACTIVE, primaryIp: '1.1.1.2', platform: 'ios', deviceType: 'ap' },
    { id: 'dev3', name: 'AP-02', siteId: 'site1', role: 'access-point', status: DeviceStatus.ACTIVE, primaryIp: '1.1.1.3', platform: 'ios', deviceType: 'ap' },
  ];
  const mockLinks: Link[] = [
    { id: 'link1', source: 'dev1', target: 'dev2', type: 'physical', protocol: 'LLDP' },
    { id: 'link2', source: 'dev1', target: 'dev3', type: 'physical', protocol: 'LLDP' },
  ];
  const defaultProps = {
    devices: mockDevices,
    links: mockLinks,
    filterType: 'all' as const,
    filterValue: '',
    iconMode: 'role' as const,
    iconStyle: 'simple' as const,
    lod: 1,
    showInterfaces: false,
    selectedEdgeId: null,
    hoveredEdgeId: null,
    showTraffic: false,
    linkMetrics: {},
    zoom: 1,
    onDeviceHover: vi.fn(),
  };
  it('should process devices and stacks correctly', () => {
    const { result } = renderHook(() => useTopologyData(defaultProps));
    expect(result.current.deviceMap.size).toBe(3);
    expect(result.current.validDevices.length).toBe(3);
    
    // Core device should be standalone, APs should be stacked if connected to same parent
    // In this mock, dev2 and dev3 are both connected to dev1 (Core-01)
    const apStackNodes = result.current.topoNodes.filter(n => n.type === 'apStack');
    expect(apStackNodes.length).toBe(1);
    expect(apStackNodes[0].data.count).toBe(2);
    expect(apStackNodes[0].data.parentName).toBe('Core-01');
  });
  it('should handle filtering correctly', () => {
    const { result } = renderHook(() => useTopologyData({
      ...defaultProps,
      filterValue: 'Core-01'
    }));
    const coreNode = result.current.topoNodes.find(n => n.id === 'dev1');
    expect(coreNode?.data.isHighlighted).toBe(true);
    
    const apStackNode = result.current.topoNodes.find(n => n.type === 'apStack');
    expect(apStackNode?.data.isHighlighted).toBeUndefined(); // Stacks don't have isHighlighted in current logic
  });
  it('should calculate topoEdges with correct styling', () => {
    const { result } = renderHook(() => useTopologyData(defaultProps));
    const edges = result.current.topoEdges;
    // We expect 1 stack edge (dev1 -> stack-dev1) instead of 2 individual links
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe('dev1');
    expect(edges[0].target).toBe('stack-dev1');
  });
});
