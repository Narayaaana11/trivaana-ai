import React from 'react';
import { MissionControl } from '@/components/dashboard/MissionControl';
import { DashboardTab } from '@/components/dashboard/AppSidebar';

interface CustomerPortalProps {
  onExitDashboard: () => void;
  initialTab?: DashboardTab;
  initialPreset?: string;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = (props) => {
  return <MissionControl {...props} />;
};

