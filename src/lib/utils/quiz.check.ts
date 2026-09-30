// Run: node src/lib/utils/quiz.check.ts
import { blankQuestion, draftIssues, newDraft, ordinal, parseQuestions, percent, questionIssue } from './quiz.ts';

const must = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

const csv = parseQuestions('Question,A,B,C,D,Correct\nCapital of France?,Paris,Rome,Oslo,Bern,A\n"Pick two, please",x,y,z,,"A;C"');
must(csv.length === 2, 'header skipped, two rows');
must(csv[0].options.length === 4 && csv[0].options[0].correct && csv[0].options.filter((o) => o.correct).length === 1, 'one correct from the column');
must(csv[1].options.length === 3 && csv[1].options.filter((o) => o.correct).length === 2, 'blank option dropped, two correct');

const tsv = parseQuestions('2+2?\t3\t4\t5\tB');
must(tsv[0].options.length === 3 && tsv[0].options[1].correct, 'tab-separated paste, no header, last cell is the key');

const noKey = parseQuestions('Just a question,yes,no');
must(noKey[0].options.length === 2 && !noKey[0].options.some((o) => o.correct), 'no key: none marked, an option cell called "no" is not a key');

const q = blankQuestion();
must(questionIssue(q) === 'Add the question text', 'empty question flagged first');
q.body = 'Q';
must(questionIssue(q) === 'Needs at least two options', 'options empty');
q.options.forEach((o, i) => { o.label = `o${i}`; });
must(questionIssue(q) === 'Mark the correct answer', 'no key');
q.options[1].correct = true;
must(questionIssue(q) === null, 'valid');

const d = newDraft();
must(draftIssues(d).count === 2, 'blank draft: title + question');
must(percent(1, 3) === 33 && percent(0, 0) === 0, 'percent');
must(ordinal(1) === '1st' && ordinal(2) === '2nd' && ordinal(11) === '11th' && ordinal(23) === '23rd', 'ordinals');
console.log('quiz checks passed');
