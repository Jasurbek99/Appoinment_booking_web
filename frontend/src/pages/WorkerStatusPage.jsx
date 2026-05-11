import { TopBar } from '../components/TopBar.jsx';
import { Empty } from '../components/primitives.jsx';

export function WorkerStatusPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="max-w-2xl mx-auto w-full px-4 py-6">
        <Empty>Public lastname search — lands in Step 16.</Empty>
      </main>
    </div>
  );
}
