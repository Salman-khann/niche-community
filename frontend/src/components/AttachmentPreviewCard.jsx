import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';

const PREVIEWABLE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'log']);
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const PDF_EXTENSIONS = new Set(['pdf']);

const getUrlFileName = (url) => {
    try {
        const pathname = new URL(url).pathname;
        return decodeURIComponent(pathname.split('/').pop() || 'file');
    } catch {
        const noQuery = String(url || '').split('?')[0];
        return decodeURIComponent(noQuery.split('/').pop() || 'file');
    }
};

const toReadableFileName = (raw) => raw.replace(/-\d{13}(?=\.[a-z0-9]+$)/i, '');

const getExtension = (fileName) => (fileName.split('.').pop() || '').toLowerCase();

const toSnippet = (text) => {
    if (!text) return '';
    const normalized = text.replace(/\r/g, '').trim();
    if (!normalized) return '';
    const lines = normalized.split('\n').slice(0, 6).join('\n');
    return lines.length > 320 ? `${lines.slice(0, 320)}...` : lines;
};

const AttachmentPreviewCard = ({ url, allUrls = null, initialIndex = 0 }) => {
    const modalUrls = useMemo(() => {
        if (Array.isArray(allUrls) && allUrls.length > 0) return allUrls;
        return [url];
    }, [allUrls, url]);

    const safeInitialIndex = Math.max(0, Math.min(initialIndex, modalUrls.length - 1));
    const [previewIndex, setPreviewIndex] = useState(safeInitialIndex);
    const currentUrl = modalUrls[previewIndex] || url;

    const fileName = useMemo(() => toReadableFileName(getUrlFileName(currentUrl)), [currentUrl]);
    const ext = useMemo(() => getExtension(fileName), [fileName]);
    const canPreviewText = PREVIEWABLE_EXTENSIONS.has(ext);

    const [snippet, setSnippet] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    const previewUrl = useMemo(() => {
        const encoded = encodeURIComponent(currentUrl);
        if (OFFICE_EXTENSIONS.has(ext)) {
            return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
        }
        if (PDF_EXTENSIONS.has(ext)) {
            return `https://docs.google.com/gview?embedded=1&url=${encoded}`;
        }
        return '';
    }, [currentUrl, ext]);

    useEffect(() => {
        let active = true;
        if (!canPreviewText) {
            return;
        }

        fetch(currentUrl)
            .then((res) => (res.ok ? res.text() : ''))
            .then((text) => {
                if (!active) return;
                setSnippet(toSnippet(text));
            })
            .catch(() => {
                if (!active) return;
                setSnippet('');
            });

        return () => {
            active = false;
        };
    }, [currentUrl, canPreviewText]);

    const canNavigate = modalUrls.length > 1;
    const goPrev = () => setPreviewIndex((prev) => (prev > 0 ? prev - 1 : modalUrls.length - 1));
    const goNext = () => setPreviewIndex((prev) => (prev < modalUrls.length - 1 ? prev + 1 : 0));

    return (
        <>
            <div className="rounded-lg border border-discord-border/40 overflow-hidden bg-discord-darkest">
                {snippet && (
                    <pre className="text-[11px] leading-relaxed text-discord-light whitespace-pre-wrap max-h-28 overflow-hidden px-3 py-2 border-b border-discord-border/30 bg-discord-darkest/70">
                        {snippet}
                    </pre>
                )}
                <div className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-discord-faint shrink-0" />
                        <div className="min-w-0">
                            <span className="text-xs text-discord-light truncate block">{fileName}</span>
                            <span className="text-[10px] text-discord-faint uppercase">{ext || 'FILE'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setPreviewIndex(safeInitialIndex);
                                setShowPreview(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-discord-muted hover:text-discord-light"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Open
                        </button>
                        <a href={url} download={fileName} className="inline-flex items-center gap-1 text-[11px] text-blurple hover:underline" target="_blank" rel="noreferrer">
                            <Download className="w-3 h-3" />
                            Download
                        </a>
                    </div>
                </div>
            </div>

            {showPreview && (
                <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm p-4" onClick={() => setShowPreview(false)}>
                    <div className="mx-auto h-full max-w-5xl rounded-xl border border-discord-border/60 bg-discord-darkest overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="h-11 px-4 border-b border-discord-border/50 flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-xs text-discord-light truncate">{fileName}</p>
                                {canNavigate && (
                                    <p className="text-[10px] text-discord-faint">{previewIndex + 1} / {modalUrls.length}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {canNavigate && (
                                    <>
                                        <button type="button" onClick={goPrev} className="w-7 h-7 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center text-discord-faint hover:text-discord-light">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={goNext} className="w-7 h-7 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center text-discord-faint hover:text-discord-light">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                <button type="button" onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center text-discord-faint hover:text-discord-light">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="h-[calc(100%-44px)]">
                            {canPreviewText ? (
                                <pre className="h-full overflow-auto p-4 text-xs leading-relaxed text-discord-light whitespace-pre-wrap">{snippet || 'Preview unavailable for this text file.'}</pre>
                            ) : previewUrl ? (
                                <iframe title={`Preview ${fileName}`} src={previewUrl} className="w-full h-full border-0" />
                            ) : (
                                <div className="h-full flex items-center justify-center px-6 text-center">
                                    <div>
                                        <p className="text-sm text-discord-light">Preview is not available for this file type.</p>
                                        <a href={currentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-blurple hover:underline">Open in new tab</a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AttachmentPreviewCard;
