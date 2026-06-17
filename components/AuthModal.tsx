'use client';

import { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setErrorMsg('Por favor completa todos los campos.');
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        
        if (error) throw error;

        // Check if confirmation email is required
        if (data.session) {
          if (onSuccess) onSuccess();
          onClose();
        } else {
          setSuccessMsg('¡Registro exitoso! Por favor verifica tu correo electrónico.');
          setEmail('');
          setPassword('');
        }
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setErrorMsg(err.message || 'Ocurrió un error en la autenticación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-card border-border shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient-red text-xl font-bold">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            {activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {activeTab === 'login'
              ? 'Accede a tu cuenta para sincronizar tus mazos, cartas personalizadas y dorsos en la nube.'
              : 'Únete para guardar tu colección y acceder a ella desde cualquier dispositivo.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Headers */}
        <div className="grid grid-cols-2 border-b border-border/40 mb-2 mt-2">
          <button
            onClick={() => {
              setActiveTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all duration-200 ${
              activeTab === 'login'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Ingresar
          </button>
          <button
            onClick={() => {
              setActiveTab('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all duration-200 ${
              activeTab === 'signup'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-3">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Correo Electrónico
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="bg-secondary text-xs h-10 w-full focus-visible:ring-1 focus-visible:ring-primary"
                disabled={loading}
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-secondary text-xs h-10 w-full focus-visible:ring-1 focus-visible:ring-primary"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 bg-destructive/15 border border-destructive/20 text-destructive rounded-lg text-xs font-medium animate-fadeIn">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg text-xs font-medium animate-fadeIn">
              {successMsg}
            </div>
          )}

          {/* Action Button */}
          <Button
            type="submit"
            className="w-full h-10 font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </span>
            ) : activeTab === 'login' ? (
              'Ingresar'
            ) : (
              'Registrarse'
            )}
          </Button>
        </form>

        <div className="flex justify-end border-t border-border/40 pt-3">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
