import Quiz from '@/components/Quiz';

export default function Page() {
  return (
    <main className="page">
      <div className="brand">
        <img src="/assets/img/logo/mascot-badge.webp" alt="" width={32} height={32} />
        <span>
          fulfillment<span className="accent-text">buddy</span>
        </span>
      </div>
      <p className="quiz-teaser">
        In 2 Minuten weißt du, worauf es bei eurem Fulfillment als Nächstes wirklich ankommt.
      </p>
      <Quiz />
    </main>
  );
}
