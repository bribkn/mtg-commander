const fs = require('fs');
const path = require('path');

// 1. Refactor DeckDashboard.tsx
let dashboardFile = path.join(__dirname, 'components', 'DeckDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardFile, 'utf8');

dashboardContent = dashboardContent.replace(/import \{ AuthModal \} from '\.\/AuthModal';\r?\n/, '');
dashboardContent = dashboardContent.replace(/import \{ SavedDeck, useDeck \} from '@\/lib\/deck-store';\r?\n/, `import { SavedDeck, useDeck } from '@/lib/deck-store';\nimport { Settings } from 'lucide-react';\n`);

// Update useDeck hook call
dashboardContent = dashboardContent.replace(
  /const \{ decks, dispatch, user, authLoading, logout, isCloudMode \} = useDeck\(\);/,
  `const { decks, dispatch, storagePreference, setStoragePreference, storageLoading } = useDeck();`
);

// Remove AuthModal usages
dashboardContent = dashboardContent.replace(/<AuthModal open=\{isAuthOpen\} onClose=\{.*?\}[^>]*\/>/, '');
dashboardContent = dashboardContent.replace(/const \[isAuthOpen, setIsAuthOpen\] = useState\(false\);/, '');

// Replace Hero section buttons
const heroButtonsRegex = /<div className="mt-6 md:mt-0 flex flex-wrap gap-3 justify-center items-center relative z-10">[\s\S]*?<\/div>/;
const newHeroButtons = `<div className="mt-6 md:mt-0 flex flex-wrap gap-3 justify-center items-center relative z-10">
          {storageLoading ? (
            <Button disabled variant="outline" className="gap-2 h-9 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading Storage...
            </Button>
          ) : storagePreference ? (
            <div className="flex items-center gap-2 bg-secondary/80 border border-border/60 rounded-lg p-1 pr-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs">
                {storagePreference === 'folder' ? <Cloud className="w-4 h-4" /> : <Database className="w-4 h-4" />}
              </div>
              <div className="flex flex-col items-start hidden sm:flex">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase leading-none">Storage</span>
                <span className="text-xs text-foreground font-medium leading-tight mt-0.5">
                  {storagePreference === 'folder' ? 'Local Folder' : 'Browser Storage'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStoragePreference(null)}
                className="w-7 h-7 text-muted-foreground hover:text-primary rounded ml-2"
                title="Change Storage Preference"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : null}
        </div>`;
dashboardContent = dashboardContent.replace(heroButtonsRegex, newHeroButtons);

// Add Database icon import
if (!dashboardContent.includes('Database')) {
    dashboardContent = dashboardContent.replace(/Cloud, LogOut, Loader2/g, 'Cloud, Database, Loader2');
}
dashboardContent = dashboardContent.replace(/isCloudMode \? 'the cloud \(Supabase sync\)' : "your browser's local storage"/, 
  `storagePreference === 'folder' ? 'your selected local folder' : 'your browser\\'s local storage'`);

// Also change the loading message
dashboardContent = dashboardContent.replace(/authLoading \? \(/, `storageLoading ? (`);


fs.writeFileSync(dashboardFile, dashboardContent, 'utf8');
console.log('DeckDashboard refactored successfully.');

// 2. Refactor app/page.tsx
let pageFile = path.join(__dirname, 'app', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

pageContent = pageContent.replace(/import \{ DeckDashboard \} from '@\/components\/DeckDashboard';\r?\n/, `import { DeckDashboard } from '@/components/DeckDashboard';\nimport { StorageOnboardingModal } from '@/components/StorageOnboardingModal';\n`);

// Replace `<DeckDashboard onOpenSplit={handleOpenSplit} onShareOpen={openShare} />\n        {modals}`
pageContent = pageContent.replace(/<DeckDashboard onOpenSplit=\{handleOpenSplit\} onShareOpen=\{openShare\} \/>/, `<DeckDashboard onOpenSplit={handleOpenSplit} onShareOpen={openShare} />\n        <StorageOnboardingModal />`);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('Page refactored successfully.');
