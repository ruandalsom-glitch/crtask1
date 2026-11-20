import React, { useState } from 'react';
import { FileViewerModal } from './FileViewerModal';
import { FileText, Image as ImageIcon, Film } from 'lucide-react';

interface UpdateContentProps {
  content: string;
  taskTitle: string;
}

export function UpdateContent({ content, taskTitle }: UpdateContentProps) {
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; isImage: boolean; isVideo: boolean } | null>(null);

  // Extract attachments
  const attachments: { name: string; url: string; type: 'image' | 'video' | 'file' }[] = [];
  
  // Clean content from known attachment formats
  let cleanContent = content;

  // 1. Process images and videos: ![name](url)
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/[^)]+)\)/g;
  const imageMatches = Array.from(content.matchAll(imageRegex));
  imageMatches.forEach(match => {
    const url = match[2];
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i);
    attachments.push({
      name: match[1] || 'Imagem/Video',
      url: url,
      type: isVideo ? 'video' : 'image'
    });
    cleanContent = cleanContent.replace(match[0], '');
  });

  // 2. Process file links: 📁 **Arquivo anexado:** [name](url) OR just [name](url) if it points to /attachments/
  const fileRegex = /(?:📁 \*\*Arquivo anexado:\*\* )?\[([^\]]+)\]\((https:\/\/[^)]+\/attachments\/[^)]+)\)/g;
  const fileMatches = Array.from(cleanContent.matchAll(fileRegex));
  fileMatches.forEach(match => {
    attachments.push({
      name: match[1],
      url: match[2],
      type: 'file'
    });
    cleanContent = cleanContent.replace(match[0], '');
  });

  // Renderiza texto e links Markdown seguros (http/https apenas) como elementos React sem dangerouslySetInnerHTML
  const renderSafeTextWithLinks = (text: string) => {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      const label = match[1];
      const href = match[2];
      nodes.push(
        <a
          key={`${match.index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
        >
          {label}
        </a>
      );
      lastIndex = linkPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Text Content */}
      {cleanContent.trim() && (
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
          {renderSafeTextWithLinks(cleanContent)}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {attachments.map((att, i) => {
            if (att.type === 'image') {
              return (
                <div key={i} className="relative group cursor-pointer" onClick={() => setPreviewFile({ name: att.name, url: att.url, isImage: true, isVideo: false })}>
                  <img src={att.url} alt={att.name} className="max-w-full rounded-lg max-h-64 object-cover border border-slate-200 shadow-sm" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <span className="text-white font-medium flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Visualizar</span>
                  </div>
                </div>
              );
            }
            if (att.type === 'video') {
              return (
                <div key={i} className="relative group">
                  <video src={att.url} controls className="max-w-full rounded-lg max-h-96 border border-slate-200 shadow-sm"></video>
                </div>
              );
            }
            return (
              <div 
                key={i} 
                onClick={() => setPreviewFile({ name: att.name, url: att.url, isImage: false, isVideo: false })}
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group w-64"
              >
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">{att.name}</span>
                  <span className="text-xs text-slate-400">Arquivo anexo</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File Viewer Modal */}
      {previewFile && (
        <FileViewerModal 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
          taskTitle={taskTitle} 
        />
      )}
    </div>
  );
}
