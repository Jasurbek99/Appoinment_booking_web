import { TopBar } from '../components/TopBar.jsx';
import { Empty } from '../components/primitives.jsx';

export function StaffDashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Empty>Staff dashboard — Today/Future/Journal/Settings tabs land in Steps 9, 12, 13.</Empty>
      </main>
    </div>
  );
}
