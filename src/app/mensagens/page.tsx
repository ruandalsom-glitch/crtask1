'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { 
  Calendar, Copy, Download, RefreshCw, Trash2, CheckCircle2, 
  Check, Users, MessageSquare, Clock, Plus, Edit2, RotateCcw, X
} from 'lucide-react';
import mensagensConfig from '@/data/mensagens_config.json';

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
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  // Nome do Colaborador Ativo
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
  // Usamos data = '1970-01-01' como reservada para a definição de templates
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
      analista: equipeRow?.analista || 'Wallisson',
      assistente: equipeRow?.assistente || 'Davis',
      resp_manha: equipeRow?.resp_manha || 'Manhã',
      resp_inter: equipeRow?.resp_inter || 'Wallisson',
      resp_tarde: equipeRow?.resp_tarde || 'Gabriel Santos',
      apoio_manha: equipeRow?.apoio_manha || 'Manhã',
      apoio_inter: equipeRow?.apoio_inter || 'Intermédio',
      apoio_tarde: equipeRow?.apoio_tarde || 'Tarde',
    };
  }, [checklistRows]);

  // Alterna o status do Checkbox
  const handleToggleCheck = async (msgId: string) => {
    const current = checksMap[msgId];
    const willCheck = !current?.checked;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Atualização otimista
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

    await supabase
      .from('mensagens_checklist')
      .upsert(payload, { onConflict: 'data,base,msg_id' });
  };

  // =========================================================================
  // MODAL: ADICIONAR OU EDITAR MENSAGEM
  // =========================================================================
  const openAddModal = () => {
    setEditingItem(null);
    setFormMensagem('');
    setFormHorario('08:00');
    setFormTipo('GRUPO');
    setFormUltimoCheck('FIXA (14/09)');
    setFormObs('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: MensagemItem) => {
    setEditingItem(item);
    setFormMensagem(item.mensagem);
    setFormHorario(item.horario);
    setFormTipo(item.tipo);
    setFormUltimoCheck(item.ultimo_check);
    setFormObs(item.obs || '');
    setIsModalOpen(true);
  };

  const handleSaveModalMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMensagem.trim() || !formHorario.trim()) {
      alert('Por favor, informe a Mensagem e o Horário programado.');
      return;
    }

    // Se a base ainda não tinha registros customizados no banco, semeia os já existentes primeiro
    if (!dbTemplates || dbTemplates.length === 0) {
      const currentDefaults = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
      const seedPayloads = currentDefaults.map(item => ({
        data: '1970-01-01',
        base: selectedBase,
        msg_id: item.id,
        checked: false,
        horario_envio: item.horario,
        enviado_por: item.tipo,
        supervisor: item.ultimo_check,
        analista: item.mensagem,
        assistente: item.obs || '',
        updated_at: new Date().toISOString()
      }));
      if (seedPayloads.length > 0) {
        await supabase.from('mensagens_checklist').upsert(seedPayloads, { onConflict: 'data,base,msg_id' });
      }
    }

    const msgId = editingItem ? editingItem.id : `msg_${Date.now()}`;
    const payload = {
      data: '1970-01-01',
      base: selectedBase,
      msg_id: msgId,
      checked: false,
      horario_envio: formHorario.trim(),
      enviado_por: formTipo,
      supervisor: formUltimoCheck.trim(),
      analista: formMensagem.trim(),
      assistente: formObs.trim(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('mensagens_checklist')
      .upsert(payload, { onConflict: 'data,base,msg_id' });

    if (error) {
      alert('Erro ao salvar mensagem: ' + error.message);
    } else {
      setIsModalOpen(false);
      refetchTemplates();
      setShareFeedbackMsg(editingItem ? '✓ Mensagem atualizada!' : '✓ Nova mensagem adicionada à base!');
      setTimeout(() => setShareFeedbackMsg(''), 4000);
    }
  };

  // Remover Mensagem da Base
  const handleDeleteMessage = async (item: MensagemItem) => {
    const ok = window.confirm(`Deseja realmente remover a mensagem "${item.mensagem}" (${item.horario}) da base ${selectedBase}?`);
    if (!ok) return;

    // Se ainda não tinha registros customizados no banco, semeia todos exceto o deletado
    if (!dbTemplates || dbTemplates.length === 0) {
      const currentDefaults = (mensagensConfig.mensagens_por_base as Record<string, MensagemItem[]>)[selectedBase] || [];
      const remaining = currentDefaults.filter(m => m.id !== item.id);
      const seedPayloads = remaining.map(m => ({
        data: '1970-01-01',
        base: selectedBase,
        msg_id: m.id,
        checked: false,
        horario_envio: m.horario,
        enviado_por: m.tipo,
        supervisor: m.ultimo_check,
        analista: m.mensagem,
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
    setShareFeedbackMsg(`🗑️ Mensagem removida da base ${selectedBase}!`);
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
    setShareFeedbackMsg(`🔄 Lista padrão de ${selectedBase} restaurada!`);
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
    setShareFeedbackMsg(`🧹 Checklist de hoje de ${selectedBase} reiniciado!`);
    setTimeout(() => setShareFeedbackMsg(''), 4000);
  };

  // =========================================================================
  // GERAÇÃO DO CANVAS HTML5 DE ALTA RESOLUÇÃO
  // =========================================================================
  const generateReportCanvas = async (): Promise<HTMLCanvasElement> => {
    const scale = 2;
    const width = 1040 * scale;
    const headerH = 240 * scale;
    const rowH = 36 * scale;
    const thH = 38 * scale;
    const padding = 20 * scale;

    const totalRows = mensagensList.length;
    const height = headerH + thH + (totalRows * rowH) + (40 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Fundo Geral Branco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 1. Cabeçalho Azul Escuro
    ctx.fillStyle = '#0D3559';
    ctx.fillRect(0, 0, width, headerH);

    // Título Central: "Relatório de Mensagens"
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${24 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Relatório de Mensagens', width / 2, 38 * scale);

    // Nome da Base em Ciano / Verde Neon Vibrante (Sumarezinho, Recreio ou Aldeota)
    ctx.fillStyle = '#00FFA3';
    ctx.font = `bold ${32 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText(selectedBase, width / 2, 80 * scale);

    // Caixa do Supervisor
    const supText = `Supervisor: ${equipeData.supervisor}`;
    ctx.fillStyle = '#1B5288';
    roundRect(ctx, padding, 106 * scale, width - (padding * 2), 26 * scale, 6 * scale);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${13 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.fillText(supText, width / 2, 124 * scale);

    // Grid de Responsáveis e Apoios (4 linhas x 2 colunas)
    const colW = (width - (padding * 2) - (12 * scale)) / 2;
    const xCol1 = padding;
    const xCol2 = padding + colW + (12 * scale);

    const equipeRows = [
      [`Analistas: ${equipeData.analista}`, `Assistente: ${equipeData.assistente}`],
      [`Responsável: Manhã (${equipeData.resp_manha})`, `Apoio: Manhã (${equipeData.apoio_manha})`],
      [`Intermédio: ${equipeData.resp_inter}`, `Apoio: Intermédio (${equipeData.apoio_inter})`],
      [`Tarde: ${equipeData.resp_tarde}`, `Apoio: Tarde (${equipeData.apoio_tarde})`],
    ];

    let currY = 138 * scale;
    ctx.textAlign = 'left';
    ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;

    equipeRows.forEach(([c1, c2]) => {
      ctx.fillStyle = '#3A7CB9';
      roundRect(ctx, xCol1, currY, colW, 22 * scale, 5 * scale);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(c1, xCol1 + (12 * scale), currY + (16 * scale));

      ctx.fillStyle = '#3A7CB9';
      roundRect(ctx, xCol2, currY, colW, 22 * scale, 5 * scale);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(c2, xCol2 + (12 * scale), currY + (16 * scale));

      currY += 25 * scale;
    });

    // 2. Cabeçalho da Tabela
    const tableY = headerH;
    ctx.fillStyle = '#0D3559';
    ctx.fillRect(0, tableY, width, thH);

    const cols = [
      { name: 'Último Check', w: 140 * scale, align: 'center' },
      { name: 'Tipo', w: 130 * scale, align: 'center' },
      { name: 'Mensagens', w: 390 * scale, align: 'left' },
      { name: 'Horário', w: 90 * scale, align: 'center' },
      { name: 'Check', w: 70 * scale, align: 'center' },
      { name: 'Horário Check / Envio', w: 220 * scale, align: 'center' },
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

      ctx.strokeStyle = '#B0C4DE';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(currX, tableY);
      ctx.lineTo(currX, tableY + thH);
      ctx.stroke();
    });

    // 3. Linhas das Mensagens
    let rowY = tableY + thH;

    mensagensList.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 1 ? '#F2F6FA' : '#FFFFFF';
      ctx.fillRect(0, rowY, width, rowH);

      const state = checksMap[item.id] || { checked: false, horario_envio: '', enviado_por: '' };
      const isChecked = state.checked;

      let cellX = 0;
      cols.forEach((col, cIdx) => {
        const cellW = col.w;

        if (cIdx === 0) {
          const val = item.ultimo_check || '';
          ctx.fillStyle = val.includes('(') ? '#C53030' : '#111827';
          ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 1) {
          const val = item.tipo || 'GRUPO';
          ctx.fillStyle = val.includes('STATUS') ? '#2563EB' : '#111827';
          ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 2) {
          const val = item.mensagem || '';
          ctx.fillStyle = '#111827';
          ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(val, cellX + (14 * scale), rowY + (23 * scale));
        } else if (cIdx === 3) {
          const val = item.horario || '';
          ctx.fillStyle = '#111827';
          ctx.font = `${12 * scale}px "Segoe UI", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(val, cellX + cellW / 2, rowY + (23 * scale));
        } else if (cIdx === 4) {
          const bx = cellX + (cellW - (18 * scale)) / 2;
          const by = rowY + (rowH - (18 * scale)) / 2;
          ctx.strokeStyle = '#0D3559';
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
            ctx.fillStyle = '#16A34A';
            ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(txt, cellX + cellW / 2, rowY + (23 * scale));
          } else if (item.obs) {
            ctx.fillStyle = '#C53030';
            ctx.font = `bold ${12 * scale}px "Segoe UI", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(item.obs, cellX + cellW / 2, rowY + (23 * scale));
          }
        }

        cellX += cellW;
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(cellX, rowY);
        ctx.lineTo(cellX, rowY + rowH);
        ctx.stroke();
      });

      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(0, rowY + rowH);
      ctx.lineTo(width, rowY + rowH);
      ctx.stroke();

      rowY += rowH;
    });

    ctx.fillStyle = '#6B7280';
    ctx.font = `${11 * scale}px "Segoe UI", Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • CR Task Operacional`,
      padding,
      rowY + (22 * scale)
    );

    return canvas;
  };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
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
        setShareFeedbackMsg('📸 Relatório copiado com sucesso! Pressione Ctrl + V no WhatsApp.');
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
      setShareFeedbackMsg('📥 Imagem PNG baixada com sucesso!');
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      {/* Toast Feedback */}
      {shareFeedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{shareFeedbackMsg}</span>
        </div>
      )}

      {/* HEADER SUPERIOR */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  Relatório de Mensagens
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Tempo Real
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Controle diário de envios para grupos e status das bases: Sumarezinho, Recreio e Aldeota
                </p>
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÕES: BASE, DATA E BOTÕES */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Base (Apenas Sumarezinho, Recreio, Aldeota) */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Base:</span>
              <select
                value={selectedBase}
                onChange={e => setSelectedBase(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
              >
                {bases.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Data */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 outline-none cursor-pointer"
              />
            </div>

            {/* Botão Adicionar Nova Mensagem */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-3.5 py-2 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow-blue-500/20 active:scale-95"
              title="Adicionar nova mensagem à programação desta base"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Mensagem</span>
            </button>

            {/* Botão Copiar Imagem WhatsApp */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              title="Gera imagem e copia para colar (Ctrl+V) no WhatsApp"
            >
              <Copy className="w-4 h-4" />
              <span>{isGeneratingImage ? 'Gerando...' : 'Copiar Imagem (WhatsApp)'}</span>
            </button>

            {/* Botão Baixar PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm px-3 py-2 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
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
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Atualizar dados da nuvem"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Limpar Checks do Dia */}
            <button
              onClick={handleResetDayChecks}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Zerar os checks de hoje desta base"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* CARD DA EQUIPE RESPONSÁVEL (ESCALA DO DIA) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Equipe Responsável da Base (Escala do Dia - {selectedBase})
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              Colaborador logado: <strong className="text-slate-700">{currentUserName}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Supervisor</label>
              <input
                type="text"
                value={equipeData.supervisor}
                onChange={e => handleEquipeChange('supervisor', e.target.value)}
                placeholder="Ex: Kelly Bezerra"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Analistas</label>
              <input
                type="text"
                value={equipeData.analista}
                onChange={e => handleEquipeChange('analista', e.target.value)}
                placeholder="Ex: Wallisson / Raquel"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Assistente</label>
              <input
                type="text"
                value={equipeData.assistente}
                onChange={e => handleEquipeChange('assistente', e.target.value)}
                placeholder="Ex: Davis"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Resp. Manhã</label>
              <input
                type="text"
                value={equipeData.resp_manha}
                onChange={e => handleEquipeChange('resp_manha', e.target.value)}
                placeholder="Ex: Manhã / Nome"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Intermédio</label>
              <input
                type="text"
                value={equipeData.resp_inter}
                onChange={e => handleEquipeChange('resp_inter', e.target.value)}
                placeholder="Ex: Wallisson"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Resp. Tarde</label>
              <input
                type="text"
                value={equipeData.resp_tarde}
                onChange={e => handleEquipeChange('resp_tarde', e.target.value)}
                placeholder="Ex: Gabriel Santos"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Apoio Manhã</label>
              <input
                type="text"
                value={equipeData.apoio_manha}
                onChange={e => handleEquipeChange('apoio_manha', e.target.value)}
                placeholder="Ex: Apoio Manhã"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Apoio Tarde</label>
              <input
                type="text"
                value={equipeData.apoio_tarde}
                onChange={e => handleEquipeChange('apoio_tarde', e.target.value)}
                placeholder="Ex: Apoio Tarde"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO & GESTÃO DA BASE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Progresso de Envios ({selectedBase})</span>
              <div className="text-sm font-extrabold text-slate-900">
                {checkedCount} de {totalMsgs} comunicados enviados ({progressPct}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-44 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {dbTemplates && dbTemplates.length > 0 && (
              <button
                onClick={handleRestoreDefaultMessages}
                className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                title="Voltar para as mensagens padrão desta base"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrão</span>
              </button>
            )}
          </div>
        </div>

        {/* TABELA DE CHECKLIST OPERACIONAL */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0D3559] text-white text-[12px] font-bold tracking-wider uppercase">
                  <th className="py-3 px-4 text-center w-[130px] border-r border-[#1B5288]">Último Check</th>
                  <th className="py-3 px-4 text-center w-[130px] border-r border-[#1B5288]">Tipo</th>
                  <th className="py-3 px-6 border-r border-[#1B5288]">Mensagens</th>
                  <th className="py-3 px-4 text-center w-[90px] border-r border-[#1B5288]">Horário</th>
                  <th className="py-3 px-4 text-center w-[70px] border-r border-[#1B5288]">Check</th>
                  <th className="py-3 px-6 text-center w-[210px] border-r border-[#1B5288]">Horário Check / Envio</th>
                  <th className="py-3 px-3 text-center w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Carregando mensagens da base...
                    </td>
                  </tr>
                ) : mensagensList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 space-y-2">
                      <div>Nenhuma mensagem cadastrada para a base {selectedBase}.</div>
                      <button
                        onClick={openAddModal}
                        className="text-blue-600 hover:underline font-bold text-xs"
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
                        className={`transition-colors group hover:bg-blue-50/50 ${
                          index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                        }`}
                      >
                        {/* Último Check */}
                        <td className="py-3 px-4 text-center border-r border-slate-100 font-bold whitespace-nowrap">
                          <span
                            className={item.ultimo_check?.includes('(') ? 'text-red-600' : 'text-slate-800'}
                          >
                            {item.ultimo_check}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="py-3 px-4 text-center border-r border-slate-100 font-bold whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.tipo === 'STATUS'
                                ? 'bg-amber-100 text-amber-800'
                                : item.tipo === 'GRUPO + STATUS'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.tipo}
                          </span>
                        </td>

                        {/* Mensagem */}
                        <td className="py-3 px-6 border-r border-slate-100 font-bold text-slate-900">
                          {item.mensagem}
                        </td>

                        {/* Horário Programado */}
                        <td className="py-3 px-4 text-center border-r border-slate-100 font-semibold text-slate-600 whitespace-nowrap">
                          {item.horario}
                        </td>

                        {/* Checkbox Interativo */}
                        <td className="py-3 px-4 text-center border-r border-slate-100">
                          <button
                            onClick={() => handleToggleCheck(item.id)}
                            className={`w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-white border-slate-300 hover:border-blue-500'
                            }`}
                          >
                            {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                        </td>

                        {/* Horário Check / Envio */}
                        <td className="py-3 px-6 text-center font-bold whitespace-nowrap border-r border-slate-100">
                          {isChecked ? (
                            <span className="text-emerald-600 flex items-center justify-center gap-1">
                              ✓ {state.horario_envio} {state.enviado_por && `(${state.enviado_por})`}
                            </span>
                          ) : item.obs ? (
                            <span className="text-red-500">{item.obs}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Ações: Editar e Excluir */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                              title="Editar Mensagem"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(item)}
                              className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"
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
            <div className="bg-[#0D3559] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipo de Envio
                  </label>
                  <select
                    value={formTipo}
                    onChange={e => setFormTipo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
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
