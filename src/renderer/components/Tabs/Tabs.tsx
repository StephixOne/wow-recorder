import { clsx } from 'clsx';
import { PropsWithChildren } from 'react';

type TabsProps = {
  value: string;
  orientation: 'vertical' | 'horizontal';
};

export const Tabs = ({
  value,
  orientation,
  children,
}: PropsWithChildren<TabsProps>) => {
  const classes = clsx(
    'bg-background-layer-1 flex p-4',
    orientation === 'horizontal' && 'flex-col w-full',
    orientation === 'vertical' && 'flex-row h-full'
  );

  return <div className={classes}>{children}</div>;
};

export default Tabs;
