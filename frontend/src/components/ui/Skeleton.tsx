import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    data-slot="skeleton"
    aria-hidden="true"
    className={cn('animate-pulse rounded-xl bg-[#ebebf0]', className)}
    {...props}
  />
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading content">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-white border border-[#e4e4e9] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
    <div className="rounded-2xl bg-white border border-[#e4e4e9] p-6 space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-44 w-full" />
    </div>
  </div>
);

