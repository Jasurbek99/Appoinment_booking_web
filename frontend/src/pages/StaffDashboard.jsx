import { useState } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { TodayList } from '../components/TodayList.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

const TABS = ['today', 'future', 'journal', 'settings'];

export function StaffDashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState('today');

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
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
        {tab === 'settings' && <SettingsStub />}
      </main>
    </div>
  );
}

function FutureStub() {
  return <div className="text-stone-500 text-sm">Будущие — Шаг 9 (расширение).</div>;
}
function JournalStub() {
  return <div className="text-stone-500 text-sm">Журнал — Шаг 13.</div>;
}
function SettingsStub() {
  return <div className="text-stone-500 text-sm">Настройки — Шаг 12.</div>;
}
