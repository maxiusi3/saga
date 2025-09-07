import React from 'react';
import { Button, ButtonProps } from './button';

export type FurbridgeButtonProps = ButtonProps;

const FurbridgeButton = React.forwardRef<HTMLButtonElement, FurbridgeButtonProps>(
  ({ ...props }, ref) => {
    return <Button ref={ref} {...props} />;
  }
);

FurbridgeButton.displayName = 'FurbridgeButton';

export { FurbridgeButton };