import React from 'react';

export type FurbridgeCardProps = React.HTMLAttributes<HTMLDivElement>

const FurbridgeCard = React.forwardRef<
  HTMLDivElement,
  FurbridgeCardProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  />
));
FurbridgeCard.displayName = 'FurbridgeCard';

export { FurbridgeCard };
