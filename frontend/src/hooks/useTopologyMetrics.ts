import { useState, useEffect } from 'react';

interface UseTopologyMetricsProps {
  showTraffic: boolean;
  siteId: string;
}

export function useTopologyMetrics({ showTraffic, siteId }: UseTopologyMetricsProps) {
  const [linkMetrics, setLinkMetrics] = useState<Record<string, { tx: number; rx: number; utilization: number }>>({});

  useEffect(() => {
    if (!showTraffic) {
      setLinkMetrics({});
      return;
    }

    const fetchMetrics = () => {
      fetch(`/api/plugins/nautobot_topology/topology/${siteId}/metrics/`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setLinkMetrics(data.data.metrics || {});
          }
        })
        .catch(err => console.error('Error fetching metrics:', err));
    };

    fetchMetrics(); // Initial fetch
    const interval = setInterval(fetchMetrics, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [showTraffic, siteId]);

  return { linkMetrics };
}
