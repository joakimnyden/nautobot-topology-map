import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CableDiscovery from '../CableDiscovery';
import { useDiscovery } from '../../hooks/useDiscovery';

// Mock the hook
vi.mock('../../hooks/useDiscovery', () => ({
  useDiscovery: vi.fn()
}));

describe('CableDiscovery Component', () => {
  it('renders without crashing', () => {
    (useDiscovery as any).mockReturnValue({
      selectedSiteId: '',
      setSelectedSiteId: vi.fn(),
      sites: [],
      devices: [],
      selectedDevice: null,
      setSelectedDevice: vi.fn(),
      results: [],
      setResults: vi.fn(),
      isLoading: false,
      isDiscoveringAll: false,
      discoveryProgress: { current: 0, total: 0 },
      importing: false,
      message: '',
      error: null,
      isDevicesLoading: false,
      handleDiscover: vi.fn(),
      handleDiscoverAll: vi.fn(),
      handleImport: vi.fn(),
      cableChoices: []
    });

    render(<CableDiscovery />);
    expect(screen.getByText(/Cable Discovery/i)).toBeDefined();
  });

  it('shows results table when results are present', () => {
    (useDiscovery as any).mockReturnValue({
      selectedSiteId: 'site-1',
      setSelectedSiteId: vi.fn(),
      sites: [],
      devices: [],
      selectedDevice: 'device-1',
      setSelectedDevice: vi.fn(),
      results: [{ 
        local_interface: 'Eth1', 
        remote_device: 'switch-2', 
        remote_interface: 'Eth2',
        is_matched: true,
        cable_exists: false
      }],
      setResults: vi.fn(),
      isLoading: false,
      isDiscoveringAll: false,
      discoveryProgress: { current: 0, total: 0 },
      importing: false,
      message: '',
      error: null,
      isDevicesLoading: false,
      handleDiscover: vi.fn(),
      handleDiscoverAll: vi.fn(),
      handleImport: vi.fn(),
      cableChoices: [{ value: 'cat6', label: 'Cat6' }]
    });

    render(<CableDiscovery />);
    expect(screen.getByPlaceholderText(/Search discovered links/i)).toBeDefined();
  });
});
