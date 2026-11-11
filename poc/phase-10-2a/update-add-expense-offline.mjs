import fs from 'fs';

let code = fs.readFileSync('src/components/finance/AddExpensePage.tsx', 'utf8');

// Add SyncStatusBar & WifiOff imports
if (!code.includes('SyncStatusBar')) {
  code = code.replace(
    "import { useAppNavigation } from '../../contexts/NavigationContext';",
    "import { useAppNavigation } from '../../contexts/NavigationContext';\nimport { SyncStatusBar } from '../ui/SyncStatusBar';\nimport { WifiOff } from 'lucide-react';"
  );
}

// Update successInfo state type
code = code.replace(
  '    expenseDate: string;\n  } | null>(null);',
  '    expenseDate: string;\n    isOffline?: boolean;\n  } | null>(null);'
);

// Update handleSubmit to save isOffline
code = code.replace(
  '      await createExpense({\n        title: cleanTitle,\n        amount: numAmount,\n        group: \'building\',\n        category,\n        expenseDate,\n        propertyId: propertyId || undefined,\n        description: description.trim() || undefined,\n        paymentMethod: \'cash\',\n      });\n\n      setSuccessInfo({\n        title: cleanTitle,\n        amount: numAmount,\n        category,\n        expenseDate,\n      });',
  `      const res = await createExpense({
        title: cleanTitle,
        amount: numAmount,
        group: 'building',
        category,
        expenseDate,
        propertyId: propertyId || undefined,
        description: description.trim() || undefined,
        paymentMethod: 'cash',
      });

      setSuccessInfo({
        title: cleanTitle,
        amount: numAmount,
        category,
        expenseDate,
        isOffline: res.isOffline,
      });`
);

// Add SyncStatusBar at top of main
code = code.replace(
  '<main className="max-w-xl w-full mx-auto px-3.5 sm:px-6 py-3 sm:py-4 flex-1">',
  '<main className="max-w-xl w-full mx-auto px-3.5 sm:px-6 py-3 sm:py-4 flex-1">\n        <SyncStatusBar className="mb-3" />'
);

// Add offline alert badge in success card
code = code.replace(
  '<CheckCircle2 className="w-8 h-8" />\n            </div>',
  `<CheckCircle2 className="w-8 h-8" />\n            </div>\n\n            {successInfo.isOffline && (\n              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5 text-left">\n                <WifiOff className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />\n                <div>\n                  <div className="font-bold">\n                    {isBn ? 'অফলাইনে ডিভাইসে সংরক্ষিত হয়েছে' : 'Saved Locally on Device'}\n                  </div>\n                  <div className="text-[11px] opacity-90">\n                    {isBn\n                      ? 'ইন্টারনেট সংযোগ পাওয়া মাত্রই খরচটি স্বয়ংক্রিয়ভাবে ক্লাউড ফায়ারস্টোরে সিঙ্ক হবে।'\n                      : 'Will automatically synchronize with Firebase Firestore when internet is restored.'}\n                  </div>\n                </div>\n              </div>\n            )}`
);

fs.writeFileSync('src/components/finance/AddExpensePage.tsx', code, 'utf8');
console.log('AddExpensePage updated with offline capabilities');
