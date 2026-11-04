'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { LogOut, User, Image as ImageIcon, ShieldCheck, Mail, MailWarning, BarChart3, Moon, Sun } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function UserProfile() {
  const [isOpen, setIsOpen] = useState(false);
  const [localProfileOverride, setLocalProfileOverride] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    enabled: !!currentUser?.id,
    staleTime: 5 * 60 * 1000
  });

  const email = currentUser?.email || '';
  const baseProfile = allProfiles?.find((p: any) => p.id === currentUser?.id || p.email === currentUser?.email) || null;
  const profile = localProfileOverride ? { ...baseProfile, ...localProfileOverride } : baseProfile;
  const setProfile = (next: any) => setLocalProfileOverride(next);

  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };

    syncTheme();
    window.addEventListener('crtask_theme_change', syncTheme);
    return () => window.removeEventListener('crtask_theme_change', syncTheme);
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('crtask_theme_change'));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    const handleResize = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleOpen = () => {
    if (buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleSignOut = async () => {
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para o upload.');
      }

      const file = event.target.files[0];
      const user = await getFastUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, email: user.email, avatar_url: avatarUrl },
          { onConflict: 'id' }
        );

      if (updateError) {
        throw updateError;
      }

      setProfile({ ...profile, avatar_url: avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['all_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['workspace_users'] });
    } catch (error: any) {
      alert(error.message || 'Erro ao fazer upload do avatar!');
    } finally {
      setUploading(false);
    }
  };

  const avatarUrl = profile?.avatar_url || (email ? `https://api.dicebear.com/7.x/notionists/svg?seed=${email}` : null);
  const firstLetter = email ? email.charAt(0).toUpperCase() : 'U';
  const roleLabel = profile?.role === 'admin' ? 'Administrador' : profile?.role === 'leader' ? 'Líder de Setor' : 'Colaborador';

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={handleOpen}
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white border border-slate-700/80 overflow-hidden hover:ring-2 ring-indigo-400 transition-all cursor-pointer relative shadow-md"
        title="Meu Perfil e Preferências"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          firstLetter
        )}
        <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0b1120]"></span>
      </button>

      {isOpen && rect && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] w-[280px] bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 text-left animate-in fade-in zoom-in-95 duration-150"
          style={{ bottom: window.innerHeight - rect.bottom - 10, left: rect.right + 14 }}
        >
          {/* Header do Usuário */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700/80 flex items-center gap-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl mb-1">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate capitalize">
                  {email.split('@')[0].replace('.', ' ')}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{email}</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="p-1 flex flex-col gap-1">
            <label className="flex items-center gap-3 w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span>{uploading ? 'Enviando...' : 'Alterar foto de perfil'}</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={uploadAvatar} 
                disabled={uploading}
                className="hidden" 
              />
            </label>

            <button 
              onClick={async () => {
                const newStatus = !(profile?.receive_emails ?? true);
                try {
                  const { error } = await supabase.from('profiles').update({ receive_emails: newStatus }).eq('id', profile?.id);
                  if (error) throw error;
                  setProfile({ ...profile, receive_emails: newStatus });
                } catch (e: any) {
                  alert('Erro ao atualizar notificação por email.');
                }
              }}
              className="flex items-center gap-3 w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                (profile?.receive_emails ?? true)
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                {(profile?.receive_emails ?? true) ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <MailWarning className="w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col items-start">
                <span>Notificações por E-mail</span>
                <span className="text-[10px] font-normal text-slate-400">
                  {(profile?.receive_emails ?? true) ? 'Ativado (Clique p/ desativar)' : 'Desativado (Clique p/ ativar)'}
                </span>
              </div>
            </button>

            <button 
              onClick={toggleDarkMode}
              className="flex items-center justify-between w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isDarkMode
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400'
                    : 'bg-amber-50 text-amber-500'
                }`}>
                  {isDarkMode ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                </div>
                <span>Tema Escuro</span>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isDarkMode
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {isDarkMode ? 'Ligado' : 'Desligado'}
              </span>
            </button>
            
            {(profile?.role === 'admin' || profile?.role === 'leader') && (
              <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-700/80 space-y-1">
                <a 
                  href="/admin"
                  className="flex items-center gap-3 w-full px-2.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span>
                    {profile?.role === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
                  </span>
                </a>
                <a 
                  href="/admin/reports"
                  className="flex items-center gap-3 w-full px-2.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span>Relatórios e Insights</span>
                </a>
              </div>
            )}
            
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-700/80">
              <button 
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-2.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/80 flex items-center justify-center text-red-500 shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
