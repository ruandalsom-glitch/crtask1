'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { 
  Sun, 
  Moon, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  // Controle de Tema (Claro / Escuro)
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => {
      try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        setIsDarkMode(shouldBeDark);
      } catch (e) {}
    };
    syncTheme();
    window.addEventListener('crtask_theme_change', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('crtask_theme_change', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('crtask_theme_change'));
  };

  useEffect(() => {
    // Escuta mudanças no estado de autenticação para garantir que a sessão de recuperação foi carregada
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Usuário acessou pelo link de recuperação
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setError('A nova senha deve conter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message || 'Erro ao redefinir a senha.');
      setLoading(false);
    } else {
      setSuccessMsg('Sua senha foi redefinida com sucesso! Redirecionando para o painel...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }
  };

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Botão Flutuante de Tema (Claro / Escuro) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema de cor"
          title={isDarkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl text-xs font-semibold backdrop-blur-md transition-all duration-200 border shadow-md active:scale-95 cursor-pointer bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border-slate-200 shadow-slate-200/50 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:border-slate-800 dark:shadow-black/50"
        >
          {mounted && isDarkMode ? (
            <>
              <div className="w-5 h-5 rounded-lg bg-amber-400/15 flex items-center justify-center text-amber-400 shrink-0">
                <Sun className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline font-bold">Modo Claro</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Moon className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline font-bold">Modo Escuro</span>
            </>
          )}
        </button>
      </div>

      {/* Lado Esquerdo - Branding (Visível apenas em Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#06080f] flex-col items-center justify-center relative overflow-hidden p-12 border-r border-slate-800/50 select-none">
        <div 
          className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.2) 0%, transparent 55%), radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.18) 0%, transparent 55%)' 
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-md text-center">
          <div className="relative mb-8 group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur-xl opacity-35 group-hover:opacity-60 transition duration-500" />
            <div className="relative w-44 h-44 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl flex items-center justify-center p-3 backdrop-blur-xl">
              <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain filter drop-shadow-md" />
            </div>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black text-white tracking-tight mb-4">
            Gestão Operacional <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-400">CR</span>
          </h1>
          <p className="text-slate-400 text-base font-normal leading-relaxed mb-8 max-w-sm">
            Redefinição segura de credenciais de acesso corporativo ao sistema.
          </p>
        </div>
      </div>

      {/* Lado Direito - Redefinição de Senha Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 dark:bg-[#0b0e17] p-6 sm:p-12 min-h-screen relative transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-[#111625] p-8 sm:p-10 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/60 transition-colors duration-200">
          
          {/* Logo em Telas Menores */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-6">
            <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800 p-2 mb-3">
              <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gestão Operacional CR
            </span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
            Criar Nova Senha
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-normal text-sm sm:text-base leading-relaxed">
            Digite sua nova senha abaixo para atualizar sua credencial corporativa.
          </p>

          {/* Mensagens de Alerta */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-medium rounded-2xl border border-red-200 dark:border-red-900/60 flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-2xl border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-[#0b0e17] rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0e1322] focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 outline-none transition-all text-sm font-medium"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#0b0e17] rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0e1322] focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 outline-none transition-all text-sm font-medium"
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full bg-slate-950 hover:bg-black text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/10 dark:shadow-blue-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Redefinindo...' : 'Atualizar Senha'}</span>
              {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <button 
              type="button"
              onClick={() => router.push('/login')} 
              className="font-bold text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline outline-none transition-colors cursor-pointer"
            >
              &larr; Voltar para o Login
            </button>
          </div>
          
          <div className="mt-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} CR Operacional
          </div>
        </div>
      </div>
    </div>
  );
}
