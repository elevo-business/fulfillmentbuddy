import Quiz from '@/components/Quiz';

export default function Page() {
  return (
    <main className="page">
      <div className="brand">
        <img src="/logo/mascot-badge.webp" alt="" width={32} height={32} />
        <span>
          fulfillment<span className="accent-text">buddy</span>
        </span>
      </div>
      <Quiz />
    </main>
  );
}
