import { useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Header';
import { ScheduledTable } from '../components/features/scheduled/ScheduledTable';
import { SentTable } from '../components/features/sent/SentTable';
import { ComposeModal } from '../components/features/compose/ComposeModal';
import { SenderLimitsPanel } from '../components/features/limits/SenderLimitsPanel';
import { SearchBar } from '../components/features/search/SearchBar';
import { Button } from '../components/ui/Button';

export default function DashboardPage() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');

  return (
    <div className="dashboard">
      <Header />

      <main className="dashboard-main">
        <div className="dashboard-top">
          <div className="dashboard-top-left">
            <h2 className="dashboard-heading">Email Campaigns</h2>
            <SearchBar />
          </div>
          <Button
            id="compose-btn"
            size="lg"
            onClick={() => setComposeOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Compose email
          </Button>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-tables">
            <TabsPrimitive.Root
              value={activeTab}
              onValueChange={setActiveTab}
              className="tabs-root"
            >
              <TabsPrimitive.List className="tabs-list" aria-label="Email status">
                <TabsPrimitive.Trigger value="scheduled" className="tabs-trigger" id="tab-scheduled">
                  Scheduled
                  {activeTab === 'scheduled' && (
                    <motion.div
                      className="tabs-indicator"
                      layoutId="tab-indicator"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger value="sent" className="tabs-trigger" id="tab-sent">
                  Sent
                  {activeTab === 'sent' && (
                    <motion.div
                      className="tabs-indicator"
                      layoutId="tab-indicator"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>

              <TabsPrimitive.Content value="scheduled" className="tabs-content">
                <ScheduledTable />
              </TabsPrimitive.Content>

              <TabsPrimitive.Content value="sent" className="tabs-content">
                <SentTable />
              </TabsPrimitive.Content>
            </TabsPrimitive.Root>
          </div>

          <div className="dashboard-sidebar">
            <SenderLimitsPanel />
          </div>
        </div>
      </main>

      <ComposeModal open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
