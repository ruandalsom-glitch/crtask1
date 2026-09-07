'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true); // Controla se estamos no modo Login ou Cadastro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (isLogin) {
      // -------------------- FLUXO DE LOGIN --------------------
      localStorage.clear();
      sessionStorage.clear();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
        setLoading(false);
      } else {
        window.location.href = '/'; // Deixa a página inicial decidir para qual quadro enviar
      }
    } else {
      // ------------------ FLUXO DE CRIAR CONTA ------------------
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccessMsg('Conta criada com sucesso! Você já pode fazer o login.');
        setIsLogin(true); // Joga a pessoa de volta pro form de login
        setPassword('');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Lado Esquerdo - Branding (Visível apenas em Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0a0a0a] flex-col items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        
        <div className="relative z-10 flex flex-col items-center max-w-md text-center">
          <div className="w-48 h-48 mb-8 border border-white/10 rounded-3xl bg-black shadow-2xl flex items-center justify-center overflow-hidden p-2">
            <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-4">
            Gestão Operacional <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500">CR</span>
          </h1>
          <p className="text-gray-400 text-lg font-medium leading-relaxed">
            Painel administrativo unificado para controle de atividades, monitoramento de prazos e eficiência de equipe.
          </p>
        </div>
      </div>

      {/* Lado Direito - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
             <div className="w-20 h-20 bg-black rounded-xl flex items-center justify-center shadow-lg border border-gray-100 overflow-hidden p-1">
               <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain" />
             </div>
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
            {isLogin ? 'Bem-vindo(a) de volta' : 'Criar nova credencial'}
          </h2>
          <p className="text-gray-500 mb-8 font-medium">
            {isLogin ? 'Insira suas credenciais corporativas para acessar o painel.' : 'Preencha os dados abaixo para solicitar acesso.'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm font-medium rounded-xl border border-green-100 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                E-mail Profissional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-900 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                placeholder="nome@cr.com.br"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Senha de Acesso
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-900 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-[#0a0a0a] hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {loading 
                ? 'Autenticando...' 
                : isLogin 
                  ? 'Acessar Painel' 
                  : 'Registrar Credencial'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 font-medium">
              {isLogin ? 'Sem acesso ao sistema?' : 'Já possui credencial?'}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccessMsg('');
                }} 
                className="ml-2 font-bold text-black hover:text-gray-700 hover:underline outline-none transition-colors"
              >
                {isLogin ? 'Solicite sua conta' : 'Fazer Login'}
              </button>
            </p>
          </div>
          
          <div className="mt-12 text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} CR Operacional
          </div>
        </div>
      </div>
    </div>
  );
}
