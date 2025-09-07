import React from 'react';

const FurbridgeCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  />
));
FurbridgeCard.displayName = 'FurbridgeCard';

export { FurbridgeCard };