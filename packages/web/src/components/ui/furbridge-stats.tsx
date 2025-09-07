import React from 'react';

export interface StatItem {
  // Add props here
}

export interface FurbridgeStatsProps {
  // Add props here
}

const FurbridgeStats = ({ ...props }) => (
  <div {...props} />
);

export { FurbridgeStats };