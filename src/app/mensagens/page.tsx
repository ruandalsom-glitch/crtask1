'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { 
  Calendar, Copy, Download, RefreshCw, Trash2, CheckCircle2, 
  Check, Users, MessageSquare, Clock, Plus, Edit2, X,
  ChevronDown, Shield, Briefcase, ClipboardList, CheckSquare
} from 'lucide-react';
import mensagensConfig from '@/data/mensagens_config.json';

// =========================================================================
// CARGOS E COLABORADORES OFICIAIS
// =========================================================================
export const CARGOS_COLABORADORES: Record<string, string[]> = {
  'Supervisão': [
    'Kelly Bezerra',
    'Aris Junior'
  ],
  'Analistas': [
    'Raquel Nunes',
    'Fabiano de Jesus'
  ],
  'Assistentes': [
    'Athalya Shatner'
  ],
  'Auxiliares': [
    'Fabiola Pereira',
    'Matheus Santos',
    'Carolyni Carvalho',
    'Gabriel Santos',
    'Arieli Cruz',
    'Waldinei Macario'
  ]
};

// Helper para obter as iniciais de um colaborador (substituindo emotes por avatares profissionais)
function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =========================================================================
// COMPONENTE: SELETOR DE COLABORADOR POR CARGO ESPECÍFICO (SEM EMOTES)
// =========================================================================
interface CargoCollaboratorSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  cargo: 'Supervisão' | 'Analistas' | 'Assistentes' | 'Auxiliares';
  presets?: string[];
  placeholder?: string;
  allowCombination?: boolean;
}

function CargoCollaboratorSelect({
  label,
  value,
  onChange,
  cargo,
  presets = [],
  placeholder = 'Selecionar...',
  allowCombination = false
}: CargoCollaboratorSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTypingCustom, setIsTypingCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTypingCustom(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const members = CARGOS_COLABORADORES[cargo] || [];
  const CargoIcon = cargo === 'Supervisão' ? Shield :
                    cargo === 'Analistas' ? Briefcase :
                    cargo === 'Assistentes' ? ClipboardList : Users;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setIsTypingCustom(false);
    setCustomValue('');
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <CargoIcon className="w-3 h-3 text-slate-400" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-semibold text-slate-400">
          {cargo}
        </span>
      </div>

      {/* Botão de Disparo */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-white border rounded-xl px-3 py-2 text-xs transition-all flex items-center justify-between cursor-pointer shadow-2xs ${
          isOpen ? 'border-[#0B2238] ring-1 ring-[#0B2238]/20 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {value ? (
            <>
              <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                {getInitials(value)}
              </span>
              <span className="truncate font-semibold text-slate-900">
                {value}
              </span>
            </>
          ) : (
            <span className="text-slate-400 font-normal truncate">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ml-1 ${isOpen ? 'rotate-180 text-slate-700' : ''}`} />
      </button>

      {/* Menu Suspenso Referenciado Estritamente ao Cargo */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 min-w-[230px]">
          {/* Cabeçalho do Cargo */}
          <div className="px-3 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <CargoIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>{cargo}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {members.length} {members.length === 1 ? 'colaborador' : 'colaboradores'}
            </span>
          </div>

          {/* Presets de Turno (se aplicável) */}
          {presets.length > 0 && (
            <div className="px-2 pt-1.5 pb-1 border-b border-slate-100">
              <div className="flex flex-wrap gap-1">
                {presets.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      value === p
                        ? 'bg-[#0B2238] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Turno {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Colaboradores do Cargo */}
          <div className="py-1">
            {members.map(member => {
              const isSelected = value === member;
              return (
                <button
                  key={member}
                  type="button"
                  onClick={() => handleSelect(member)}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/80 font-bold text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                      {getInitials(member)}
                    </span>
                    <span>{member}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}

            {/* Opção combinada para Analistas */}
            {allowCombination && members.length > 1 && (
              <button
                type="button"
                onClick={() => handleSelect(members.join(' / '))}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors cursor-pointer border-t border-slate-50 ${
                  value === members.join(' / ') ? 'bg-blue-50/80 font-bold text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                    &
                  </span>
                  <span>{members.join(' / ')} (Ambos)</span>
                </div>
                {value === members.join(' / ') && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
              </button>
            )}
          </div>

          {/* Opção Manual / Digitar Outro */}
          <div className="pt-1 border-t border-slate-100 px-2 pb-0.5">
            {isTypingCustom ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (customValue.trim()) {
                    handleSelect(customValue.trim());
                  }
                }}
                className="flex items-center gap-1 mt-1"
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome do colaborador..."
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-[#0B2238] text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsTypingCustom(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsTypingCustom(true)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 py-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Digitar outro nome...</span>
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => handleSelect('')}
                    className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// PÁGINA PRINCIPAL: ENVIO DE MENSAGENS
// =========================================================================
interface MensagemItem {
  id: string;
  ultimo_check: string;
  tipo: string;
  mensagem: string;
  horario: string;
  obs?: string;
}

export default function MensagensPage() {
  const queryClient = useQueryClient();

  // Data Selecionada (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Bases restritas estritamente para: Sumarezinho, Recreio, Aldeota
  const bases = useMemo(() => ['Sumarezinho', 'Recreio', 'Aldeota'], []);
  const [selectedBase, setSelectedBase] = useState<string>('Sumarezinho');

  const [shareFeedbackMsg, setShareFeedbackMsg] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);

  // Modal de Adicionar / Editar Mensagem
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MensagemItem | null>(null);
  const [formMensagem, setFormMensagem] = useState('');
  const [formHorario, setFormHorario] = useState('08:00');
  const [formTipo, setFormTipo] = useState('GRUPO');
  const [formUltimoCheck, setFormUltimoCheck] = useState('FIXA (14/09)');
  const [formObs, setFormObs] = useState('');

  // Usuário Logado
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  // Verificação de permissão: apenas colaboradores atrelados ao setor Operacional (ou admin)
  const { data: isAtreladoOperacional, isLoading: isLoadingAccess } = useQuery({
    queryKey: ['user_operacional_access', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return false;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profile?.role === 'admin') return true;

      const { data: memberWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspaces(name)')
        .eq('user_id', currentUser.id);

      const hasOperac = memberWorkspaces?.some((item: any) => {
        const name = item.workspaces?.name || '';
        const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm.includes('operac');
      });

      return Boolean(hasOperac);
    },
    enabled: !!currentUser?.id,
    staleTime: 5 * 60 * 1000
  });

  // Nome do Colaborador Ativo (quem está logado)
  const currentUserName = useMemo(() => {
    if (!currentUser) return 'Operador';
    const emailName = currentUser.email?.split('@')[0] || 'Operador';
    return emailName
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [currentUser]);

  // =========================================================================
  // GESTÃO DINÂMICA DE MENSAGENS (TEMPLATES POR BASE SALVOS NO SUPABASE)
  // =========================================================================
  const { data: dbTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ['mensagens_templates', selectedBase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_checklist')
        .select('*')
        .eq('data', '1970-01-01')
        .eq('base', selectedBase)
        .order('horario_envio', { ascending: true });

      if (error) {
        console.error('[Mensagens] Erro ao buscar templates customizados:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30 * 1000
  });

  // Lista efetiva de mensagens (Personalizadas do Supabase ou Padrão do JSON)
  const mensagensList: MensagemItem[] = useMemo(() => {
    if (dbTemplates && dbTemplates.length > 0) {
      return dbTemplates.map(row => ({
        id: row.msg_id,
        ultimo_check: row.supervisor || 'FIXA',
        tipo: row.enviado_por || 'GRUPO',
        mensagem: row.analista || '',
        horario: row.horario_envio || '',
        obs: row.assistente || ''
      }));
    }
    const map = mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>;
    return map[selectedBase] || [];
  }, [selectedBase, dbTemplates]);

  // Busca o estado do checklist no Supabase para a data e base atuais
  const { data: checklistRows, isLoading, refetch } = useQuery({
    queryKey: ['mensagens_checklist', selectedDate, selectedBase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_checklist')
        .select('*')
        .eq('data', selectedDate)
        .eq('base', selectedBase);

      if (error) {
        console.error('[Mensagens] Erro ao buscar checklist:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 10 * 1000
  });

  // Realtime: Escuta alterações na tabela
  useEffect(() => {
    const channel = supabase
      .channel(`mensagens-realtime-${selectedDate}-${selectedBase}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens_checklist',
          filter: `base=eq.${selectedBase}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['mensagens_checklist', selectedDate, selectedBase] });
          queryClient.invalidateQueries({ queryKey: ['mensagens_templates', selectedBase] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedBase, queryClient]);

  // Mapeia os checks por msg_id
  const checksMap = useMemo(() => {
    const map: Record<string, { checked: boolean; horario_envio: string; enviado_por: string }> = {};
    checklistRows?.forEach(row => {
      if (row.msg_id !== '__equipe__') {
        map[row.msg_id] = {
          checked: Boolean(row.checked),
          horario_envio: row.horario_envio || '',
          enviado_por: row.enviado_por || ''
        };
      }
    });
    return map;
  }, [checklistRows]);

  // Dados da Equipe da Base
  const equipeData = useMemo(() => {
    const equipeRow = checklistRows?.find(r => r.msg_id === '__equipe__');
    return {
      supervisor: equipeRow?.supervisor || 'Kelly Bezerra',
      analista: equipeRow?.analista || 'Raquel Nunes',
      assistente: equipeRow?.assistente || 'Athalya Shatner',
      resp_manha: equipeRow?.resp_manha || 'Manhã',
      resp_inter: equipeRow?.resp_inter || 'Fabiano de Jesus',
      resp_tarde: equipeRow?.resp_tarde || 'Gabriel Santos',
      apoio_manha: equipeRow?.apoio_manha || 'Matheus Santos',
      apoio_inter: equipeRow?.apoio_inter || 'Carolyni Carvalho',
      apoio_tarde: equipeRow?.apoio_tarde || 'Fabiola Pereira',
    };
  }, [checklistRows]);

  // Alterna o status do Checkbox (Registra o usuário conectado que está marcando)
  const handleToggleCheck = async (msgId: string) => {
    const current = checksMap[msgId];
    const willCheck = !current?.checked;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Atualização otimista com o usuário logado
    queryClient.setQueryData(['mensagens_checklist', selectedDate, selectedBase], (old: any[] = []) => {
      const filtered = old.filter(r => r.msg_id !== msgId);
      return [
        ...filtered,
        {
          data: selectedDate,
          base: selectedBase,
          msg_id: msgId,
          checked: willCheck,
          horario_envio: willCheck ? nowTime : '',
          enviado_por: willCheck ? currentUserName : '',
          updated_at: new Date().toISOString()
        }
      ];
    });

    const payload = {
      data: selectedDate,
      base: selectedBase,
      msg_id: msgId,
      checked: willCheck,
      horario_envio: willCheck ? nowTime : '',
      enviado_por: willCheck ? currentUserName : '',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payload, { onConflict: 'data,base,msg_id' });

    if (error) {
      console.error('[Mensagens] Erro ao salvar check:', error);
      refetch();
    }
  };

  // Salva alteração de um campo da Equipe
  const handleEquipeChange = async (field: string, value: string) => {
    const newEquipe = {
      ...equipeData,
      [field]: value
    };

    const payload = {
      data: selectedDate,
      base: selectedBase,
      msg_id: '__equipe__',
      checked: false,
      supervisor: newEquipe.supervisor,
      analista: newEquipe.analista,
      assistente: newEquipe.assistente,
      resp_manha: newEquipe.resp_manha,
      resp_inter: newEquipe.resp_inter,
      resp_tarde: newEquipe.resp_tarde,
      apoio_manha: newEquipe.apoio_manha,
      apoio_inter: newEquipe.apoio_inter,
      apoio_tarde: newEquipe.apoio_tarde,
      updated_at: new Date().toISOString()
    };

    queryClient.setQueryData(['mensagens_checklist', selectedDate, selectedBase], (old: any[] = []) => {
      const filtered = old.filter(r => r.msg_id !== '__equipe__');
      return [...filtered, payload];
    });

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payload, { onConflict: 'data,base,msg_id' });

    if (error) {
      console.error('[Mensagens] Erro ao atualizar equipe:', error);
      refetch();
    }
  };

  // Abre modal para adicionar nova mensagem
  const openAddModal = () => {
    setEditingItem(null);
    setFormMensagem('');
    setFormHorario('08:00');
    setFormTipo('GRUPO');
    setFormUltimoCheck('FIXA (14/09)');
    setFormObs('');
    setIsModalOpen(true);
  };

  // Abre modal para editar mensagem existente
  const openEditModal = (item: MensagemItem) => {
    setEditingItem(item);
    setFormMensagem(item.mensagem);
    setFormHorario(item.horario);
    setFormTipo(item.tipo);
    setFormUltimoCheck(item.ultimo_check);
    setFormObs(item.obs || '');
    setIsModalOpen(true);
  };

  // Salva no Supabase (criação ou edição de templates da base)
  const handleSaveModalMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const isExistingInDb = dbTemplates && dbTemplates.length > 0;

    if (!isExistingInDb) {
      const defaultList = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
      const seedPayloads = defaultList.map(m => ({
        data: '1970-01-01',
        base: selectedBase,
        msg_id: m.id,
        checked: false,
        supervisor: m.ultimo_check,
        enviado_por: m.tipo,
        analista: m.mensagem,
        horario_envio: m.horario,
        assistente: m.obs || '',
        updated_at: new Date().toISOString()
      }));

      await supabase.from('mensagens_checklist').upsert(seedPayloads, { onConflict: 'data,base,msg_id' });
    }

    const targetId = editingItem ? editingItem.id : `msg_${Date.now()}`;
    const payload = {
      data: '1970-01-01',
      base: selectedBase,
      msg_id: targetId,
      checked: false,
      supervisor: formUltimoCheck,
      enviado_por: formTipo,
      analista: formMensagem,
      horario_envio: formHorario,
      assistente: formObs,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payload, { onConflict: 'data,base,msg_id' });

    if (error) {
      console.error('[Mensagens] Erro ao salvar mensagem:', error);
      alert('Erro ao salvar mensagem.');
    } else {
      setIsModalOpen(false);
      refetchTemplates();
    }
  };

  // Exclui mensagem personalizada da base
  const handleDeleteMessage = async (item: MensagemItem) => {
    const confirmDelete = window.confirm(`Deseja remover a mensagem "${item.mensagem}" da base "${selectedBase}"?`);
    if (!confirmDelete) return;

    const isExistingInDb = dbTemplates && dbTemplates.length > 0;
    if (!isExistingInDb) {
      const defaultList = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
      const filtered = defaultList.filter(m => m.id !== item.id);
      const seedPayloads = filtered.map(m => ({
        data: '1970-01-01',
        base: selectedBase,
        msg_id: m.id,
        checked: false,
        supervisor: m.ultimo_check,
        enviado_por: m.tipo,
        analista: m.mensagem,
        horario_envio: m.horario,
        assistente: m.obs || '',
        updated_at: new Date().toISOString()
      }));
      await supabase.from('mensagens_checklist').upsert(seedPayloads, { onConflict: 'data,base,msg_id' });
    } else {
      await supabase
        .from('mensagens_checklist')
        .delete()
        .eq('data', '1970-01-01')
        .eq('base', selectedBase)
        .eq('msg_id', item.id);
    }

    refetchTemplates();
    setShareFeedbackMsg(`Mensagem removida da base ${selectedBase}!`);
    setTimeout(() => setShareFeedbackMsg(''), 4000);
  };

  // Restaurar mensagens originais da base
  const handleRestoreDefaultMessages = async () => {
    const ok = window.confirm(
      `Deseja restaurar a lista padrão de mensagens para a base "${selectedBase}"?\nIsso removerá as alterações customizadas desta base.`
    );
    if (!ok) return;

    await supabase
      .from('mensagens_checklist')
      .delete()
      .eq('data', '1970-01-01')
      .eq('base', selectedBase);

    refetchTemplates();
    setShareFeedbackMsg(`Lista padrão de ${selectedBase} restaurada com sucesso.`);
    setTimeout(() => setShareFeedbackMsg(''), 4000);
  };

  // Limpa/Reinicia os checks do dia
  const handleResetDayChecks = async () => {
    const ok = window.confirm(
      `Deseja realmente ZERAR todos os checks de hoje da base "${selectedBase}"?\nIsso permitirá iniciar um novo ciclo de envios.`
    );
    if (!ok) return;

    await supabase
      .from('mensagens_checklist')
      .delete()
      .eq('data', selectedDate)
      .eq('base', selectedBase)
      .neq('msg_id', '__equipe__');

    queryClient.invalidateQueries({ queryKey: ['mensagens_checklist', selectedDate, selectedBase] });
    setShareFeedbackMsg(`Checklist de hoje de ${selectedBase} reiniciado.`);
    setTimeout(() => setShareFeedbackMsg(''), 4000);
  };

  // =========================================================================
  // GERAÇÃO DO CANVAS HTML5 DE ALTA RESOLUÇÃO (COM LOGO CR E VISUAL PROFISSIONAL)
  // =========================================================================
  const generateReportCanvas = async (): Promise<HTMLCanvasElement> => {
    const scale = 2;
    const width = 1100 * scale;
    const headerH = 265 * scale;
    const thH = 38 * scale;
    const rowH = 34 * scale;
    const padding = 20 * scale;

    const totalRows = mensagensList.length;
    const height = headerH + thH + (totalRows * rowH) + (20 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível obter contexto 2D');

    // 0. Fundo Geral
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 1. Bloco de Cabeçalho Corporativo
    ctx.fillStyle = '#0B2238';
    ctx.fillRect(0, 0, width, headerH);

    // Carregar Logo da CR Task
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = '/logo.png';
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const logoBoxSize = 56 * scale;
        const logoBoxX = padding;
        const logoBoxY = 18 * scale;

        ctx.fillStyle = '#051322';
        roundRect(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = '#1E3A56';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        ctx.drawImage(logoImg, logoBoxX + (6 * scale), logoBoxY + (6 * scale), logoBoxSize - (12 * scale), logoBoxSize - (12 * scale));
      }
    } catch (e) {
      console.warn('Não foi possível carregar a logo para o canvas:', e);
    }

    // Títulos Principais
    const textStartX = padding + (72 * scale);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${22 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText('CR TASK • CONTROLE DIÁRIO DE MENSAGENS', textStartX, 40 * scale);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `600 ${12 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText('Checklist Operacional e Programação de Comunicados', textStartX, 60 * scale);

    // Caixa com Nome da Base e Data
    const rightBoxW = 280 * scale;
    const rightBoxH = 56 * scale;
    const rightBoxX = width - padding - rightBoxW;
    const rightBoxY = 18 * scale;

    ctx.fillStyle = '#051322';
    roundRect(ctx, rightBoxX, rightBoxY, rightBoxW, rightBoxH, 8 * scale);
    ctx.fill();
    ctx.strokeStyle = '#00FFA3';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00FFA3';
    ctx.font = `bold ${22 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText(`BASE ${selectedBase.toUpperCase()}`, rightBoxX + (rightBoxW / 2), rightBoxY + (28 * scale));

    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText(`Data: ${dateFormatted}`, rightBoxX + (rightBoxW / 2), rightBoxY + (48 * scale));

    // Linha divisória suave no cabeçalho
    ctx.strokeStyle = '#1E3A56';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(padding, 92 * scale);
    ctx.lineTo(width - padding, 92 * scale);
    ctx.stroke();

    // 2. Caixa do Supervisor em Destaque (Sem emotes)
    const supY = 104 * scale;
    const supH = 28 * scale;
    ctx.fillStyle = '#1B5288';
    roundRect(ctx, padding, supY, width - (padding * 2), supH, 7 * scale);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${13 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`SUPERVISÃO: ${equipeData.supervisor.toUpperCase()}`, width / 2, supY + (19 * scale));

    // 3. Grid de Responsáveis, Analistas, Assistentes e Apoios (Sem emotes)
    const colW = (width - (padding * 2) - (12 * scale)) / 2;
    const xCol1 = padding;
    const xCol2 = padding + colW + (12 * scale);

    const equipeRows = [
      [`Analistas: ${equipeData.analista}`, `Assistente: ${equipeData.assistente}`],
      [`Resp. Manhã: ${equipeData.resp_manha}`, `Apoio Manhã: ${equipeData.apoio_manha}`],
      [`Intermédio: ${equipeData.resp_inter}`, `Apoio Intermédio: ${equipeData.apoio_inter}`],
      [`Resp. Tarde: ${equipeData.resp_tarde}`, `Apoio Tarde: ${equipeData.apoio_tarde}`],
    ];

    let currY = 140 * scale;
    ctx.textAlign = 'left';
    ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;

    equipeRows.forEach(([c1, c2]) => {
      ctx.fillStyle = '#1E3D5C';
      roundRect(ctx, xCol1, currY, colW, 23 * scale, 6 * scale);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(c1, xCol1 + (12 * scale), currY + (16 * scale));

      ctx.fillStyle = '#1E3D5C';
      roundRect(ctx, xCol2, currY, colW, 23 * scale, 6 * scale);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(c2, xCol2 + (12 * scale), currY + (16 * scale));

      currY += 27 * scale;
    });

    // 4. Cabeçalho da Tabela
    const tableY = headerH;
    ctx.fillStyle = '#0B2238';
    ctx.fillRect(0, tableY, width, thH);

    const cols = [
      { name: 'Último Check', w: 140 * scale, align: 'center' },
      { name: 'Tipo', w: 130 * scale, align: 'center' },
      { name: 'Mensagens', w: 420 * scale, align: 'left' },
      { name: 'Horário', w: 90 * scale, align: 'center' },
      { name: 'Check', w: 70 * scale, align: 'center' },
      { name: 'Horário Check / Envio', w: 250 * scale, align: 'center' },
    ];

    let currX = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${13 * scale}px "Segoe UI", Inter, sans-serif`;

    cols.forEach(col => {
      if (col.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(col.name, currX + col.w / 2, tableY + (24 * scale));
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(col.name, currX + (14 * scale), tableY + (24 * scale));
      }
      currX += col.w;

      ctx.strokeStyle = '#1E3A56';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(currX, tableY);
      ctx.lineTo(currX, tableY + thH);
      ctx.stroke();
    });

    // 5. Linhas das Mensagens
    let rowY = tableY + thH;

    mensagensList.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 1 ? '#F4F8FC' : '#FFFFFF';
      ctx.fillRect(0, rowY, width, rowH);

      const state = checksMap[item.id] || { checked: false, horario_envio: '', enviado_por: '' };
      const isChecked = state.checked;

      let cellX = 0;
      cols.forEach((col, cIdx) => {
        const cellW = col.w;

        if (cIdx === 0) {
          const val = item.ultimo_check || '';
          ctx.fillStyle = val.includes('(') ? '#DC2626' : '#111827';
          ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 1) {
          const val = item.tipo || 'GRUPO';
          ctx.fillStyle = val.includes('STATUS') ? '#2563EB' : '#0F766E';
          ctx.font = `bold ${11 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 2) {
          const val = item.mensagem || '';
          ctx.fillStyle = '#0F172A';
          ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(val, cellX + (14 * scale), rowY + (23 * scale));
        } else if (cIdx === 3) {
          const val = item.horario || '';
          ctx.fillStyle = '#334155';
          ctx.font = `${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 4) {
          const bx = cellX + (cellW - (18 * scale)) / 2;
          const by = rowY + (rowH - (18 * scale)) / 2;
          ctx.strokeStyle = '#0B2238';
          ctx.lineWidth = 2 * scale;
          ctx.strokeRect(bx, by, 18 * scale, 18 * scale);

          if (isChecked) {
            ctx.fillStyle = '#E6F4EA';
            ctx.fillRect(bx + (2 * scale), by + (2 * scale), 14 * scale, 14 * scale);
            ctx.fillStyle = '#16A34A';
            ctx.font = `bold ${15 * scale}px "Segoe UI", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('✓', bx + (9 * scale), by + (14 * scale));
          }
        } else if (cIdx === 5) {
          if (isChecked) {
            let txt = `✓ ${state.horario_envio}`;
            if (state.enviado_por) txt += ` (${state.enviado_por})`;
            ctx.fillStyle = '#15803D';
            ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(txt, cellX + cellW / 2, rowY + (23 * scale));
          } else if (item.obs) {
            ctx.fillStyle = '#DC2626';
            ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(item.obs, cellX + cellW / 2, rowY + (23 * scale));
          }
        }

        cellX += cellW;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(cellX, rowY);
        ctx.lineTo(cellX, rowY + rowH);
        ctx.stroke();
      });

      rowY += rowH;
    });

    return canvas;
  };

  // Helper para desenhar retângulos arredondados no Canvas
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Copia o relatório como imagem para a Área de Transferência
  const handleCopyImage = async () => {
    setIsGeneratingImage(true);
    try {
      const canvas = await generateReportCanvas();
      canvas.toBlob(async blob => {
        if (!blob) {
          setIsGeneratingImage(false);
          return;
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShareFeedbackMsg('Relatório copiado com sucesso! Pressione Ctrl + V no WhatsApp.');
        setTimeout(() => setShareFeedbackMsg(''), 4500);
        setIsGeneratingImage(false);
      }, 'image/png');
    } catch (err) {
      console.error('Erro ao copiar imagem:', err);
      await handleDownloadImage();
      setIsGeneratingImage(false);
    }
  };

  // Faz o download da imagem em PNG
  const handleDownloadImage = async () => {
    setIsGeneratingImage(true);
    try {
      const canvas = await generateReportCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanBase = selectedBase.toLowerCase().replace(/\s+/g, '_');
      link.download = `relatorio_mensagens_${cleanBase}_${selectedDate}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShareFeedbackMsg('Imagem PNG baixada com sucesso.');
      setTimeout(() => setShareFeedbackMsg(''), 4000);
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Totalizadores de progresso
  const totalMsgs = mensagensList.length;
  const checkedCount = Object.values(checksMap).filter(v => v.checked).length;
  const progressPct = totalMsgs > 0 ? Math.round((checkedCount / totalMsgs) * 100) : 0;

  // Bloqueio de acesso para quem não é do setor Operacional (e não é admin)
  if (!isLoadingUser && !isLoadingAccess && isAtreladoOperacional === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#f8fafc] min-h-[70vh]">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 border border-red-200 shadow-xs">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Acesso Restrito ao Setor Operacional
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Este módulo e seus comunicados estão disponíveis apenas para colaboradores vinculados ao setor Operacional.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-[#0B2238] hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
        >
          Voltar ao Início
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      {/* Toast Feedback */}
      {shareFeedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{shareFeedbackMsg}</span>
        </div>
      )}

      {/* HEADER SUPERIOR VISUALMENTE REFORMULADO (COM LOGO CR) */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Esquerda: Logo CR + Título do Sistema */}
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 bg-slate-950 rounded-2xl border border-slate-800 shadow-lg shadow-slate-900/10 p-1.5 flex items-center justify-center shrink-0 hover:scale-105 transition-transform">
              <img src="/logo.png" alt="CR Task Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  CR Task • Envio de Mensagens
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tempo Real
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Programação e acompanhamento diário de comunicados nas bases operacionais
              </p>
            </div>
          </div>

          {/* Direita: Seletor de Base (Pills), Data e Ações */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Bases como Pills Elegantes */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
              {bases.map(b => {
                const isSelected = selectedBase === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBase(b)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>

            {/* Seletor de Data */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              />
            </div>

            {/* Botão Adicionar Nova Mensagem */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-blue-500/20 active:scale-95"
              title="Adicionar nova mensagem à programação desta base"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Mensagem</span>
            </button>

            {/* Botão Copiar Imagem WhatsApp */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              title="Gera imagem e copia para colar (Ctrl+V) no WhatsApp"
            >
              <Copy className="w-4 h-4" />
              <span>{isGeneratingImage ? 'Gerando...' : 'Copiar Imagem (WhatsApp)'}</span>
            </button>

            {/* Botão Baixar PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Baixar imagem em formato PNG"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Baixar PNG</span>
            </button>

            {/* Atualizar */}
            <button
              onClick={() => {
                refetch();
                refetchTemplates();
              }}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Atualizar dados da nuvem"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
        
        {/* CARD DA EQUIPE RESPONSÁVEL COM SELEÇÃO DIRECIONADA POR CARGO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Equipe Responsável da Base • {selectedBase}
                </h2>
                <p className="text-xs text-slate-500">
                  Selecione os colaboradores diretamente pelo cargo correspondente
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Usuário conectado:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {currentUserName}
              </span>
            </div>
          </div>

          {/* Grid de Seleção da Equipe com Cargo Específico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Supervisor */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Supervisor da Base"
                cargo="Supervisão"
                value={equipeData.supervisor}
                onChange={val => handleEquipeChange('supervisor', val)}
                placeholder="Selecione o supervisor..."
              />
            </div>

            {/* 2. Analistas */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Analistas"
                cargo="Analistas"
                allowCombination
                value={equipeData.analista}
                onChange={val => handleEquipeChange('analista', val)}
                placeholder="Selecione os analistas..."
              />
            </div>

            {/* 3. Assistente */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Assistente"
                cargo="Assistentes"
                value={equipeData.assistente}
                onChange={val => handleEquipeChange('assistente', val)}
                placeholder="Selecione o assistente..."
              />
            </div>

            {/* 4. Resp. Manhã */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Responsável: Manhã"
                cargo="Auxiliares"
                value={equipeData.resp_manha}
                presets={['Manhã']}
                onChange={val => handleEquipeChange('resp_manha', val)}
                placeholder="Colaborador da manhã..."
              />
            </div>

            {/* 5. Intermédio */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Responsável: Intermédio"
                cargo="Auxiliares"
                value={equipeData.resp_inter}
                presets={['Intermédio']}
                onChange={val => handleEquipeChange('resp_inter', val)}
                placeholder="Colaborador intermédio..."
              />
            </div>

            {/* 6. Resp. Tarde */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Responsável: Tarde"
                cargo="Auxiliares"
                value={equipeData.resp_tarde}
                presets={['Tarde']}
                onChange={val => handleEquipeChange('resp_tarde', val)}
                placeholder="Colaborador da tarde..."
              />
            </div>

            {/* 7. Apoio Manhã */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Apoio: Manhã"
                cargo="Auxiliares"
                value={equipeData.apoio_manha}
                presets={['Manhã']}
                onChange={val => handleEquipeChange('apoio_manha', val)}
                placeholder="Apoio da manhã..."
              />
            </div>

            {/* 8. Apoio Intermédio */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Apoio: Intermédio"
                cargo="Auxiliares"
                value={equipeData.apoio_inter}
                presets={['Intermédio']}
                onChange={val => handleEquipeChange('apoio_inter', val)}
                placeholder="Apoio intermédio..."
              />
            </div>

            {/* 9. Apoio Tarde */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition-colors">
              <CargoCollaboratorSelect
                label="Apoio: Tarde"
                cargo="Auxiliares"
                value={equipeData.apoio_tarde}
                presets={['Tarde']}
                onChange={val => handleEquipeChange('apoio_tarde', val)}
                placeholder="Apoio da tarde..."
              />
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO & GESTÃO DA BASE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Progresso de Disparos • {selectedBase}
              </span>
              <div className="text-sm font-black text-slate-900">
                {checkedCount} de {totalMsgs} comunicados enviados ({progressPct}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-52 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-500 shadow-xs"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Botão Zerar Checks de Hoje */}
            <button
              onClick={handleResetDayChecks}
              className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-red-200 flex items-center gap-1.5 font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
              title="Zerar os checks de hoje desta base"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Zerar checks de hoje</span>
            </button>
          </div>
        </div>

        {/* TABELA DE CHECKLIST OPERACIONAL */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B2238] text-white text-[12px] font-bold tracking-wider uppercase">
                  <th className="py-3.5 px-4 text-center w-[130px] border-r border-[#1E3A56]">Último Check</th>
                  <th className="py-3.5 px-4 text-center w-[130px] border-r border-[#1E3A56]">Tipo</th>
                  <th className="py-3.5 px-6 border-r border-[#1E3A56]">Mensagens</th>
                  <th className="py-3.5 px-4 text-center w-[90px] border-r border-[#1E3A56]">Horário</th>
                  <th className="py-3.5 px-4 text-center w-[70px] border-r border-[#1E3A56]">Check</th>
                  <th className="py-3.5 px-6 text-center w-[220px] border-r border-[#1E3A56]">Horário Check / Envio</th>
                  <th className="py-3.5 px-3 text-center w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                      Carregando mensagens da base {selectedBase}...
                    </td>
                  </tr>
                ) : mensagensList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 space-y-2">
                      <div>Nenhuma mensagem cadastrada para a base {selectedBase}.</div>
                      <button
                        onClick={openAddModal}
                        className="text-blue-600 hover:underline font-bold text-xs cursor-pointer"
                      >
                        + Clique aqui para adicionar a primeira mensagem
                      </button>
                    </td>
                  </tr>
                ) : (
                  mensagensList.map((item, index) => {
                    const state = checksMap[item.id] || { checked: false, horario_envio: '', enviado_por: '' };
                    const isChecked = state.checked;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors group hover:bg-blue-50/40 ${
                          index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        {/* Último Check */}
                        <td className="py-3 px-4 text-center font-bold border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={
                              item.ultimo_check.includes('(')
                                ? 'text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md text-[11px]'
                                : 'text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md'
                            }
                          >
                            {item.ultimo_check}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="py-3 px-4 text-center border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-md font-bold text-[10px] tracking-wider uppercase border ${
                              item.tipo.includes('STATUS')
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-teal-50 text-teal-700 border-teal-200'
                            }`}
                          >
                            {item.tipo}
                          </span>
                        </td>

                        {/* Mensagens */}
                        <td className="py-3 px-6 font-bold text-slate-900 border-r border-slate-100">
                          {item.mensagem}
                        </td>

                        {/* Horário */}
                        <td className="py-3 px-4 text-center text-slate-600 font-semibold border-r border-slate-100 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.horario}</span>
                          </div>
                        </td>

                        {/* Checkbox Interativo */}
                        <td className="py-3 px-4 text-center border-r border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleToggleCheck(item.id)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'bg-white border-slate-300 hover:border-blue-500'
                            }`}
                          >
                            {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                        </td>

                        {/* Horário Check / Envio (Exibe horário e quem marcou) */}
                        <td className="py-3 px-6 text-center border-r border-slate-100 whitespace-nowrap">
                          {isChecked ? (
                            <span className="text-emerald-700 font-bold text-xs">
                              ✓ {state.horario_envio} {state.enviado_por && `(${state.enviado_por})`}
                            </span>
                          ) : item.obs ? (
                            <span className="text-red-500 font-semibold">{item.obs}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Ações: Editar e Excluir */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Editar Mensagem"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(item)}
                              className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Remover Mensagem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DE ADICIONAR / EDITAR MENSAGEM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#0B2238] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">
                  {editingItem ? 'Editar Mensagem' : `Adicionar Mensagem (${selectedBase})`}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModalMessage} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mensagem / Assunto *
                </label>
                <input
                  type="text"
                  required
                  value={formMensagem}
                  onChange={e => setFormMensagem(e.target.value)}
                  placeholder="Ex: BOM DIA, ADIANTAMENTO, REGULARIZE O MEI"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Horário Programado *
                  </label>
                  <input
                    type="text"
                    required
                    value={formHorario}
                    onChange={e => setFormHorario(e.target.value)}
                    placeholder="Ex: 07:00, 14:30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipo de Envio
                  </label>
                  <select
                    value={formTipo}
                    onChange={e => setFormTipo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="GRUPO">GRUPO</option>
                    <option value="STATUS">STATUS</option>
                    <option value="GRUPO + STATUS">GRUPO + STATUS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Último Check / Validade
                  </label>
                  <input
                    type="text"
                    value={formUltimoCheck}
                    onChange={e => setFormUltimoCheck(e.target.value)}
                    placeholder="Ex: FIXA (14/09), TEMPORÁRIA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Obs / Dias da Semana
                  </label>
                  <input
                    type="text"
                    value={formObs}
                    onChange={e => setFormObs(e.target.value)}
                    placeholder="Ex: QUINTA, SEG Á SÁB"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingItem ? 'Salvar Alterações' : 'Adicionar à Base'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
