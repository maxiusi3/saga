import React from 'react';

export interface FurbridgeHeroProps {
  // Add props here
}

const FurbridgeHero = ({ ...props }) => (
  <div {...props} />
);

export { FurbridgeHero };