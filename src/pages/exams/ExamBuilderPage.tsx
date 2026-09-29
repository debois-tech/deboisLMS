import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Copy, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react';
import { clsx } from 'clsx';
import { QuizOption, QuizSegment, QuizTimer } from '@/components/exams/QuizParts';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { NotFound } from '@/components/ui/NotFound';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/context/AuthContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import {
  getBatches, getQuiz, openQuizLobby, QUIZ_IMAGE_ACCEPT, QUIZ_IMAGE_EXTENSIONS, QUIZ_IMAGE_MAX_BYTES,
  quizImageUrl, saveQuiz, uploadQuizImage,
} from '@/lib/supabase';
import type { Batch, QuizDraft, QuizDraftQuestion } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { extensionOf } from '@/lib/utils/files';
import {
  answeringSeconds, blankQuestion, draftIssues, MAX_OPTIONS, MIN_OPTIONS, newDraft, OPTION_LETTERS, parseQuestions,
  questionIssue, quizToDraft, TIME_PRESETS,
} from '@/lib/utils/quiz';

const EVERYONE = 'everyone';

// Admin `/exams/new`, `/exams/:quizId/edit`, tutor equivalents. `?from=<id>` starts a copy of another quiz.
export default function ExamBuilderPage() {
  const { quizId } = useParams();
  const [search] = useSearchParams();
  const from = search.get('from');
  const { isAdmin } = useAuth();
  const base = isAdmin ? '/exams' : '/tutor/exams';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [draft, setDraft] = useState<QuizDraft>(newDraft);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'lobby' | null>(null);
  const [tried, setTried] = useState(false);
  const [importing, setImporting] = useState(false);
  const [missing, setMissing] = useState(false);
  // An admin's null batch means everyone, so it must be a choice and not a default.
  const [audienceSet, setAudienceSet] = useState(false);

  const { loading, error, retry } = useInitialLoad(async () => {
    const [batchRows, source] = await Promise.all([getBatches(), quizId || from ? getQuiz((quizId ?? from)!) : undefined]);
    setBatches(batchRows);
    if (quizId || from) {
      if (!source) {
        setMissing(true);
        return;
      }
      if (quizId && source.status !== 'draft') {
        navigate(`${base}/${quizId}`, { replace: true });
        return;
      }
      const loaded = quizToDraft(source, Boolean(from));
      setDraft(loaded);
      setOpen(loaded.questions[0]?.key ?? null);
      setDirty(Boolean(from));
      setAudienceSet(true);
    } else {
      const fresh = newDraft();
      // A tutor with one batch has nothing to choose.
      if (!isAdmin && batchRows.length === 1) {
        fresh.batch_id = batchRows[0].id;
        setAudienceSet(true);
      }
      setDraft(fresh);
      setOpen(fresh.questions[0].key);
    }
  });

  const change = (fn: (current: QuizDraft) => QuizDraft) => {
    setDirty(true);
    setDraft(fn);
  };
  const patch = (fields: Partial<QuizDraft>) => change((current) => ({ ...current, ...fields }));
  const patchQuestion = (key: string, fn: (question: QuizDraftQuestion) => QuizDraftQuestion) =>
    change((current) => ({ ...current, questions: current.questions.map((question) => (question.key === key ? fn(question) : question)) }));

  const issues = draftIssues(draft);
  const audienceMissing = !audienceSet;

  const addQuestion = () => {
    const question = blankQuestion();
    change((current) => ({ ...current, questions: [...current.questions, question] }));
    setOpen(question.key);
  };

  const removeQuestion = async (key: string) => {
    const question = draft.questions.find((item) => item.key === key)!;
    if (question.body.trim() || question.options.some((option) => option.label.trim())) {
      const accepted = await confirm({ title: 'Delete this question?', message: 'It cannot be brought back.', confirmLabel: 'Delete question', danger: true });
      if (!accepted) return;
    }
    change((current) => ({ ...current, questions: current.questions.filter((item) => item.key !== key) }));
    if (open === key) setOpen(null);
  };

  const move = (key: string, delta: number) =>
    change((current) => {
      const list = [...current.questions];
      const at = list.findIndex((item) => item.key === key);
      const to = at + delta;
      if (to < 0 || to >= list.length) return current;
      [list[at], list[to]] = [list[to], list[at]];
      return { ...current, questions: list };
    });

  const duplicate = (key: string) => {
    const copy = { ...draft.questions.find((item) => item.key === key)! };
    copy.key = crypto.randomUUID();
    copy.options = copy.options.map((option) => ({ ...option, key: crypto.randomUUID() }));
    change((current) => {
      const at = current.questions.findIndex((item) => item.key === key);
      return { ...current, questions: [...current.questions.slice(0, at + 1), copy, ...current.questions.slice(at + 1)] };
    });
    setOpen(copy.key);
  };

  const save = async (openLobby: boolean) => {
    setTried(true);
    if (issues.title || audienceMissing) {
      showToast(issues.title ? 'Give the quiz a title' : 'Choose who this quiz is for', 'error');
      return;
    }
    if (openLobby && issues.count > 0) {
      const first = issues.questions.findIndex(Boolean);
      if (first >= 0) setOpen(draft.questions[first].key);
      showToast(first >= 0 ? `Question ${first + 1}: ${issues.questions[first]}` : 'Add at least one question', 'error');
      return;
    }
    setSaving(openLobby ? 'lobby' : 'draft');
    try {
      const id = await saveQuiz(draft);
      if (openLobby) await openQuizLobby(id);
      setDirty(false);
      showToast(openLobby ? 'Lobby is open' : 'Draft saved');
      navigate(`${base}/${id}`);
    } catch (err) {
      showToast(errorMessage(err, 'Could not save the quiz'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const leave = async () => {
    if (dirty) {
      const accepted = await confirm({ title: 'Discard your changes?', message: 'What you entered here is not saved.', confirmLabel: 'Discard', danger: true });
      if (!accepted) return;
    }
    navigate(base);
  };

  const activeQuestion = draft.questions.find((question) => question.key === open) ?? draft.questions[0];
  const activeSeconds = activeQuestion?.seconds ?? draft.seconds_per_question;
  const totalSeconds = answeringSeconds(draft);

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (missing) return <NotFound label="Quiz" />;

  return (
    <div className="page-section">
      <button type="button" onClick={() => void leave()} className="flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> All exams
      </button>
      <PageHeader title={quizId ? 'Edit quiz' : 'New quiz'} />

      <div className="qz-builder">
        <div className="qz-builder-main">
          <section className="qz-section" aria-labelledby="qz-basics">
            <h2 id="qz-basics" className="qz-section-title">Basics</h2>
            <div className="qz-form-grid">
              <div className="qz-wide">
                <FormField label="Title" required>
                  <input
                    value={draft.title}
                    onChange={(event) => patch({ title: event.target.value })}
                    placeholder="Linux fundamentals, week 2"
                    maxLength={120}
                    aria-invalid={tried && issues.title}
                  />
                  {tried && issues.title && <span className="qz-hint is-warn">A quiz needs a title.</span>}
                </FormField>
              </div>
              <div className="qz-wide">
                <FormField label="Who can join" required>
                  <BatchSelect
                    batches={batches}
                    value={audienceSet ? draft.batch_id ?? EVERYONE : null}
                    onChange={(id) => {
                      setAudienceSet(true);
                      patch({ batch_id: id === EVERYONE ? null : id });
                    }}
                    extraOptions={isAdmin ? [{ id: EVERYONE, name: 'Everyone (all students)' }] : []}
                    placeholder="Choose a batch"
                  />
                  {tried && audienceMissing && <span className="qz-hint is-warn">Choose the batch this quiz is for.</span>}
                </FormField>
              </div>
            </div>
          </section>

          <section className="qz-section" aria-labelledby="qz-rules">
            <h2 id="qz-rules" className="qz-section-title">Rules</h2>
            <div className="qz-rules">
              <div className="qz-rule">
                <span className="qz-rule-label">Time per question</span>
                <QuizSegment
                  label="Time per question"
                  value={String(draft.seconds_per_question)}
                  onChange={(value) => patch({ seconds_per_question: Number(value) })}
                  options={TIME_PRESETS.map((seconds) => ({ value: String(seconds), label: `${seconds}s` }))}
                />
              </div>
              <div className="qz-rule">
                <span className="qz-rule-label">After each question, students see</span>
                <QuizSegment
                  label="After each question"
                  value={draft.show_answer ? 'answer' : 'split'}
                  onChange={(value) => patch({ show_answer: value === 'answer' })}
                  options={[{ value: 'answer', label: 'The right answer' }, { value: 'split', label: 'Percentages only' }]}
                />
              </div>
              <div className="qz-rule">
                <span className="qz-rule-label">Leaderboard</span>
                <QuizSegment
                  label="Leaderboard"
                  value={draft.live_leaderboard ? 'each' : 'end'}
                  onChange={(value) => patch({ live_leaderboard: value === 'each' })}
                  options={[{ value: 'each', label: 'After every question' }, { value: 'end', label: 'Only at the end' }]}
                />
              </div>
              <div className="qz-rule">
                <span className="qz-rule-label">When it is over</span>
                <QuizSegment
                  label="After the quiz"
                  value={draft.student_review ? 'review' : 'score'}
                  onChange={(value) => patch({ student_review: value === 'review' })}
                  options={[{ value: 'review', label: 'Students can review answers' }, { value: 'score', label: 'Score and rank only' }]}
                />
              </div>
            </div>
          </section>

          <section className="qz-section" aria-labelledby="qz-questions">
            <div className="qz-section-head">
              <h2 id="qz-questions" className="qz-section-title">Questions ({draft.questions.length})</h2>
              <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => setImporting(true)}>
                <Upload size={14} /> Import
              </Button>
            </div>

            <div className="qz-qlist">
              {draft.questions.map((question, index) => (
                <QuestionCard
                  key={question.key}
                  question={question}
                  index={index}
                  last={index === draft.questions.length - 1}
                  isOpen={open === question.key}
                  issue={issues.questions[index]}
                  defaultSeconds={draft.seconds_per_question}
                  batchId={draft.batch_id}
                  canUpload={isAdmin ? audienceSet : Boolean(draft.batch_id)}
                  onToggle={() => setOpen(open === question.key ? null : question.key)}
                  onChange={(fn) => patchQuestion(question.key, fn)}
                  onMove={(delta) => move(question.key, delta)}
                  onDuplicate={() => duplicate(question.key)}
                  onDelete={() => void removeQuestion(question.key)}
                />
              ))}
            </div>

            <button type="button" className="qz-drop" onClick={addQuestion}>
              <Plus size={16} /> Add question
            </button>
          </section>
        </div>

        {activeQuestion && (
          <aside className="qz-preview" aria-label="Student view">
            <div className="qz-panel">
              <div className="qz-panel-head">Student view</div>
              <div className="qz-panel-body">
                <QuizTimer left={activeSeconds} total={activeSeconds} />
                <p className="qz-question" style={{ fontSize: '1.125rem' }}>{activeQuestion.body || 'Your question appears here'}</p>
                {activeQuestion.image_path && <img className="qz-image" src={quizImageUrl(activeQuestion.image_path)} alt="" />}
                <div className="qz-opts">
                  {activeQuestion.options.map((option, index) => (
                    <QuizOption key={option.key} index={index} label={option.label || `Option ${OPTION_LETTERS[index]}`} />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      <div className="qz-savebar">
        <div className="qz-savebar-info">
          <span>{draft.questions.length} {draft.questions.length === 1 ? 'question' : 'questions'}</span>
          <span>About {Math.max(1, Math.round(totalSeconds / 60))} min of answering</span>
          {issues.count > 0 && <Badge variant="warning" dot>{issues.count} to fix</Badge>}
        </div>
        <div className="qz-savebar-actions">
          <Button className="action-button-compact" variant="ghost" onClick={() => void leave()}>Cancel</Button>
          <Button className="action-button-compact" variant="secondary" loading={saving === 'draft'} disabled={saving !== null} onClick={() => void save(false)}>Save draft</Button>
          <Button className="action-button-compact" loading={saving === 'lobby'} disabled={saving !== null} onClick={() => void save(true)}>Save and open lobby</Button>
        </div>
      </div>

      <ImportModal
        open={importing}
        onClose={() => setImporting(false)}
        onAdd={(added) => {
          change((current) => {
            const blankOnly = current.questions.length === 1 && questionIssue(current.questions[0]) === 'Add the question text' && !current.questions[0].options.some((option) => option.label.trim());
            return { ...current, questions: [...(blankOnly ? [] : current.questions), ...added] };
          });
          setOpen(added[0].key);
          setImporting(false);
          showToast(`${added.length} ${added.length === 1 ? 'question' : 'questions'} added`);
        }}
      />
    </div>
  );
}

interface QuestionCardProps {
  question: QuizDraftQuestion;
  index: number;
  last: boolean;
  isOpen: boolean;
  issue: string | null;
  defaultSeconds: number;
  batchId: string | null;
  canUpload: boolean;
  onToggle: () => void;
  onChange: (fn: (question: QuizDraftQuestion) => QuizDraftQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function QuestionCard({
  question, index, last, isOpen, issue, defaultSeconds, batchId, canUpload, onToggle, onChange, onMove, onDuplicate, onDelete,
}: QuestionCardProps) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (isOpen) cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isOpen]);

  const correctCount = question.options.filter((option) => option.correct).length;
  const untouched = !question.body.trim() && !question.options.some((option) => option.label.trim());

  const focusOption = (key: string) => requestAnimationFrame(() => document.getElementById(`opt-${key}`)?.focus());

  const addOption = () => {
    if (question.options.length >= MAX_OPTIONS) return;
    const key = crypto.randomUUID();
    onChange((current) => ({ ...current, options: [...current.options, { key, label: '', correct: false }] }));
    focusOption(key);
  };

  const removeOption = (key: string) => {
    if (question.options.length <= MIN_OPTIONS) return;
    onChange((current) => ({ ...current, options: current.options.filter((option) => option.key !== key) }));
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!(QUIZ_IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
      showToast('Use a PNG, JPG or WebP image', 'error');
      return;
    }
    if (file.size > QUIZ_IMAGE_MAX_BYTES) {
      showToast('That image is over 5 MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const path = await uploadQuizImage(batchId, file);
      onChange((current) => ({ ...current, image_path: path }));
    } catch (err) {
      showToast(errorMessage(err, 'Could not upload the image'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const onOptionKey = (event: React.KeyboardEvent<HTMLInputElement>, optionIndex: number) => {
    const option = question.options[optionIndex];
    if (event.key === 'Enter') {
      event.preventDefault();
      if (optionIndex === question.options.length - 1) addOption();
      else focusOption(question.options[optionIndex + 1].key);
    } else if (event.key === 'Backspace' && !option.label && question.options.length > MIN_OPTIONS) {
      event.preventDefault();
      removeOption(option.key);
      focusOption(question.options[Math.max(0, optionIndex - 1)].key);
    }
  };

  return (
    <div ref={cardRef} className={clsx('qz-qcard', isOpen && 'is-open', issue && !untouched && 'has-issue')}>
      <div className="qz-qhead">
        <button type="button" className="qz-qsummary" onClick={onToggle} aria-expanded={isOpen}>
          <ChevronRight size={16} className={clsx('qz-chevron', isOpen && 'is-open')} aria-hidden="true" />
          <span className="qz-qnum">{index + 1}</span>
          <span className={clsx('qz-qtext', !question.body.trim() && 'is-empty')}>{question.body.trim() || 'Untitled question'}</span>
          <span className="qz-qmeta">
            {issue && !untouched ? (
              <Badge variant="warning" size="sm">{issue}</Badge>
            ) : (
              <>
                {question.seconds && <Badge size="sm">{question.seconds}s</Badge>}
                {question.image_path && <Badge size="sm">Image</Badge>}
                <Badge size="sm">{question.options.length} options</Badge>
              </>
            )}
          </span>
        </button>
        <div className="qz-qtools">
          <button type="button" className="qz-icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up"><ChevronUp size={16} /></button>
          <button type="button" className="qz-icon-btn" onClick={() => onMove(1)} disabled={last} aria-label="Move down"><ChevronDown size={16} /></button>
          <button type="button" className="qz-icon-btn" onClick={onDuplicate} aria-label="Duplicate question"><Copy size={16} /></button>
          <button type="button" className="qz-icon-btn is-danger" onClick={onDelete} aria-label="Delete question"><Trash2 size={16} /></button>
        </div>
      </div>

      {isOpen && (
        <div className="qz-qbody">
          <FormField label="Question">
            <textarea
              value={question.body}
              onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
              rows={2}
              placeholder="What does chmod 755 change?"
              autoFocus={!question.body}
            />
          </FormField>

          {question.image_path ? (
            <div className="qz-thumb">
              <img className="qz-image" src={quizImageUrl(question.image_path)} alt="" />
              <button type="button" className="qz-icon-btn" onClick={() => onChange((current) => ({ ...current, image_path: null }))} aria-label="Remove image">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={clsx('qz-drop', over && 'is-over')}
                disabled={uploading}
                onClick={() => (canUpload ? fileRef.current?.click() : showToast('Choose who this quiz is for first', 'error'))}
                onDragOver={(event) => { event.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(event) => { event.preventDefault(); setOver(false); if (canUpload) void upload(event.dataTransfer.files[0]); }}
              >
                <ImagePlus size={16} /> {uploading ? 'Uploading' : 'Add an image'}
              </button>
              <input ref={fileRef} type="file" accept={QUIZ_IMAGE_ACCEPT} hidden onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
            </>
          )}

          <div className="qz-edit-opts">
            {question.options.map((option, optionIndex) => (
              <div key={option.key} className="qz-edit-opt">
                <span className="qz-edit-letter" aria-hidden="true">{OPTION_LETTERS[optionIndex]}</span>
                <input
                  id={`opt-${option.key}`}
                  value={option.label}
                  onChange={(event) => onChange((current) => ({ ...current, options: current.options.map((item) => (item.key === option.key ? { ...item, label: event.target.value } : item)) }))}
                  onKeyDown={(event) => onOptionKey(event, optionIndex)}
                  placeholder={`Option ${OPTION_LETTERS[optionIndex]}`}
                  aria-label={`Option ${OPTION_LETTERS[optionIndex]}`}
                />
                <button
                  type="button"
                  className="qz-correct-btn"
                  aria-pressed={option.correct}
                  aria-label={`Option ${OPTION_LETTERS[optionIndex]} is correct`}
                  onClick={() => onChange((current) => ({ ...current, options: current.options.map((item) => (item.key === option.key ? { ...item, correct: !item.correct } : item)) }))}
                >
                  <Check size={16} />
                </button>
                <button type="button" className="qz-icon-btn" onClick={() => removeOption(option.key)} disabled={question.options.length <= MIN_OPTIONS} aria-label={`Remove option ${OPTION_LETTERS[optionIndex]}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Button className="action-button-compact" variant="ghost" size="sm" onClick={addOption} disabled={question.options.length >= MAX_OPTIONS}>
              <Plus size={14} /> Add option
            </Button>
            <div className="w-56 max-w-full">
              <SearchSelect
                showSearch={false}
                value={question.seconds ? String(question.seconds) : ''}
                onChange={(value) => onChange((current) => ({ ...current, seconds: value ? Number(value) : null }))}
                options={[{ value: '', label: `Time: same as quiz (${defaultSeconds}s)` }, ...TIME_PRESETS.map((seconds) => ({ value: String(seconds), label: `Time: ${seconds}s` }))]}
                placeholder="Time"
                searchPlaceholder="Time"
                emptyText="No options"
              />
            </div>
          </div>

          {correctCount > 1 && <p className="qz-hint">{correctCount} correct answers: a student has to pick all of them to score.</p>}
          {issue && !untouched && <p className="qz-hint is-warn">{issue}.</p>}
        </div>
      )}
    </div>
  );
}

function ImportModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (questions: QuizDraftQuestion[]) => void }) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = parseQuestions(text);
  const unkeyed = parsed.filter((question) => !question.options.some((option) => option.correct)).length;

  const close = () => {
    setText('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import questions"
      size="lg"
      footer={
        <>
          <Button className="action-button-compact" variant="ghost" onClick={close}>Cancel</Button>
          <Button className="action-button-compact" disabled={parsed.length === 0} onClick={() => { onAdd(parsed); setText(''); }}>
            {parsed.length > 0 ? `Add ${parsed.length} ${parsed.length === 1 ? 'question' : 'questions'}` : 'Add questions'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="qz-format">
          One question per row: the question, up to six options, then the letters of the right answers.
          <pre>{'Question,A,B,C,D,Correct\nWhich command lists files?,ls,cd,pwd,cat,A'}</pre>
        </div>
        <FormField label="Paste rows from Excel or a CSV">
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} spellCheck={false} className="font-mono" />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button className="action-button-compact" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Choose a file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setText);
              event.target.value = '';
            }}
          />
          {text.trim() && (
            <p className={clsx('text-sm', parsed.length === 0 ? 'text-[var(--danger-text)]' : 'text-[var(--text-secondary)]')}>
              {parsed.length === 0
                ? 'No questions found in that text.'
                : `${parsed.length} found${unkeyed > 0 ? `, ${unkeyed} without a correct answer marked` : ''}`}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
