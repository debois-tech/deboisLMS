// Run: node src/lib/utils/studentImport.check.ts
import { normalizeRole, planImportFee, planImportRows } from './studentImport.ts';

const must = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

const fee = (row: Record<string, string>) => planImportFee(row, 10000);

must(JSON.stringify(fee({ Fee: '₹9,000/-' })) === '{"fee":9000,"discount":1000}', 'fee becomes discount');
must(JSON.stringify(fee({ Fee: '8000', Discount: '500' })) === '{"fee":8000,"discount":2000}', 'fee wins over discount');
must(JSON.stringify(fee({ Fee: '', Discount: '1000' })) === '{"fee":9000,"discount":1000}', 'blank fee falls to discount');
must(JSON.stringify(fee({ Discount: '10%' })) === '{"fee":9000,"discount":1000}', 'percent of base');
must(JSON.stringify(fee({ Discount: '100%' })) === '{"fee":0,"discount":10000}', '100% is free');
must(JSON.stringify(fee({ Fee: '0' })) === '{"fee":0,"discount":10000}', 'fee 0 is free');
must(JSON.stringify(fee({})) === '{"fee":0,"discount":10000}', 'both empty is free');
must('error' in fee({ Fee: '12000' }), 'fee above base rejected');
must('error' in fee({ Discount: '150%' }), 'discount above base rejected');
must('error' in fee({ Fee: 'abc' }), 'unreadable fee rejected');

const plan = planImportRows([{ Name: 'A', Fee: '9000' }, { Name: 'B', Fee: '99999' }], 10000);
must(plan.ready.length === 1 && plan.rejected[0].name === 'B', 'bad row named, good row kept');

must(normalizeRole('AI/ML Engineering Intern') === normalizeRole('aiml engineering  intern'), 'role match ignores case and punctuation');

console.log('studentImport ok');
