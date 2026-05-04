import React from 'react';
import { 
  BaseEdge, 
  EdgeProps, 
  getBezierPath, 
  getSmoothStepPath,
  getStraightPath,
  Position
} from '@xyflow/react';

export function TopologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  type,
}: EdgeProps) {
  const curvature = data?.curvature ?? 0;
  
  let edgePath = '';
  
  if (type === 'bezier' || curvature !== 0) {
    [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: curvature !== 0 ? Math.abs(curvature) : 0.5,
    });
    
    // If curvature is negative, we need to adjust the path or handle it via a custom bezier calculation.
    // For simplicity, we'll use the curvature to bow it out.
    // getBezierPath's curvature is usually 0 to 1.
    if (curvature < 0) {
        // Swap source and target briefly to reverse the curve direction? No, that's messy.
        // Actually, getBezierPath doesn't support negative curvature directly to flip the side.
    }
  } else if (type === 'smoothstep') {
    [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    });
  } else {
    [edgePath] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  }

  return (
    <BaseEdge 
      path={edgePath} 
      markerEnd={markerEnd} 
      style={{
        ...style,
        transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease, filter 0.3s ease',
      }} 
    />
  );
}
