import { useState } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { TodayList } from '../components/TodayList.jsx';
import { NewAppointmentModal } from '../components/NewAppointmentModal.jsx';
import { CausesSection } from '../components/CausesSection.jsx';
import { UsersSection } from '../components/UsersSection.jsx';
import { JournalTable } from '../components/JournalTable.jsx';
import { FutureList } from '../components/FutureList.jsx';
import { VisitorFrequency } from '../components/VisitorFrequency.jsx';
import { Btn } from '../components/primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

const TABS = ['today', 'future', 'journal', 'visitors', 'settings'];

export function StaffDashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState('today');
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar>
        <div className="flex justify-end">
          <Btn size="sm" onClick={() => setNewOpen(true)}>+ Новая заявка</Btn>
        </div>
      </TopBar>
      <NewAppointmentModal open={newOpen} onClose={() => setNewOpen(false)} />
      <nav className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                'px-4 py-3 text-sm border-b-2 transition-colors ' +
                (tab === id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-900')
              }
            >
              {t(id)}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        {tab === 'today' && <TodayList />}
        {tab === 'future' && <FutureStub />}
        {tab === 'journal' && <JournalStub />}
        {tab === 'visitors' && <VisitorsStub />}
        {tab === 'settings' && <SettingsStub />}
      </main>
    </div>
  );
}

function FutureStub() {
  return <FutureList />;
}
function JournalStub() {
  return <JournalTable />;
}
function VisitorsStub() {
  return <VisitorFrequency showBossFilter />;
}
function SettingsStub() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <CausesSection />
      <UsersSection />
    </div>
  );
}
