import React from 'react';

export interface NavigationItem {
  label: string
  href: string
}

export type FurbridgeHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  navigation?: NavigationItem[]
}

const FurbridgeHeader = ({ ...props }: FurbridgeHeaderProps) => (
  <div {...props} />
);

export { FurbridgeHeader };
