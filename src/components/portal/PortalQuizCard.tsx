import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import type { OpenQuiz } from '@/lib/supabase';

// A quiz a tutor has opened for this student. Reuses the badge card's CSS: same layout, different content.
export function PortalQuizCard({ quiz, more }: { quiz: OpenQuiz; more: number }) {
  return (
    <div className="portal-badge-card">
      <Link to={`/portal/quizzes/${quiz.id}`} className="portal-badge-open">
        <span className="portal-badge-card-art">
          <Zap size={26} />
        </span>
        <span className="portal-badge-copy">
          <span className="portal-badge-kicker">{quiz.status === 'live' ? 'Quiz live' : 'Quiz starting'}</span>
          <span className="portal-badge-title">{quiz.title}</span>
          <span className="portal-badge-detail-line">{quiz.batches?.name ?? 'Open to everyone'} · Tap to join</span>
          {more > 0 && <span className="portal-badge-more">+{more} more</span>}
        </span>
        <span className="portal-badge-open-arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
