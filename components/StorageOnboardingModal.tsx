import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, FolderHeart, Database, HardDrive, Shield, Zap, FolderOpen, Wifi } from "lucide-react";
import { useDeck } from "@/lib/deck-store";

export function StorageOnboardingModal() {
    const { storagePreference, setStoragePreference, storageLoading } = useDeck();
    const [open, setOpen] = useState(false);
    const [isSetting, setIsSetting] = useState(false);
    const [hovered, setHovered] = useState<"folder" | "local" | null>(null);

    useEffect(() => {
        if (!storageLoading && storagePreference === null) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [storagePreference, storageLoading]);

    const handleSelect = async (pref: "local" | "folder") => {
        setIsSetting(true);
        const success = await setStoragePreference(pref);
        setIsSetting(false);
        if (!success && pref === "folder") {
            // Failed to get folder permissions, let them try again or select local
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => {}}>
            <DialogContent className="w-full sm:max-w-2xl bg-card border-border shadow-2xl shadow-black/60 [&>button]:hidden p-0 overflow-hidden">
                {/* Header banner */}
                <div className="relative w-full px-8 pt-8 pb-6 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-b border-border/60">
                    <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-1">
                            <HardDrive className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight">¿Dónde guardar tus decks?</h2>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Esta app funciona completamente en tu navegador, sin servidor. Elige cómo quieres persistir tus datos.
                        </p>
                    </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
                    {/* Local Folder */}
                    <button
                        onClick={() => !isSetting && handleSelect("folder")}
                        disabled={isSetting}
                        onMouseEnter={() => setHovered("folder")}
                        onMouseLeave={() => setHovered(null)}
                        className={`relative flex flex-col items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer disabled:cursor-not-allowed ${
                            hovered === "folder"
                                ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                : "border-border/60 bg-secondary/20 hover:border-primary/50"
                        }`}
                    >
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wide">
                            Recomendado
                        </span>
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
                                    hovered === "folder"
                                        ? "bg-primary/20 border-primary/40 text-primary"
                                        : "bg-secondary border-border text-muted-foreground"
                                }`}
                            >
                                <FolderHeart className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground text-sm">Carpeta Local</p>
                                <p className="text-[11px] text-muted-foreground">Mejor para Desktop</p>
                            </div>
                        </div>
                        <ul className="space-y-1.5 w-full">
                            {[
                                { icon: <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />, text: "Archivos JSON en tu PC" },
                                {
                                    icon: <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
                                    text: "No se borran al limpiar el browser",
                                },
                                {
                                    icon: <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
                                    text: "Compatible con Tabletop Simulator",
                                },
                            ].map(({ icon, text }) => (
                                <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {icon}
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ul>
                    </button>

                    {/* Browser Storage */}
                    <button
                        onClick={() => !isSetting && handleSelect("local")}
                        disabled={isSetting}
                        onMouseEnter={() => setHovered("local")}
                        onMouseLeave={() => setHovered(null)}
                        className={`relative flex flex-col items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer disabled:cursor-not-allowed ${
                            hovered === "local"
                                ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                                : "border-border/60 bg-secondary/20 hover:border-emerald-500/30"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
                                    hovered === "local"
                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                        : "bg-secondary border-border text-muted-foreground"
                                }`}
                            >
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground text-sm">Browser Storage</p>
                                <p className="text-[11px] text-muted-foreground">Mejor para Mobile</p>
                            </div>
                        </div>
                        <ul className="space-y-1.5 w-full">
                            {[
                                {
                                    icon: <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
                                    text: "Sin configuración, listo al instante",
                                },
                                { icon: <Wifi className="w-3.5 h-3.5 text-sky-400 shrink-0" />, text: "Funciona en cualquier dispositivo" },
                                {
                                    icon: <Shield className="w-3.5 h-3.5 text-yellow-500 shrink-0" />,
                                    text: "Se borra al limpiar datos del sitio",
                                },
                            ].map(({ icon, text }) => (
                                <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {icon}
                                    <span>{text}</span>
                                </li>
                            ))}
                        </ul>
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <p className="text-[11px] text-muted-foreground text-center">
                        Puedes cambiar esto más tarde desde el dashboard con el botón{" "}
                        <span className="text-foreground font-semibold">⚙ Settings</span>.
                    </p>
                    {isSetting && (
                        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-primary animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Configurando almacenamiento...
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
