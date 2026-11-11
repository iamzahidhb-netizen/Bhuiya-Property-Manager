import fs from 'fs';

let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

if (!code.includes('SyncStatusBar')) {
  code = code.replace(
    "import { HyperCard, StatTile, FloatingPillNav, PageTransitionContainer } from './ui/hyperos';",
    "import { HyperCard, StatTile, FloatingPillNav, PageTransitionContainer } from './ui/hyperos';\nimport { SyncStatusBar } from './ui/SyncStatusBar';"
  );

  code = code.replace(
    '<main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] flex-1 w-full">',
    '<main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] flex-1 w-full">\n        <SyncStatusBar className="mb-4" />'
  );
}

fs.writeFileSync('src/components/AdminDashboard.tsx', code, 'utf8');
console.log('AdminDashboard updated with SyncStatusBar');
