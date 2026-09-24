'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, MapPin, Clock, CheckCircle2, AlertCircle, 
  HelpCircle, UserCheck, LayoutGrid, List, BarChart2, X, PlusCircle, Check
} from 'lucide-react';

const SHIFTS_DEFAULT = [
  { name: 'Manhã', time: '08:00 - 12:00', icon: '☀️', color: 'from-blue-500 to-cyan-500' },
  { name: 'Tarde', time: '12:00 - 18:00', icon: '🌤️', color: 'from-amber-500 to-orange-500' },
  { name: 'Noite', time: '18:00 - 23:00', icon: '🌙', color: 'from-indigo-600 to-purple-600' },
];

const REGIONS_DEFAULT = ['Sumarezinho', 'Aldeota', 'Recreio', 'Barra', 'Campo Grande', 'Meireles'];
const TYPES_DEFAULT = ['Dedicado', 'Apoio', 'Nuvem'];
const STATUSES_DEFAULT = ['Confirmado', 'Pendente', 'Vaga'];

export function BoardShiftView({ boardId, isReadOnly }: { boardId: string; isReadOnly?: boolean }) {
  const queryClient = useQueryClient();

  // Data Selecionada (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modo de Visão: Quadro (Cards), Lista (Tabela), Timeline (Linha do tempo)
  const [viewTab, setViewTab] = useState<'quadro' | 'lista' | 'timeline'>('quadro');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [onlyVacancies, setOnlyVacancies] = useState(false);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);

  // Estado do Formulário de Escala em Lote (Múltiplas Datas e Múltiplas Pessoas)
  const [formShiftName, setFormShiftName] = useState('Manhã');
  const [formShiftTime, setFormShiftTime] = useState('08:00 - 12:00');
  const [formRegionName, setFormRegionName] = useState('Sumarezinho');
  const [formOperatorType, setFormOperatorType] = useState('Dedicado');
  const [formStatus, setFormStatus] = useState('Confirmado');
  const [formNotes, setFormNotes] = useState('');
  
  // Múltiplas Datas Selecionadas no Modal
  const [formDates, setFormDates] = useState<string[]>([selectedDate]);

  // Múltiplas Pessoas Selecionadas no Modal
  const [formSelectedPeople, setFormSelectedPeople] = useState<string[]>([]);
  const [customOperatorName, setCustomOperatorName] = useState('');

  // 1. Busca dados do Usuário Atual
  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  // 2. Busca Perfis do Setor / Org
  const { data: profiles } = useQuery({
    queryKey: ['profiles_for_shifts'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, role').order('email');
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // 3. Busca o workspace_id do quadro
  const { data: boardData } = useQuery({
    queryKey: ['board_workspace_shift', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('workspace_id, name').eq('id', boardId).single();
      return data;
    },
    staleTime: 10 * 60 * 1000
  });

  // 4. Busca as Escalas do Banco de Dados
  const { data: rawShifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['operational_shifts', boardId, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_shifts')
        .select('*')
        .eq('board_id', boardId)
        .order('shift_name')
        .order('region_name');

      if (error) {
        console.warn("Tabela operational_shifts pode não existir ainda no Supabase:", error);
        return [];
      }
      return data || [];
    }
  });

  // Navegação de Datas
  const changeDate = (days: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formattedSelectedDateText = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [selectedDate]);

  // Filtra as escalas conforme os critérios da tela
  const shiftsForSelectedDate = useMemo(() => {
    return (rawShifts || []).filter((shift: any) => {
      if (shift.shift_date !== selectedDate) return false;
      if (filterShift !== 'all' && shift.shift_name !== filterShift) return false;
      if (filterRegion !== 'all' && shift.region_name !== filterRegion) return false;
      if (filterType !== 'all' && shift.operator_type !== filterType) return false;
      if (filterStatus !== 'all' && shift.status !== filterStatus) return false;
      if (onlyVacancies && shift.status !== 'Vaga') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = shift.operator_name?.toLowerCase().includes(query);
        const matchRegion = shift.region_name?.toLowerCase().includes(query);
        const matchShift = shift.shift_name?.toLowerCase().includes(query);
        if (!matchName && !matchRegion && !matchShift) return false;
      }
      return true;
    });
  }, [rawShifts, selectedDate, filterShift, filterRegion, filterType, filterStatus, onlyVacancies, searchQuery]);

  // Salvar / Criar Escalas em Lote (Suporta Múltiplos Dias e Múltiplas Pessoas)
  const createBulkShifts = useMutation({
    mutationFn: async () => {
      if (isReadOnly) throw new Error("Acesso restrito");
      if (formDates.length === 0) throw new Error("Selecione pelo menos uma data.");

      // Determinar pessoas a inserir
      let peopleToInsert: Array<{ name: string; userId: string | null }> = [];

      if (formStatus === 'Vaga') {
        peopleToInsert = [{ name: 'VAGA / Nenhum operador', userId: null }];
      } else {
        if (formSelectedPeople.length > 0) {
          peopleToInsert = formSelectedPeople.map(email => {
            const p = profiles?.find(prof => prof.email === email);
            const shortName = email.split('@')[0].replace('.', ' ');
            return { name: shortName.toUpperCase(), userId: p?.id || null };
          });
        }
        if (customOperatorName.trim()) {
          peopleToInsert.push({ name: customOperatorName.trim(), userId: null });
        }
      }

      if (peopleToInsert.length === 0) {
        throw new Error("Selecione pelo menos uma pessoa ou marque como Vaga.");
      }

      // Monta inserções em lote (Combinando todas as datas x todas as pessoas)
      const records: any[] = [];
      for (const dStr of formDates) {
        for (const person of peopleToInsert) {
          records.push({
            board_id: boardId,
            workspace_id: boardData?.workspace_id || null,
            shift_date: dStr,
            shift_name: formShiftName,
            shift_time: formShiftTime,
            region_name: formRegionName,
            operator_name: person.name,
            operator_user_id: person.userId,
            operator_type: formOperatorType,
            status: formStatus,
            notes: formNotes || null,
            created_by: userProfile?.id || null
          });
        }
      }

      const { data, error } = await supabase.from('operational_shifts').insert(records).select();
      if (error) {
        if (error.message?.includes('operational_shifts') || error.code === '42703' || error.code === 'PGRST204') {
          throw new Error('A tabela operational_shifts ainda não foi criada. Execute o arquivo "migration_operational_shifts.sql" no Supabase SQL Editor.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts', boardId] });
      setIsModalOpen(false);
      setCustomOperatorName('');
      setFormNotes('');
      setFormSelectedPeople([]);
    },
    onError: (err: any) => {
      alert("Erro ao lançar escala: " + err.message);
    }
  });

  // Deletar Escala
  const deleteShift = useMutation({
    mutationFn: async (shiftId: string) => {
      if (isReadOnly) throw new Error("Acesso restrito");
      const { error } = await supabase.from('operational_shifts').delete().eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts', boardId] });
    }
  });

  // Atualizar Status Rápido
  const updateShiftStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      if (isReadOnly) throw new Error("Acesso restrito");
      const { error } = await supabase.from('operational_shifts').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts', boardId] });
    }
  });

  // Auxiliares para cálculo de datas em lote no modal
  const addPresetDates = (preset: 'today' | 'week' | 'next7') => {
    const today = new Date();
    if (preset === 'today') {
      setFormDates([today.toISOString().split('T')[0]]);
    } else if (preset === 'next7') {
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      setFormDates(dates);
    } else if (preset === 'week') {
      // Segunda a Sexta da semana atual
      const dates: string[] = [];
      const currentDay = today.getDay();
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distanceToMon);

      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      setFormDates(dates);
    }
  };

  const toggleFormDate = (dStr: string) => {
    setFormDates(prev => 
      prev.includes(dStr) ? prev.filter(d => d !== dStr) : [...prev, dStr]
    );
  };

  const toggleFormPerson = (email: string) => {
    setFormSelectedPeople(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      
      {/* Header Superior & Controles da Escala */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex flex-col gap-5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Escala Operacional</h2>
              <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold px-2.5 py-0.5 rounded-full">
                {shiftsForSelectedDate.length} {shiftsForSelectedDate.length === 1 ? 'Escala' : 'Escalas'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualize, planeje e gerencie a alocação de operadores por turno e região em tempo real.
            </p>
          </div>

          {/* Seletor de Data & Botão Adicionar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Data */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => changeDate(-1)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 px-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                />
              </div>

              <button 
                onClick={() => changeDate(1)} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
                className="ml-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Hoje
              </button>
            </div>

            {/* Alternador de Abas de Visão (Quadro, Lista, Timeline) */}
            <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1">
              <button 
                onClick={() => setViewTab('quadro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${viewTab === 'quadro' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Quadro
              </button>
              <button 
                onClick={() => setViewTab('lista')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${viewTab === 'lista' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button 
                onClick={() => setViewTab('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${viewTab === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Timeline
              </button>
            </div>

            {/* Botão + Escalar (Lançar Escala) */}
            {!isReadOnly && (
              <button 
                onClick={() => {
                  setFormDates([selectedDate]);
                  setIsModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors shadow-lg cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Escalar Operadores
              </button>
            )}
          </div>
        </div>

        {/* Linha de Filtros Rápidos */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/80">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome, região ou turno..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Filtro Turno */}
          <select 
            value={filterShift} 
            onChange={e => setFilterShift(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os turnos</option>
            {SHIFTS_DEFAULT.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>

          {/* Filtro Região */}
          <select 
            value={filterRegion} 
            onChange={e => setFilterRegion(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todas as regiões</option>
            {REGIONS_DEFAULT.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Filtro Tipo */}
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os tipos</option>
            {TYPES_DEFAULT.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Toggle Apenas Vagas */}
          <button 
            onClick={() => setOnlyVacancies(!onlyVacancies)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${onlyVacancies ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
          >
            {onlyVacancies ? '✓ Mostrando apenas vagas' : 'Mostrar apenas vagas'}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal (Quadro, Lista ou Timeline) */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Visão 1: Quadro (Colunas de Turno x Cards de Região) */}
        {viewTab === 'quadro' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {SHIFTS_DEFAULT.map(shiftDef => {
              const shiftItems = shiftsForSelectedDate.filter(s => s.shift_name === shiftDef.name);

              return (
                <div key={shiftDef.name} className="flex flex-col bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                  {/* Cabeçalho do Turno */}
                  <div className={`p-4 bg-gradient-to-r ${shiftDef.color} text-white flex items-center justify-between shadow-sm`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{shiftDef.icon}</span>
                      <div>
                        <h3 className="font-extrabold text-sm uppercase tracking-wider">{shiftDef.name}</h3>
                        <p className="text-[11px] opacity-90 font-medium">{shiftDef.time}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-extrabold backdrop-blur-xs">
                      {shiftItems.length}
                    </span>
                  </div>

                  {/* Lista de Regiões dentro do Turno */}
                  <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    {shiftItems.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs italic border border-dashed border-slate-800 rounded-xl">
                        Nenhuma escala lançada neste turno.
                      </div>
                    ) : (
                      shiftItems.map(item => (
                        <div 
                          key={item.id} 
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-sm transition-all relative group"
                        >
                          {/* Região */}
                          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                              <span>{item.region_name}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Tipo */}
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                item.operator_type === 'Dedicado' 
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                  : item.operator_type === 'Apoio'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              }`}>
                                {item.operator_type}
                              </span>

                              {/* Menu Excluir se não for read-only */}
                              {!isReadOnly && (
                                <button 
                                  onClick={() => deleteShift.mutate(item.id)} 
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1 cursor-pointer"
                                  title="Remover escala"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Operador & Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {item.operator_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="overflow-hidden">
                                <h4 className="text-xs font-bold text-white truncate max-w-[130px]">{item.operator_name}</h4>
                                {item.notes && <p className="text-[10px] text-slate-400 truncate">{item.notes}</p>}
                              </div>
                            </div>

                            {/* Badge de Status Alternável */}
                            <button 
                              onClick={() => {
                                if (isReadOnly) return;
                                const nextStatus = item.status === 'Confirmado' ? 'Pendente' : item.status === 'Pendente' ? 'Vaga' : 'Confirmado';
                                updateShiftStatus.mutate({ id: item.id, newStatus: nextStatus });
                              }}
                              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                                item.status === 'Confirmado'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : item.status === 'Pendente'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              } ${!isReadOnly ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {item.status}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Visão 2: Lista / Tabela Detalhada */}
        {viewTab === 'lista' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">Data</th>
                  <th className="p-4">Região</th>
                  <th className="p-4">Turno / Horário</th>
                  <th className="p-4">Operador</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Status</th>
                  {!isReadOnly && <th className="p-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {shiftsForSelectedDate.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                      Nenhuma escala encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  shiftsForSelectedDate.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 text-slate-300 font-bold">{item.shift_date}</td>
                      <td className="p-4 font-bold text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        {item.region_name}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-200">{item.shift_name}</span>
                        <span className="text-[11px] text-slate-400 block">{item.shift_time}</span>
                      </td>
                      <td className="p-4 font-bold text-white">{item.operator_name}</td>
                      <td className="p-4">
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {item.operator_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                          item.status === 'Confirmado'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.status === 'Pendente'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => deleteShift.mutate(item.id)}
                            className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Visão 3: Timeline (Linha do Tempo Visual) */}
        {viewTab === 'timeline' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Linha do Tempo dos Operadores ({formattedSelectedDateText})
            </h3>
            <div className="space-y-4">
              {shiftsForSelectedDate.map(item => (
                <div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-[180px]">
                    <h4 className="text-xs font-bold text-white">{item.operator_name}</h4>
                    <p className="text-[11px] text-slate-400">{item.region_name} • {item.operator_type}</p>
                  </div>
                  
                  {/* Barra da Timeline */}
                  <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden relative flex items-center px-3 border border-slate-700">
                    <div 
                      className={`h-full absolute left-0 top-0 rounded-full bg-gradient-to-r ${
                        item.shift_name === 'Manhã' ? 'from-blue-500 to-cyan-500 w-1/3' : item.shift_name === 'Tarde' ? 'from-amber-500 to-orange-500 left-1/3 w-1/3' : 'from-indigo-600 to-purple-600 left-2/3 w-1/3'
                      }`}
                    ></div>
                    <span className="relative z-10 text-[10px] font-extrabold text-white shadow-xs">
                      {item.shift_name} ({item.shift_time})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Formulário de Lançamento em Lote (Múltiplos Dias e Múltiplas Pessoas) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-white">Escalar Operadores</h3>
                <p className="text-xs text-slate-400">Lance escalas para múltiplos dias e múltiplas pessoas de uma só vez.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              
              {/* 1. Seleção de Múltiplos Dias */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">1. Selecionar Dias da Escala</label>
                  <div className="flex gap-1.5">
                    <button onClick={() => addPresetDates('today')} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300">Hoje</button>
                    <button onClick={() => addPresetDates('week')} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300">Seg-Sex</button>
                    <button onClick={() => addPresetDates('next7')} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300">Próx 7 dias</button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="date"
                    onChange={(e) => e.target.value && toggleFormDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400">Clique para adicionar data personalizada</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                  {formDates.map(d => (
                    <span key={d} className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      {d}
                      <button onClick={() => toggleFormDate(d)} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {formDates.length === 0 && <span className="text-xs text-slate-500 italic">Nenhuma data selecionada</span>}
                </div>
              </div>

              {/* 2. Seleção de Múltiplas Pessoas */}
              <div>
                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">2. Selecionar Operador(es)</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                    {profiles?.map(p => {
                      const isSelected = formSelectedPeople.includes(p.email);
                      return (
                        <div 
                          key={p.id}
                          onClick={() => toggleFormPerson(p.email)}
                          className={`p-2 rounded-lg text-xs font-medium cursor-pointer border flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-600/30 border-blue-500 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          <span className="truncate">{p.email.split('@')[0]}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                      );
                    })}
                  </div>

                  <input 
                    type="text" 
                    placeholder="Ou digite um nome externo (ex: Gabriel GABS CR)"
                    value={customOperatorName}
                    onChange={e => setCustomOperatorName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 3. Turno & Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Turno</label>
                  <select 
                    value={formShiftName}
                    onChange={e => {
                      setFormShiftName(e.target.value);
                      const matched = SHIFTS_DEFAULT.find(s => s.name === e.target.value);
                      if (matched) setFormShiftTime(matched.time);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {SHIFTS_DEFAULT.map(s => <option key={s.name} value={s.name}>{s.name} ({s.time})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Região / Base</label>
                  <select 
                    value={formRegionName}
                    onChange={e => setFormRegionName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {REGIONS_DEFAULT.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* 4. Tipo de Operador e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Tipo de Operador</label>
                  <select 
                    value={formOperatorType}
                    onChange={e => setFormOperatorType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {TYPES_DEFAULT.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Status Inicial</label>
                  <select 
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {STATUSES_DEFAULT.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button 
                  onClick={() => createBulkShifts.mutate()}
                  disabled={createBulkShifts.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 shadow-lg"
                >
                  {createBulkShifts.isPending ? 'Lançando...' : `Lançar Escalas (${formDates.length * (formSelectedPeople.length || 1)})`}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
