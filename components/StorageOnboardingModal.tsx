import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Database, FolderHeart, Loader2 } from 'lucide-react';
import { useDeck } from '@/lib/deck-store';

export function StorageOnboardingModal() {
  const { storagePreference, setStoragePreference, storageLoading } = useDeck();
  const [open, setOpen] = useState(false);
  const [isSetting, setIsSetting] = useState(false);

  useEffect(() => {
    if (!storageLoading && storagePreference === null) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [storagePreference, storageLoading]);

  const handleSelect = async (pref: 'local' | 'folder') => {
    setIsSetting(true);
    const success = await setStoragePreference(pref);
    setIsSetting(false);
    if (!success && pref === 'folder') {
      // Failed to get folder permissions, let them try again or select local
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to MTG Commander</DialogTitle>
          <DialogDescription className="text-sm">
            Please choose how you want to save your decks and data. This app runs completely in your browser without a backend.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            onClick={() => handleSelect('folder')}
            disabled={isSetting}
            className="flex flex-col items-start gap-1 p-4 h-auto border-primary/40 hover:border-primary hover:bg-primary/10 transition-all text-left"
          >
            <div className="flex items-center gap-2 text-primary font-bold">
              <FolderHeart className="w-5 h-5" />
              Local Folder (Recommended on Desktop)
            </div>
            <p className="text-xs text-muted-foreground whitespace-normal leading-tight">
              Select a folder on your PC. Decks will be saved as individual JSON files that you can easily back up or share.
            </p>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSelect('local')}
            disabled={isSetting}
            className="flex flex-col items-start gap-1 p-4 h-auto border-border hover:border-foreground/40 hover:bg-secondary/30 transition-all text-left"
          >
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Database className="w-5 h-5 text-emerald-400" />
              Browser Storage (Recommended on Mobile)
            </div>
            <p className="text-xs text-muted-foreground whitespace-normal leading-tight">
              Save everything inside the browser's local memory. Quick and easy, but clearing site data will delete your decks.
            </p>
          </Button>

          {isSetting && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              Configuring storage...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
