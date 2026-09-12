import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ---------------- Category taxonomy — mirrors the org's existing audit sheet ----------------
export const CATEGORIES = [
  { num: 1,  label: 'Contribution by Guardian(s)',            bucket: 'income'   },
  { num: 2,  label: 'Scholarship Amount Received',             bucket: 'income'   },
  { num: 3,  label: 'Job / Internship Income',                 bucket: 'income'   },
  { num: 4,  label: 'College Financial Aid / Concession',      bucket: 'income'   },
  { num: 5,  label: 'Student Loan',                            bucket: 'income'   },
  { num: 6,  label: 'Personal Loan',                           bucket: 'income'   },
  { num: 7,  label: 'Other Income',                            bucket: 'income'   },
  { num: 8,  label: 'Pocket Money (WWP Support)',              bucket: 'income'   },
  { num: 9,  label: 'Groceries & Meals (WWP Support)',         bucket: 'income'   },
  { num: 10, label: 'Other WWP Support',                       bucket: 'income'   },
  { num: 11, label: 'Rent Contribution',                       bucket: 'fixed'    },
  { num: 12, label: 'Housing Deposit (one-off)',               bucket: 'fixed'    },
  { num: 13, label: 'WiFi / Internet',                         bucket: 'fixed'    },
  { num: 14, label: 'Mobile Recharge',                         bucket: 'fixed'    },
  { num: 15, label: 'Travel (Leisure)',                        bucket: 'fixed'    },
  { num: 16, label: 'Fixed Meal Plan',                         bucket: 'fixed'    },
  { num: 17, label: 'Utilities (Gas / Water / Electric)',      bucket: 'fixed'    },
  { num: 18, label: 'Subscriptions',                           bucket: 'fixed'    },
  { num: 19, label: 'Other Fixed Expenses',                    bucket: 'fixed'    },
  { num: 20, label: 'Tuition Fees (WWP Support)',              bucket: 'fixed'    },
  { num: 21, label: 'Study Material / Books (WWP Support)',    bucket: 'fixed'    },
  { num: 22, label: 'Course Participation Fees (WWP Support)', bucket: 'fixed'    },
  { num: 23, label: 'Travel to College for Exams (WWP Support)', bucket: 'fixed'  },
  { num: 24, label: 'Rent / PG Support (WWP Support)',         bucket: 'fixed'    },
  { num: 25, label: 'One-off PG Deposit (WWP Support)',        bucket: 'fixed'    },
  { num: 26, label: 'Books (Non-study)',                       bucket: 'variable' },
  { num: 27, label: 'Additional Food',                         bucket: 'variable' },
  { num: 28, label: 'Entertainment',                           bucket: 'variable' },
  { num: 29, label: 'Eating Out',                              bucket: 'variable' },
  { num: 30, label: 'Clothes',                                 bucket: 'variable' },
  { num: 31, label: 'Miscellaneous',                           bucket: 'variable' },
  { num: 32, label: 'Health Check-up (WWP In-kind)',           bucket: 'variable' },
  { num: 33, label: 'Mental Health Counselling (WWP In-kind)', bucket: 'variable' },
  { num: 34, label: 'Savings',                                 bucket: 'savings' },
];
export const catByNum = Object.fromEntries(CATEGORIES.map(c => [c.num, c]));
export const BUCKET_LABEL = { income: 'Income', fixed: 'Fixed Expense', variable: 'Variable Expense', savings: 'Savings' };

// ---------------- Formatting ----------------
export const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const monthKey = d => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const monthLabel = mk => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

// ---------------- Firestore access ----------------
export async function fetchGirls() {
  const snap = await getDocs(query(collection(db, 'girls'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchEntries(girlId) {
  const q = girlId
    ? query(collection(db, 'entries'), orderBy('date', 'desc'))
    : query(collection(db, 'entries'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return girlId ? all.filter(e => e.girlId === girlId) : all;
}

export async function addEntry(entry) {
  return addDoc(collection(db, 'entries'), { ...entry, createdAt: new Date().toISOString() });
}

export async function removeEntry(entryId) {
  return deleteDoc(doc(db, 'entries', entryId));
}

// ---------------- Roster bulk upload ----------------
// Reads an uploaded .xlsx/.csv File and returns { rows, errors } — rows are
// { name, pin, cohort } ready to write, errors are 1-indexed row problems.
// Accepts header variants: Name/Girl Name, PIN/Pin Code, Cohort/Batch (case-insensitive).
export async function parseRosterFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headerRow = aoa[0] || [];
  const norm = s => String(s || '').trim().toLowerCase();
  const findCol = candidates => headerRow.findIndex(h => candidates.includes(norm(h)));
  const nameCol = findCol(['name', 'girl name', 'student name']);
  const pinCol = findCol(['pin', 'pin code', 'password']);
  const cohortCol = findCol(['cohort', 'batch', 'group']);

  const rows = [];
  const errors = [];
  if (nameCol === -1 || pinCol === -1) {
    errors.push('Could not find "Name" and "PIN" columns — check the header row matches the template.');
    return { rows, errors };
  }

  aoa.slice(1).forEach((line, i) => {
    const rowNum = i + 2;
    const name = String(line[nameCol] || '').trim();
    const pin = String(line[pinCol] || '').trim();
    const cohort = cohortCol !== -1 ? String(line[cohortCol] || '').trim() : '';
    if (!name && !pin) return; // blank row
    if (!name) { errors.push(`Row ${rowNum}: missing name.`); return; }
    if (!/^\d{4,6}$/.test(pin)) { errors.push(`Row ${rowNum} (${name}): PIN must be 4-6 digits.`); return; }
    rows.push({ name, pin, cohort });
  });
  return { rows, errors };
}

export async function addGirlsBulk(rows) {
  const results = [];
  for (const r of rows) {
    const ref = await addDoc(collection(db, 'girls'), { name: r.name, pin: r.pin, cohort: r.cohort || '' });
    results.push({ id: ref.id, ...r });
  }
  return results;
}

export function downloadRosterTemplate() {
  const rows = [['Name', 'PIN', 'Cohort'], ['e.g. Aarthi K', '1234', 'Cohort A']];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Roster');
  XLSX.writeFile(wb, 'roster_template.xlsx');
}

// ---------------- Aggregation ----------------
export function summarizeByMonth(entries) {
  const byMonth = {};
  entries.forEach(e => {
    const mk = monthKey(e.date);
    if (!byMonth[mk]) byMonth[mk] = { income: 0, fixed: 0, variable: 0, savings: 0, count: 0 };
    const cat = catByNum[e.categoryNum];
    const bucket = cat ? cat.bucket : 'variable';
    byMonth[mk][bucket] += Number(e.amount) || 0;
    byMonth[mk].count += 1;
  });
  return byMonth;
}

export function totalsFor(monthSummary) {
  const A = monthSummary.income, B = monthSummary.fixed, C = monthSummary.variable, D = monthSummary.savings;
  const E = B + C, F = A - E, G = F - D;
  return { A, B, C, D, E, F, G };
}

// ---------------- Excel export (SheetJS — loaded globally as `XLSX` via CDN script tag) ----------------
function ledgerSheetAOA(girlName, entries) {
  const byMonth = summarizeByMonth(entries);
  const months = Object.keys(byMonth).sort();
  const rows = [];
  rows.push([`Money Tracker — ${girlName}`]);
  rows.push([]);
  rows.push(['#', 'Item', ...months.map(monthLabel)]);

  const bucketOrder = ['income', 'fixed', 'variable', 'savings'];
  const bucketTitle = { income: 'Monthly Income', fixed: 'Fixed Expenses', variable: 'Variable Expenses', savings: 'Savings' };

  bucketOrder.forEach(bucket => {
    rows.push([bucketTitle[bucket]]);
    CATEGORIES.filter(c => c.bucket === bucket).forEach(c => {
      const line = [c.num, c.label];
      months.forEach(mk => {
        const sum = entries
          .filter(e => e.categoryNum === c.num && monthKey(e.date) === mk)
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        line.push(sum || '');
      });
      rows.push(line);
    });
    rows.push([]);
  });

  rows.push(['(A) Total Income', '', ...months.map(mk => totalsFor(byMonth[mk]).A)]);
  rows.push(['(B) Total Fixed Expenses', '', ...months.map(mk => totalsFor(byMonth[mk]).B)]);
  rows.push(['(C) Total Variable Expenses', '', ...months.map(mk => totalsFor(byMonth[mk]).C)]);
  rows.push(['(D) Saved', '', ...months.map(mk => totalsFor(byMonth[mk]).D)]);
  rows.push(['(E) Total Expenses (B+C)', '', ...months.map(mk => totalsFor(byMonth[mk]).E)]);
  rows.push(['(F) Balance (A-E)', '', ...months.map(mk => totalsFor(byMonth[mk]).F)]);
  rows.push(['(G) Balance + Saving (F-D)', '', ...months.map(mk => totalsFor(byMonth[mk]).G)]);
  return rows;
}

function entriesRawAOA(entries, girlsById) {
  const header = girlsById
    ? ['Girl', 'Date', 'Category #', 'Category', 'Type', 'Amount', 'Note']
    : ['Date', 'Category #', 'Category', 'Type', 'Amount', 'Note'];
  const rows = [header];
  entries
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(e => {
      const cat = catByNum[e.categoryNum];
      const line = girlsById ? [girlsById[e.girlId]?.name || e.girlId] : [];
      line.push(e.date, e.categoryNum, cat ? cat.label : '', cat ? BUCKET_LABEL[cat.bucket] : '', e.amount, e.note || '');
      rows.push(line);
    });
  return rows;
}

export function exportGirlExcel(girlName, entries) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ledgerSheetAOA(girlName, entries)), 'Tracker');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entriesRawAOA(entries)), 'All Entries');
  XLSX.writeFile(wb, `${girlName.replace(/\s+/g, '_')}_Money_Tracker.xlsx`);
}

export function exportOrgExcel(girls, allEntries) {
  const wb = XLSX.utils.book_new();
  const girlsById = Object.fromEntries(girls.map(g => [g.id, g]));

  const months = [...new Set(allEntries.map(e => monthKey(e.date)))].sort();
  const summaryRows = [['Girl', 'Cohort', 'Month', 'Income (A)', 'Fixed (B)', 'Variable (C)', 'Saved (D)', 'Total Expenses (E)', 'Balance (F)', 'Balance+Saving (G)', 'Entries']];
  girls.forEach(g => {
    const mine = allEntries.filter(e => e.girlId === g.id);
    const byMonth = summarizeByMonth(mine);
    months.forEach(mk => {
      if (!byMonth[mk]) return;
      const t = totalsFor(byMonth[mk]);
      summaryRows.push([g.name, g.cohort || '', monthLabel(mk), t.A, t.B, t.C, t.D, t.E, t.F, t.G, byMonth[mk].count]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entriesRawAOA(allEntries, girlsById)), 'All Entries');

  girls.forEach(g => {
    const mine = allEntries.filter(e => e.girlId === g.id);
    if (!mine.length) return;
    const sheetName = g.name.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || g.id;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ledgerSheetAOA(g.name, mine)), sheetName);
  });

  XLSX.writeFile(wb, `Active_Canvas_All_Girls_${months[months.length - 1] || 'export'}.xlsx`);
}
