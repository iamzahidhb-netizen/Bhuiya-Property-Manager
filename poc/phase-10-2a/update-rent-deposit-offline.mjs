import fs from 'fs';

let code = fs.readFileSync('src/components/finance/RentDepositPage.tsx', 'utf8');

if (!code.includes('SyncStatusBar')) {
  code = code.replace(
    "import { useAppNavigation } from '../../contexts/NavigationContext';",
    "import { useAppNavigation } from '../../contexts/NavigationContext';\nimport { SyncStatusBar } from '../ui/SyncStatusBar';\nimport { getAllItems, STORES } from '../../lib/offlineDb';\nimport { WifiOff } from 'lucide-react';"
  );
}

// Update successInfo type
code = code.replace(
  '  } | null>(null);',
  '    isOffline?: boolean;\n  } | null>(null);'
);

// Update localTenants state fallback
code = code.replace(
  "  const [selectedTenantId, setSelectedTenantId] = useState<string>('');",
  "  const [localTenants, setLocalTenants] = useState<Tenant[]>(tenants);\n\n  useEffect(() => {\n    if (tenants && tenants.length > 0) {\n      setLocalTenants(tenants);\n    } else {\n      getAllItems<Tenant>(STORES.TENANTS).then((cached) => {\n        if (cached && cached.length > 0) setLocalTenants(cached);\n      }).catch(() => {});\n    }\n  }, [tenants]);\n\n  const [selectedTenantId, setSelectedTenantId] = useState<string>('');"
);

// Replace tenants with localTenants
code = code.replace(
  "selectedTenantId || preSelectedTenantId || (tenants.length > 0 ? tenants[0].id : '');",
  "selectedTenantId || preSelectedTenantId || (localTenants.length > 0 ? localTenants[0].id : '');"
);
code = code.replace(
  'const currentTenant = tenants.find((item) => item.id === effectiveTenantId) || null;',
  'const currentTenant = localTenants.find((item) => item.id === effectiveTenantId) || null;'
);
code = code.replace(
  'tenants.map((tItem) => ({',
  'localTenants.map((tItem) => ({'
);

// Update handleSubmit to pass isOffline
code = code.replace(
  "tenantName: currentTenant?.name || (isBn ? 'ভাড়াটিয়া' : 'Tenant'),\n        paymentMethod,\n        paymentDate,\n      });",
  "tenantName: res.tenantName || currentTenant?.name || (isBn ? 'ভাড়াটিয়া' : 'Tenant'),\n        paymentMethod,\n        paymentDate,\n        isOffline: res.isOffline,\n      });"
);

// Add SyncStatusBar at top of main
code = code.replace(
  '<main className="max-w-xl w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 flex-1">',
  '<main className="max-w-xl w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 flex-1">\n        <SyncStatusBar className="mb-3" />'
);

// Add offline alert badge in success card
code = code.replace(
  '<CheckCircle2 className="w-10 h-10" />\n            </div>',
  `<CheckCircle2 className="w-10 h-10" />\n            </div>\n\n            {successInfo.isOffline && (\n              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5 text-left">\n                <WifiOff className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />\n                <div>\n                  <div className="font-bold">\n                    {isBn ? 'অফলাইনে ডিভাইসে সংরক্ষিত হয়েছে' : 'Saved Locally on Device'}\n                  </div>\n                  <div className="text-[11px] opacity-90">\n                    {isBn\n                      ? 'ইন্টারনেট সংযোগ পাওয়া মাত্রই রেকর্ডটি স্বয়ংক্রিয়ভাবে ক্লাউড ফায়ারস্টোরে সিঙ্ক হবে।'\n                      : 'Will automatically synchronize with Firebase Firestore when internet is restored.'}\n                  </div>\n                </div>\n              </div>\n            )}`
);

fs.writeFileSync('src/components/finance/RentDepositPage.tsx', code, 'utf8');
console.log('RentDepositPage updated successfully');
