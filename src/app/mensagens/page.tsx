'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { 
  Calendar, Copy, Download, RefreshCw, Trash2, CheckCircle2, 
  Check, Users, MessageSquare, Clock, Plus, Edit2, X,
  ChevronDown, Shield, Briefcase, ClipboardList, CheckSquare,
  GripVertical, Image as ImageIcon, Upload, ArrowUp, ArrowDown,
  Eye, FileText, MoveVertical, Bell, BellRing, BellOff, Volume2, VolumeX
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
  if (!name || name === 'Nenhum') return '-';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =========================================================================
// SISTEMA DE ÁUDIO DO ALARME VIA WEB AUDIO API (NATIVO, SEM ARQUIVOS EXTERNOS)
// =========================================================================
let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContextInstance) {
    audioContextInstance = new AudioContextClass();
  }
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume();
  }
  return audioContextInstance;
}

function playChimeNote(freq: number, startTime: number, duration: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Toca uma sequência melódica nítida e agradável de sino / notificação
function playAlarmTune() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playChimeNote(523.25, now, 0.45, ctx);        // Dó 5 (C5)
    playChimeNote(659.25, now + 0.16, 0.45, ctx); // Mi 5 (E5)
    playChimeNote(783.99, now + 0.32, 0.45, ctx); // Sol 5 (G5)
    playChimeNote(1046.50, now + 0.48, 0.9, ctx); // Dó 6 (C6 agudo)
  } catch (err) {
    console.warn('[Mensagens] Falha ao sintetizar áudio do alarme:', err);
  }
}

// Normaliza strings de horário para formato HH:MM
function normalizeTime(t?: string | null): string {
  if (!t) return '';
  const clean = t.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return clean;
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

          {/* Opção Nenhum (Disponível em todos os submenus) */}
          <div className="pt-1 pb-0.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => handleSelect('Nenhum')}
              className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                value === 'Nenhum' ? 'bg-slate-100 font-bold text-slate-800' : 'hover:bg-slate-50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[9px] flex items-center justify-center shrink-0">
                  -
                </span>
                <span className="italic font-medium">Nenhum</span>
              </div>
              {value === 'Nenhum' && <Check className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
            </button>
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
  imagem_url?: string;
  texto_completo?: string;
  ordem?: number;
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

  // Arraste e Reordenação de Mensagens (Drag & Drop)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modal de Detalhe e Envio do Comunicado (Imagem centralizada + Texto + Copiar)
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<MensagemItem | null>(null);
  const [detailText, setDetailText] = useState<string>('');
  const [detailImage, setDetailImage] = useState<string>('');
  const [isUploadingDetailImage, setIsUploadingDetailImage] = useState<boolean>(false);
  const [isSavingDetail, setIsSavingDetail] = useState<boolean>(false);
  const [isCopiedText, setIsCopiedText] = useState<boolean>(false);
  const [isCopiedImage, setIsCopiedImage] = useState<boolean>(false);
  const [isCopiedAll, setIsCopiedAll] = useState<boolean>(false);

  // Sistema de Alarme no Horário de Envio
  const [activeAlarmItem, setActiveAlarmItem] = useState<{
    item: MensagemItem;
    alarmKey: string;
  } | null>(null);
  const [isAlarmSoundEnabled, setIsAlarmSoundEnabled] = useState<boolean>(true);
  const [dismissedAlarms, setDismissedAlarms] = useState<Record<string, boolean>>({});
  const alarmAudioLoopRef = useRef<any>(null);

  // Modal de Adicionar / Editar Mensagem
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MensagemItem | null>(null);
  const [formMensagem, setFormMensagem] = useState('');
  const [formHorario, setFormHorario] = useState('08:00');
  const [formTipo, setFormTipo] = useState('GRUPO');
  const [formUltimoCheck, setFormUltimoCheck] = useState('FIXA (14/09)');
  const [formObs, setFormObs] = useState('');
  const [formImagemUrl, setFormImagemUrl] = useState('');
  const [formTextoCompleto, setFormTextoCompleto] = useState('');

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
        .eq('base', selectedBase);

      if (error) {
        console.error('[Mensagens] Erro ao buscar templates customizados:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30 * 1000
  });

  // Lista efetiva de mensagens (Personalizadas do Supabase ou Padrão do JSON, ordenadas pela ordem personalizada)
  const mensagensList: MensagemItem[] = useMemo(() => {
    if (dbTemplates && dbTemplates.length > 0) {
      const list: MensagemItem[] = dbTemplates.map((row, idx) => {
        const orderNum = row.resp_tarde !== null && row.resp_tarde !== undefined && row.resp_tarde !== '' && !isNaN(Number(row.resp_tarde))
          ? Number(row.resp_tarde)
          : idx;
        return {
          id: row.msg_id,
          ultimo_check: row.supervisor || 'FIXA',
          tipo: row.enviado_por || 'GRUPO',
          mensagem: row.analista || '',
          horario: row.horario_envio || '',
          obs: row.assistente || '',
          imagem_url: row.resp_manha || '',
          texto_completo: row.resp_inter || row.analista || '',
          ordem: orderNum
        };
      });
      return list.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    }
    const map = mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>;
    const defaultList = map[selectedBase] || [];
    return defaultList.map((m, idx) => ({
      ...m,
      imagem_url: '',
      texto_completo: m.mensagem,
      ordem: idx
    }));
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
          queryClient.invalidateQueries({ queryKey: ['mensagens_equipe_global', selectedDate] });
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

  // Busca equipe compartilhada entre todas as bases no mesmo dia (para que todas as regiões tenham a mesma equipe)
  const { data: allBasesEquipeRows } = useQuery({
    queryKey: ['mensagens_equipe_global', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_checklist')
        .select('*')
        .eq('data', selectedDate)
        .eq('msg_id', '__equipe__');
      if (error) return [];
      return data || [];
    },
    staleTime: 10 * 1000
  });

  // Dados da Equipe da Base (sincronizados entre todas as bases/regiões)
  const equipeData = useMemo(() => {
    const equipeRow = checklistRows?.find(r => r.msg_id === '__equipe__') 
      || allBasesEquipeRows?.find(r => r.msg_id === '__equipe__');
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
  }, [checklistRows, allBasesEquipeRows]);

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

  // Salva alteração de um campo da Equipe (replica para TODAS as regiões/bases)
  const handleEquipeChange = async (field: string, value: string) => {
    const newEquipe = {
      ...equipeData,
      [field]: value
    };

    // Cria os payloads para TODAS as bases para que a equipe seja idêntica em todas as regiões
    const payloads = bases.map(b => ({
      data: selectedDate,
      base: b,
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
    }));

    // Atualização otimista para todas as bases no React Query
    bases.forEach(b => {
      queryClient.setQueryData(['mensagens_checklist', selectedDate, b], (old: any[] = []) => {
        const filtered = old.filter(r => r.msg_id !== '__equipe__');
        const bPayload = payloads.find(p => p.base === b) || payloads[0];
        return [...filtered, bPayload];
      });
    });

    // Atualiza também o cache global da equipe
    queryClient.setQueryData(['mensagens_equipe_global', selectedDate], payloads);

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payloads, { onConflict: 'data,base,msg_id' });

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
    setFormImagemUrl('');
    setFormTextoCompleto('');
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
    setFormImagemUrl(item.imagem_url || '');
    setFormTextoCompleto(item.texto_completo || item.mensagem);
    setIsModalOpen(true);
  };

  // Abre modal de detalhe do comunicado (com imagem centralizada no topo e campo de texto)
  const openDetailModal = (item: MensagemItem) => {
    setSelectedItemForDetail(item);
    setDetailText(item.texto_completo || item.mensagem || '');
    setDetailImage(item.imagem_url || '');
    setIsCopiedText(false);
    setIsCopiedImage(false);
  };

  // Escuta evento de Colar (Ctrl+V) de imagem quando o modal de detalhe estiver aberto
  useEffect(() => {
    if (!selectedItemForDetail) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleUploadImage(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selectedItemForDetail]);

  // Upload de Imagem (Supabase Storage 'attachments' com fallback para Data URL)
  const handleUploadImage = async (file: File) => {
    try {
      setIsUploadingDetailImage(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const cleanFileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `mensagens/${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.warn('[Mensagens] Falha no storage, aplicando fallback local:', uploadError);
        // Fallback: Converte para Data URL Base64 para não travar o usuário
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setDetailImage(dataUrl);
          setShareFeedbackMsg('Imagem carregada!');
          setTimeout(() => setShareFeedbackMsg(''), 3000);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setDetailImage(publicUrl);
      setShareFeedbackMsg('Imagem enviada e anexada com sucesso!');
      setTimeout(() => setShareFeedbackMsg(''), 3000);
    } catch (err: any) {
      alert('Erro no envio da imagem: ' + err.message);
    } finally {
      setIsUploadingDetailImage(false);
    }
  };

  // Copiar Texto para Área de Transferência
  const handleCopyTextToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedText(true);
      setShareFeedbackMsg('Texto copiado com sucesso!');
      setTimeout(() => setIsCopiedText(false), 2500);
      setTimeout(() => setShareFeedbackMsg(''), 3000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  // Copiar Imagem para Área de Transferência (Para colar direto no WhatsApp)
  const handleCopyImageToClipboard = async (imageUrl: string) => {
    if (!imageUrl) return;
    try {
      setIsCopiedImage(true);
      if (imageUrl.startsWith('data:image/')) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        setShareFeedbackMsg('Imagem copiada para a área de transferência!');
        setTimeout(() => setIsCopiedImage(false), 2000);
        setTimeout(() => setShareFeedbackMsg(''), 3000);
        return;
      }

      const res = await fetch(imageUrl, { mode: 'cors' });
      const blob = await res.blob();
      if (blob.type === 'image/png') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setShareFeedbackMsg('Imagem copiada para a área de transferência!');
      } else {
        // Converte para PNG em canvas para suportar ClipboardItem em todos os browsers
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            setShareFeedbackMsg('Imagem copiada para a área de transferência!');
          }
        }, 'image/png');
      }
      setTimeout(() => setIsCopiedImage(false), 2000);
      setTimeout(() => setShareFeedbackMsg(''), 3000);
    } catch (err) {
      console.warn('Fallback copiar URL da imagem:', err);
      await navigator.clipboard.writeText(imageUrl);
      setShareFeedbackMsg('Link da imagem copiado!');
      setTimeout(() => setIsCopiedImage(false), 2000);
      setTimeout(() => setShareFeedbackMsg(''), 3000);
    }
  };

  // Copiar Imagem + Texto JUNTOS (Para colar direto no WhatsApp com Imagem e Legenda/Texto)
  const handleCopyAllToClipboard = async (imageUrl?: string, text?: string) => {
    const cleanImg = imageUrl || '';
    const cleanTxt = (text || '').trim();

    if (!cleanImg && !cleanTxt) {
      alert('Esta mensagem não possui imagem nem texto para copiar.');
      return;
    }

    try {
      setIsCopiedAll(true);

      // Cenário 1: Possui Imagem e Texto
      if (cleanImg && cleanTxt) {
        let pngBlob: Blob | null = null;
        if (cleanImg.startsWith('data:image/png')) {
          const res = await fetch(cleanImg);
          pngBlob = await res.blob();
        } else {
          pngBlob = await new Promise<Blob | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              canvas.toBlob(blob => resolve(blob), 'image/png');
            };
            img.onerror = () => resolve(null);
            img.src = cleanImg;
          });
        }

        if (pngBlob) {
          try {
            // 1. Grava primeiro o texto isolado para que fique salvo no Histórico do Windows (Win + V)
            await navigator.clipboard.writeText(cleanTxt);
            await new Promise(r => setTimeout(r, 120));

            // 2. Escreve imagem (PNG) e texto puro juntos na área de transferência atual (Ctrl + V)
            const clipboardItem = new ClipboardItem({
              'image/png': pngBlob,
              'text/plain': new Blob([cleanTxt], { type: 'text/plain' })
            });
            await navigator.clipboard.write([clipboardItem]);
            setShareFeedbackMsg('Imagem e texto copiados! Dê Ctrl+V no WhatsApp.');
            setTimeout(() => setIsCopiedAll(false), 2500);
            setTimeout(() => setShareFeedbackMsg(''), 4000);
            return;
          } catch (multiErr) {
            console.warn('ClipboardItem combinado falhou no browser, copiando imagem:', multiErr);
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            setShareFeedbackMsg('Imagem copiada para a área de transferência!');
            setTimeout(() => setIsCopiedAll(false), 2500);
            setTimeout(() => setShareFeedbackMsg(''), 4000);
            return;
          }
        }
      }

      // Cenário 2: Apenas Imagem
      if (cleanImg && !cleanTxt) {
        await handleCopyImageToClipboard(cleanImg);
        setIsCopiedAll(true);
        setTimeout(() => setIsCopiedAll(false), 2500);
        return;
      }

      // Cenário 3: Apenas Texto
      if (cleanTxt && !cleanImg) {
        await handleCopyTextToClipboard(cleanTxt);
        setIsCopiedAll(true);
        setTimeout(() => setIsCopiedAll(false), 2500);
        return;
      }
    } catch (err) {
      console.error('Erro ao copiar imagem + texto:', err);
      if (cleanTxt) {
        await navigator.clipboard.writeText(cleanTxt);
        setShareFeedbackMsg('Texto copiado com sucesso!');
      }
    } finally {
      setTimeout(() => setIsCopiedAll(false), 2500);
      setTimeout(() => setShareFeedbackMsg(''), 4000);
    }
  };

  // Gerenciamento Sonoro do Alarme
  const startAlarmSound = () => {
    if (!isAlarmSoundEnabled) return;
    playAlarmTune();
    if (alarmAudioLoopRef.current) clearInterval(alarmAudioLoopRef.current);
    alarmAudioLoopRef.current = setInterval(() => {
      playAlarmTune();
    }, 3500);
  };

  const stopAlarmSound = () => {
    if (alarmAudioLoopRef.current) {
      clearInterval(alarmAudioLoopRef.current);
      alarmAudioLoopRef.current = null;
    }
  };

  const dismissAlarm = (alarmKey?: string) => {
    stopAlarmSound();
    if (alarmKey) {
      setDismissedAlarms(prev => ({ ...prev, [alarmKey]: true }));
    }
    setActiveAlarmItem(null);
  };

  const snoozeAlarm = (alarmKey: string) => {
    stopAlarmSound();
    setDismissedAlarms(prev => ({ ...prev, [alarmKey]: true }));
    setActiveAlarmItem(null);
    setShareFeedbackMsg('Alarme adiado em 5 minutos.');
    setTimeout(() => {
      setDismissedAlarms(prev => {
        const updated = { ...prev };
        delete updated[alarmKey];
        return updated;
      });
    }, 5 * 60 * 1000);
  };

  const handleCopyAndMarkAlarm = async (item: MensagemItem, alarmKey: string) => {
    await handleCopyAllToClipboard(item.imagem_url, item.texto_completo || item.mensagem);
    await handleToggleCheck(item.id);
    dismissAlarm(alarmKey);
    setShareFeedbackMsg('Comunicado copiado e marcado como enviado!');
  };

  const handleCopyAlarmOnly = async (item: MensagemItem, alarmKey: string) => {
    await handleCopyAllToClipboard(item.imagem_url, item.texto_completo || item.mensagem);
    dismissAlarm(alarmKey);
  };

  // Monitoramento contínuo dos horários das mensagens para disparar o alarme
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const todayStr = now.toISOString().split('T')[0];

      // Apenas dispara na data de hoje
      if (selectedDate !== todayStr) return;

      for (const item of mensagensList) {
        if (!item.horario) continue;
        const normItemTime = normalizeTime(item.horario);
        if (!normItemTime) continue;

        // Se o horário bate com a hora atual (ou minuto corrente)
        if (normItemTime === currentTimeStr) {
          const isChecked = checksMap[item.id]?.checked;
          const alarmKey = `${todayStr}_${selectedBase}_${item.id}_${normItemTime}`;

          if (!isChecked && !dismissedAlarms[alarmKey]) {
            if (activeAlarmItem?.alarmKey === alarmKey) return;

            setActiveAlarmItem({ item, alarmKey });
            startAlarmSound();
            break;
          }
        }
      }
    };

    const interval = setInterval(checkSchedule, 4000);
    checkSchedule();

    return () => {
      clearInterval(interval);
    };
  }, [mensagensList, checksMap, selectedDate, selectedBase, dismissedAlarms, isAlarmSoundEnabled, activeAlarmItem]);

  // Interrompe qualquer som se o componente for desmontado
  useEffect(() => {
    return () => {
      stopAlarmSound();
    };
  }, []);

  // Salvar alterações no Modal de Detalhe (Imagem + Texto)
  const handleSaveDetailModal = async () => {
    if (!selectedItemForDetail) return;
    setIsSavingDetail(true);

    try {
      const isExistingInDb = dbTemplates && dbTemplates.length > 0;
      if (!isExistingInDb) {
        const defaultList = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
        const seedPayloads = defaultList.map((m, idx) => ({
          data: '1970-01-01',
          base: selectedBase,
          msg_id: m.id,
          checked: false,
          supervisor: m.ultimo_check,
          enviado_por: m.tipo,
          analista: m.mensagem,
          horario_envio: m.horario,
          assistente: m.obs || '',
          resp_manha: '',
          resp_inter: m.mensagem,
          resp_tarde: String(idx),
          updated_at: new Date().toISOString()
        }));
        await supabase.from('mensagens_checklist').upsert(seedPayloads, { onConflict: 'data,base,msg_id' });
      }

      const payload = {
        data: '1970-01-01',
        base: selectedBase,
        msg_id: selectedItemForDetail.id,
        checked: false,
        supervisor: selectedItemForDetail.ultimo_check,
        enviado_por: selectedItemForDetail.tipo,
        analista: selectedItemForDetail.mensagem,
        horario_envio: selectedItemForDetail.horario,
        assistente: selectedItemForDetail.obs || '',
        resp_manha: detailImage || '',
        resp_inter: detailText || selectedItemForDetail.mensagem || '',
        resp_tarde: String(selectedItemForDetail.ordem ?? 0),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('mensagens_checklist')
        .upsert(payload, { onConflict: 'data,base,msg_id' });

      if (error) throw error;

      setSelectedItemForDetail({
        ...selectedItemForDetail,
        imagem_url: detailImage,
        texto_completo: detailText
      });

      refetchTemplates();
      setShareFeedbackMsg('Comunicado e anexo salvos com sucesso!');
      setTimeout(() => setShareFeedbackMsg(''), 3500);
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingDetail(false);
    }
  };

  // Reordenação de Mensagens (Drag & Drop e Botões de Subir/Descer)
  const saveReorderedList = async (newList: MensagemItem[]) => {
    const payloads = newList.map((item, idx) => ({
      data: '1970-01-01',
      base: selectedBase,
      msg_id: item.id,
      checked: false,
      supervisor: item.ultimo_check,
      enviado_por: item.tipo,
      analista: item.mensagem,
      horario_envio: item.horario,
      assistente: item.obs || '',
      resp_manha: item.imagem_url || '',
      resp_inter: item.texto_completo || item.mensagem || '',
      resp_tarde: String(idx),
      updated_at: new Date().toISOString()
    }));

    queryClient.setQueryData(['mensagens_templates', selectedBase], payloads);

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payloads, { onConflict: 'data,base,msg_id' });

    if (error) {
      console.error('[Mensagens] Erro ao reordenar mensagens:', error);
      refetchTemplates();
    } else {
      setShareFeedbackMsg('Ordem das mensagens atualizada!');
      setTimeout(() => setShareFeedbackMsg(''), 3000);
    }
  };

  const handleMoveItem = async (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= mensagensList.length) return;

    const updated = [...mensagensList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    await saveReorderedList(updated);
  };

  const handleDropRow = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...mensagensList];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setDraggedIndex(null);
    setDragOverIndex(null);
    await saveReorderedList(updated);
  };

  // Salva no Supabase (criação ou edição de templates da base)
  const handleSaveModalMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const isExistingInDb = dbTemplates && dbTemplates.length > 0;

    if (!isExistingInDb) {
      const defaultList = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
      const seedPayloads = defaultList.map((m, idx) => ({
        data: '1970-01-01',
        base: selectedBase,
        msg_id: m.id,
        checked: false,
        supervisor: m.ultimo_check,
        enviado_por: m.tipo,
        analista: m.mensagem,
        horario_envio: m.horario,
        assistente: m.obs || '',
        resp_manha: '',
        resp_inter: m.mensagem,
        resp_tarde: String(idx),
        updated_at: new Date().toISOString()
      }));

      await supabase.from('mensagens_checklist').upsert(seedPayloads, { onConflict: 'data,base,msg_id' });
    }

    const targetId = editingItem ? editingItem.id : `msg_${Date.now()}`;
    const targetOrder = editingItem && editingItem.ordem !== undefined ? editingItem.ordem : mensagensList.length;
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
      resp_manha: formImagemUrl || '',
      resp_inter: formTextoCompleto || formMensagem,
      resp_tarde: String(targetOrder),
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

            {/* Controle de Alarme Sonoro de Horário */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const next = !isAlarmSoundEnabled;
                  setIsAlarmSoundEnabled(next);
                  if (!next) stopAlarmSound();
                  else getAudioContext();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isAlarmSoundEnabled
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                }`}
                title={isAlarmSoundEnabled ? 'Alarme sonoro ativado (clique para mutar)' : 'Alarme sonoro mudo (clique para ativar)'}
              >
                {isAlarmSoundEnabled ? <BellRing className="w-3.5 h-3.5 animate-bounce" /> : <BellOff className="w-3.5 h-3.5" />}
                <span>{isAlarmSoundEnabled ? 'Alarme Ativo' : 'Alarme Mudo'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  getAudioContext();
                  playAlarmTune();
                  setShareFeedbackMsg('Toque de teste do alarme emitido!');
                  setTimeout(() => setShareFeedbackMsg(''), 2500);
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-pointer"
                title="Testar sinal sonoro de alarme"
              >
                <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Testar Som</span>
              </button>
            </div>

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
                  Equipe operacional compartilhada e sincronizada para todas as regiões ({bases.join(', ')})
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
                  <th className="py-3.5 px-2 text-center w-[54px] border-r border-[#1E3A56]" title="Arraste para reordenar as mensagens">
                    <MoveVertical className="w-3.5 h-3.5 mx-auto text-slate-300" />
                  </th>
                  <th className="py-3.5 px-4 text-center w-[130px] border-r border-[#1E3A56]">Último Check</th>
                  <th className="py-3.5 px-4 text-center w-[130px] border-r border-[#1E3A56]">Tipo</th>
                  <th className="py-3.5 px-6 border-r border-[#1E3A56]">Mensagens (Clique para Anexo e Texto)</th>
                  <th className="py-3.5 px-4 text-center w-[90px] border-r border-[#1E3A56]">Horário</th>
                  <th className="py-3.5 px-4 text-center w-[70px] border-r border-[#1E3A56]">Check</th>
                  <th className="py-3.5 px-6 text-center w-[220px] border-r border-[#1E3A56]">Horário Check / Envio</th>
                  <th className="py-3.5 px-3 text-center w-[90px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                      Carregando mensagens da base {selectedBase}...
                    </td>
                  </tr>
                ) : mensagensList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 space-y-2">
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
                    const isBeingDragged = draggedIndex === index;
                    const isDragTarget = dragOverIndex === index;

                    return (
                      <tr
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(index));
                          setDraggedIndex(index);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIndex !== index) setDragOverIndex(index);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === index) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropRow(index);
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`transition-colors group ${
                          isBeingDragged 
                            ? 'opacity-40 bg-blue-100/60' 
                            : isDragTarget 
                            ? 'border-t-2 border-t-blue-600 bg-blue-50/80' 
                            : index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        } hover:bg-blue-50/40`}
                      >
                        {/* Coluna de Reordenação (Arraste + Botões Subir/Descer) */}
                        <td 
                          className="py-2 px-1 text-center border-r border-slate-100 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <div 
                              className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title="Arraste para cima ou para baixo para reordenar"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col -space-y-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveItem(index, 'up')}
                                className="p-0.5 text-slate-300 hover:text-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === mensagensList.length - 1}
                                onClick={() => handleMoveItem(index, 'down')}
                                className="p-0.5 text-slate-300 hover:text-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

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

                        {/* Mensagens (Clicável para abrir visualizador de anexo + texto + copiar) */}
                        <td 
                          className="py-3 px-6 border-r border-slate-100 cursor-pointer group/cell hover:bg-blue-50/70 transition-colors"
                          onClick={() => openDetailModal(item)}
                          title="Clique para abrir o comunicado, ver imagem e copiar texto"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-slate-900 group-hover/cell:text-blue-600 transition-colors">
                                {item.mensagem}
                              </span>
                              {item.imagem_url && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Imagem</span>
                                </span>
                              )}
                              {item.texto_completo && item.texto_completo !== item.mensagem && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                  <FileText className="w-3 h-3" />
                                  <span>Texto</span>
                                </span>
                              )}
                            </div>

                            <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-2xs shrink-0">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Abrir</span>
                            </div>
                          </div>
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

                        {/* Ações: Visualizar/Copiar, Editar e Excluir */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {(item.imagem_url || item.texto_completo) && (
                              <button
                                onClick={() => handleCopyAllToClipboard(item.imagem_url, item.texto_completo || item.mensagem)}
                                className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                title="Copiar Imagem + Texto juntos para colar no WhatsApp"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => openDetailModal(item)}
                              className="p-1 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              title="Visualizar comunicado e copiar"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Editar Configurações da Mensagem"
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

              {/* Anexo de Imagem (URL ou Upload) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Imagem do Comunicado (Opcional)</span>
                  </span>
                  {formImagemUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImagemUrl('')}
                      className="text-[10px] text-red-500 hover:underline cursor-pointer"
                    >
                      Remover Imagem
                    </button>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formImagemUrl}
                    onChange={e => setFormImagemUrl(e.target.value)}
                    placeholder="Cole a URL da imagem ou use o botão de upload..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Arquivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fileExt = file.name.split('.').pop() || 'png';
                          const cleanFileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                          const filePath = `mensagens/${cleanFileName}`;
                          const { error: upErr } = await supabase.storage.from('attachments').upload(filePath, file, { upsert: true });
                          if (!upErr) {
                            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
                            setFormImagemUrl(publicUrl);
                          } else {
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormImagemUrl(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                {formImagemUrl && (
                  <div className="mt-2 p-2 bg-slate-100/70 rounded-xl border border-slate-200 flex justify-center">
                    <img src={formImagemUrl} alt="Pré-visualização" className="max-h-24 object-contain rounded-lg" />
                  </div>
                )}
              </div>

              {/* Texto Completo / Mensagem para Disparo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Texto Completo do Comunicado (Opcional - WhatsApp / Status)</span>
                </label>
                <textarea
                  rows={3}
                  value={formTextoCompleto}
                  onChange={e => setFormTextoCompleto(e.target.value)}
                  placeholder="Texto a ser copiado pelos operadores no momento do envio..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all resize-y"
                />
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

      {/* MODAL DEDICADO: VISUALIZADOR DE COMUNICADO (IMAGEM CENTRALIZADA + TEXTO + COPIAR) */}
      {selectedItemForDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[92vh]">
            
            {/* Cabeçalho do Modal */}
            <div className="bg-[#0B2238] px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-white tracking-tight">
                      {selectedItemForDetail.mensagem}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {selectedItemForDetail.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Programado para às <strong className="text-white">{selectedItemForDetail.horario}</strong> • Base {selectedBase}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* SEÇÃO 1: IMAGEM CENTRALIZADA NO TOPO */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Imagem do Comunicado</span>
                  </label>
                  {detailImage && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Imagem Anexada
                    </span>
                  )}
                </div>

                {detailImage ? (
                  <div className="flex flex-col items-center justify-center bg-slate-900/5 border border-slate-200 rounded-2xl p-4 gap-3">
                    {/* Imagem Centralizada */}
                    <div className="relative group max-h-72 w-full flex items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      <img
                        src={detailImage}
                        alt={selectedItemForDetail.mensagem}
                        className="max-h-72 w-auto max-w-full object-contain mx-auto rounded-lg shadow-sm"
                      />
                    </div>

                    {/* Botões de Ação da Imagem */}
                    <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyImageToClipboard(detailImage)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs border ${
                          isCopiedImage 
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                        }`}
                        title="Copiar imagem para colar no WhatsApp"
                      >
                        {isCopiedImage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                        <span>{isCopiedImage ? 'Imagem Copiada!' : 'Copiar Imagem'}</span>
                      </button>

                      <label className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isUploadingDetailImage ? 'Enviando...' : 'Trocar Imagem'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingDetailImage}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(file);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setDetailImage('')}
                        className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Remover anexo de imagem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Nenhuma imagem anexada a esta mensagem
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Selecione do computador, arraste para cá ou cole com Ctrl+V
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs">
                        <Upload className="w-4 h-4" />
                        <span>{isUploadingDetailImage ? 'Enviando...' : 'Selecionar Imagem'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingDetailImage}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(file);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const url = prompt('Cole o link direto da imagem (https://...):');
                          if (url && url.trim()) setDetailImage(url.trim());
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Inserir URL
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: ESPAÇO PARA O TEXTO DA MENSAGEM */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Texto do Comunicado (WhatsApp / Status)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {detailText.length} caracteres
                  </span>
                </div>

                <textarea
                  rows={6}
                  value={detailText}
                  onChange={(e) => setDetailText(e.target.value)}
                  placeholder="Digite aqui o texto detalhado da mensagem para envio..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-medium text-slate-800 leading-relaxed outline-none focus:border-blue-500 focus:bg-white transition-all resize-y shadow-2xs font-mono"
                />
              </div>

            </div>

            {/* Barra de Ações Inferior com Botão de Copiar */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {/* Botão de Marcar Check */}
                <button
                  type="button"
                  onClick={() => handleToggleCheck(selectedItemForDetail.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    checksMap[selectedItemForDetail.id]?.checked
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Marcar ou desmarcar o check de hoje desta mensagem"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${checksMap[selectedItemForDetail.id]?.checked ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>
                    {checksMap[selectedItemForDetail.id]?.checked 
                      ? `Enviado às ${checksMap[selectedItemForDetail.id]?.horario_envio}` 
                      : 'Marcar como Enviado'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Botão Salvar Alterações */}
                <button
                  type="button"
                  onClick={handleSaveDetailModal}
                  disabled={isSavingDetail}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Salvar o texto e a imagem permanentemente para esta mensagem"
                >
                  {isSavingDetail ? 'Salvando...' : 'Salvar Alterações'}
                </button>

                {/* Botão Copiar Imagem + Texto Combinado */}
                {(detailImage || detailText) && (
                  <button
                    type="button"
                    onClick={() => handleCopyAllToClipboard(detailImage, detailText)}
                    className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isCopiedAll
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title="Copia a Imagem e o Texto juntos para enviar no WhatsApp com um único Ctrl+V"
                  >
                    {isCopiedAll ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Copiado (Imagem + Texto)!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Imagem + Texto</span>
                      </>
                    )}
                  </button>
                )}

                {/* Botão Copiar Texto em Destaque */}
                <button
                  type="button"
                  onClick={() => handleCopyTextToClipboard(detailText)}
                  className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                    isCopiedText
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Copiar texto para colar no WhatsApp"
                >
                  {isCopiedText ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP DE ALARME DE HORÁRIO DE ENVIO DE MENSAGEM (COM SINAL SONORO E COPIAR)
          ========================================================================= */}
      {activeAlarmItem && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-amber-500 animate-in zoom-in-95 duration-200">
            {/* Top Banner de Alarme */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 animate-bounce">
                  <BellRing className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-black/25 px-2 py-0.5 rounded-full">
                      Alarme de Envio
                    </span>
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                      {selectedBase}
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-white mt-0.5">
                    Está na Hora de Enviar!
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={stopAlarmSound}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Silenciar áudio do alarme"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => dismissAlarm(activeAlarmItem.alarmKey)}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Fechar / Dispensar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Corpo do Alarme */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Comunicado Programado
                  </span>
                  <span className="text-base font-black text-slate-900">
                    {activeAlarmItem.item.mensagem}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Horário
                  </span>
                  <span className="text-lg font-black text-blue-600 flex items-center gap-1 justify-end">
                    <Clock className="w-4 h-4" />
                    {activeAlarmItem.item.horario}
                  </span>
                </div>
              </div>

              {/* Preview da Imagem caso exista */}
              {activeAlarmItem.item.imagem_url && (
                <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 max-h-48 flex items-center justify-center group">
                  <img
                    src={activeAlarmItem.item.imagem_url}
                    alt="Preview do Anexo"
                    className="max-h-48 w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Imagem Anexada
                  </div>
                </div>
              )}

              {/* Preview do Texto caso exista */}
              {(activeAlarmItem.item.texto_completo || activeAlarmItem.item.mensagem) && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 max-h-32 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Texto / Legenda para Envio:
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {activeAlarmItem.item.texto_completo || activeAlarmItem.item.mensagem}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 text-center">
                Ao clicar em copiar, a <strong>imagem e o texto</strong> vão para sua área de transferência para colar diretamente (<kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Ctrl+V</kbd>) no WhatsApp Web.
              </p>
            </div>

            {/* Ações do Modal de Alarme */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => snoozeAlarm(activeAlarmItem.alarmKey)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Lembrar novamente em 5 minutos"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Adiar 5 min</span>
                </button>
                <button
                  type="button"
                  onClick={() => dismissAlarm(activeAlarmItem.alarmKey)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 font-bold text-xs transition-colors cursor-pointer"
                  title="Dispensar alarme"
                >
                  Dispensar
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleCopyAlarmOnly(activeAlarmItem.item, activeAlarmItem.alarmKey)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Apenas copiar imagem e texto sem marcar check"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Apenas Copiar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyAndMarkAlarm(activeAlarmItem.item, activeAlarmItem.alarmKey)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  title="Copiar imagem e texto e marcar como enviado"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copiar e Marcar Envio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
