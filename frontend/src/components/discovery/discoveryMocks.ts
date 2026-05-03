export const mockDiscoveryResults = [
  {
    local_interface: 'GigabitEthernet1/0/1',
    local_interface_type: 'Interface',
    local_interface_id: '11111111-1111-4111-a111-111111111111',
    remote_device: 'core-switch-01',
    remote_device_id: '22222222-2222-4222-a222-222222222222',
    remote_interface: 'TenGigabitEthernet1/1',
    remote_interface_id: '33333333-3333-4333-a333-333333333333',
    remote_interface_type: 'Interface',
    protocol: 'lldp',
    is_matched: true,
    cable_exists: false
  },
  {
    local_interface: 'GigabitEthernet1/0/2',
    local_interface_type: 'Interface',
    local_interface_id: '44444444-4444-4444-a444-444444444444',
    remote_device: 'unknown-switch',
    remote_device_id: null,
    remote_interface: 'eth0',
    remote_interface_id: null,
    remote_interface_type: 'Interface',
    protocol: 'cdp',
    is_matched: false,
    cable_exists: false
  },
  {
    local_interface: 'GigabitEthernet1/0/3',
    local_interface_type: 'Interface',
    local_interface_id: '55555555-5555-4555-a555-555555555555',
    remote_device: 'distribution-02',
    remote_device_id: '66666666-6666-4666-a666-666666666666',
    remote_interface: 'GigabitEthernet2/0/1',
    remote_interface_id: '77777777-7777-4777-a777-777777777777',
    remote_interface_type: 'Interface',
    protocol: 'lldp',
    is_matched: true,
    cable_exists: true
  },
  {
    local_interface: 'Port 1',
    local_interface_type: 'FrontPort',
    local_interface_id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa',
    remote_device: 'patch-panel-01',
    remote_device_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    remote_interface: 'Port 24',
    remote_interface_id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    remote_interface_type: 'RearPort',
    protocol: 'lldp',
    is_matched: true,
    cable_exists: false
  },
  {
    local_interface: 'TenGigabitEthernet1/1/1',
    local_interface_type: 'Interface',
    local_interface_id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
    local_lag: 'Port-channel10',
    remote_device: 'leaf-02',
    remote_device_id: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
    remote_interface: 'eth1/1',
    remote_interface_id: 'ffffffff-ffff-4fff-afff-ffffffffffff',
    remote_interface_type: 'Interface',
    remote_lag: 'ae1',
    protocol: 'lldp',
    is_matched: true,
    cable_exists: false
  }
];
