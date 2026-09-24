import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL do Google Agenda é obrigatória.' }, { status: 400 });
    }

    // Garante que é uma URL válida do Google Calendar iCal
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('webcal://')) {
      cleanUrl = cleanUrl.replace('webcal://', 'https://');
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'URL inválida. O link deve começar com https://' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // Timeout de 6 segundos max
    let res: Response;

    try {
      res = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
        next: { revalidate: 60 }, // Cache de 1 minuto
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Tempo de resposta excedido ao conectar com a Google Agenda.' }, { status: 504 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Falha ao buscar a agenda do Google (Status ${res.status}). Verifique se a URL do iCal está correta.` }, { status: 400 });
    }

    const icsText = await res.text();
    const events = parseIcsContent(icsText);

    return NextResponse.json({ success: true, count: events.length, events });
  } catch (err: any) {
    console.error('Erro na rota sync-google-calendar:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno ao processar a Google Agenda.' }, { status: 500 });
  }
}

function parseIcsContent(icsData: string) {
  // Desdobra linhas estendidas do padrão iCal (\r\n seguido de espaço ou tab)
  const unfolded = icsData.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: any[] = [];
  let currentEvent: any = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (currentEvent && currentEvent.due_date) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = line.slice(0, colonIndex);
    const value = unescapeIcsText(line.slice(colonIndex + 1));
    const [keyName, ...params] = keyPart.split(';');

    switch (keyName.toUpperCase()) {
      case 'UID':
        currentEvent.id = `gcal-${value.trim()}`;
        break;
      case 'SUMMARY':
        currentEvent.title = value.trim() || 'Compromisso Google Agenda';
        break;
      case 'DESCRIPTION':
        currentEvent.notes = value.trim();
        break;
      case 'LOCATION':
        currentEvent.location = value.trim();
        break;
      case 'DTSTART': {
        const parsedDate = parseIcsDateTime(value, params);
        if (parsedDate) {
          currentEvent.due_date = parsedDate.dateStr;
          if (parsedDate.timeStr) {
            currentEvent.due_time = parsedDate.timeStr;
          }
        }
        break;
      }
      case 'DTEND': {
        const parsedDate = parseIcsDateTime(value, params);
        if (parsedDate && parsedDate.timeStr) {
          currentEvent.end_time = parsedDate.timeStr;
        }
        break;
      }
    }
  }

  // Preenche metadados necessários para renderização como chip/card no calendário
  return events.map((evt, idx) => ({
    id: evt.id || `gcal-evt-${idx}-${Date.now()}`,
    title: evt.title || 'Evento Google Agenda',
    due_date: evt.due_date,
    due_time: evt.due_time || '',
    end_time: evt.end_time || '',
    notes: evt.notes || '',
    location: evt.location || '',
    task_type: 'GoogleCalendar',
    status: 'Google',
    priority: '📅 Google',
    isGoogleCalendar: true,
  }));
}

function parseIcsDateTime(valStr: string, params: string[]) {
  const cleanVal = valStr.trim();
  if (!cleanVal) return null;

  // Formato AAAA-MM-DD ou AAAAMMDD
  if (cleanVal.length === 8 && /^\d{8}$/.test(cleanVal)) {
    const yyyy = cleanVal.slice(0, 4);
    const mm = cleanVal.slice(4, 6);
    const dd = cleanVal.slice(6, 8);
    return { dateStr: `${yyyy}-${mm}-${dd}` };
  }

  // Formato AAAAMMDDTHHMMSS ou AAAAMMDDTHHMMSSZ
  const match = cleanVal.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [_, yyyy, mm, dd, hh, min] = match;
    return {
      dateStr: `${yyyy}-${mm}-${dd}`,
      timeStr: `${hh}:${min}`,
    };
  }

  return null;
}

function unescapeIcsText(str: string): string {
  return str
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
