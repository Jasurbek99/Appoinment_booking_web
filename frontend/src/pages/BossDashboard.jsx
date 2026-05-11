import { TopBar } from '../components/TopBar.jsx';
import { Empty } from '../components/primitives.jsx';

export function BossDashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Empty>Boss dashboard — Pending/Queue columns land in Step 10; Analytics in Step 17.</Empty>
      </main>
    </div>
  );
}
