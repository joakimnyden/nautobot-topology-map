import { describe, it, expect } from 'vitest';
import { isAP, formatInterfaceName, getLODLevel, formatThroughput } from './topology-utils';
describe('topology-utils', () => {
  describe('isAP', () => {
    it('should return true for access point roles', () => {
      expect(isAP('Access Point')).toBe(true);
      expect(isAP('access-point')).toBe(true);
      expect(isAP('Wireless Access Point')).toBe(true);
    });
    it('should return false for other roles', () => {
      expect(isAP('Router')).toBe(false);
      expect(isAP('Switch')).toBe(false);
      expect(isAP('Core Switch')).toBe(false);
    });
  });
  describe('formatInterfaceName', () => {
    it('should add space between prefix and number', () => {
      expect(formatInterfaceName('GigabitEthernet1')).toBe('GigabitEthernet 1');
      expect(formatInterfaceName('TenGigabitEthernet0/1')).toBe('TenGigabitEthernet 0/1');
    });
    it('should return same string if no number follows prefix', () => {
      expect(formatInterfaceName('eth')).toBe('eth');
      expect(formatInterfaceName('')).toBe('');
    });
  });
  describe('getLODLevel', () => {
    it('should return level 3 for high zoom', () => {
      expect(getLODLevel(0.9)).toBe(3);
    });
    it('should return level 2 for mid zoom', () => {
      expect(getLODLevel(0.6)).toBe(2);
    });
    it('should return level 1 for low zoom', () => {
      expect(getLODLevel(0.3)).toBe(1);
    });
    it('should return level 0 for micro zoom', () => {
      expect(getLODLevel(0.1)).toBe(0);
    });
  });
  describe('formatThroughput', () => {
    it('should format bps correctly', () => {
      expect(formatThroughput(0)).toBe('0 bps');
      expect(formatThroughput(500)).toBe('500 bps');
    });
    it('should format kbps correctly', () => {
      expect(formatThroughput(1500)).toBe('1.5 kbps');
    });
    it('should format Mbps correctly', () => {
      expect(formatThroughput(1500000)).toBe('1.5 Mbps');
    });
    it('should format Gbps correctly', () => {
      expect(formatThroughput(1500000000)).toBe('1.5 Gbps');
    });
  });
});
