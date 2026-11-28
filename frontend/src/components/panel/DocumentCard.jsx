import { useEffect, useState } from 'react';
import { FileText, ImageOff, Maximize2, ExternalLink } from 'lucide-react';
import { Modal, StatusBadge, Spinner } from '../ui';
import { api } from '../../lib/api';
import { titleCase, dateLabel } from '../../lib/format';

export const DOCUMENT_LABELS = {
  gst_certificate: 'GST certificate', pan: 'PAN card', trade_licence: 'Trade licence',
  property_proof: 'Property ownership / lease', id_proof: 'Owner ID proof', cancelled_cheque: 'Cancelled cheque',
};

/** Fetches a private file with the session token and exposes it as a temporary in-memory URL */
function usePrivateFile(url) {
  const [state, setState] = useState({ src: null, failed: false });
  useEffect(() => {
    let src; let gone = false;
    setState({ src: null, failed: false });
    api.blob(url)
      .then((blob) => { if (!gone) { src = URL.createObjectURL(blob); setState({ src, failed: false }); } })
      .catch(() => { if (!gone) setState({ src: null, failed: true }); });
    return () => { gone = true; if (src) URL.revokeObjectURL(src); };
  }, [url]);
  return state;
}

/** One uploaded document: photo preview (PDFs open in a new tab), status and optional actions */
export function DocumentCard({ doc, fileUrl, actions }) {
  const { src, failed } = usePrivateFile(fileUrl);
  const [open, setOpen] = useState(false);
  const label = DOCUMENT_LABELS[doc.type] || titleCase(doc.type);
  const pdf = doc.mime === 'application/pdf';
  const frame = 'relative grid h-36 w-full place-items-center overflow-hidden bg-surface';

  let preview;
  if (failed) preview = <div className={frame}><span className="text-center text-xs text-muted"><ImageOff size={22} className="mx-auto mb-1" />Preview unavailable</span></div>;
  else if (!src) preview = <div className={frame}><Spinner /></div>;
  else if (pdf) preview = <a href={src} target="_blank" rel="noreferrer" className={frame}><span className="text-center text-xs font-bold text-primary"><FileText size={32} className="mx-auto mb-1" /><span className="inline-flex items-center gap-1">Open PDF<ExternalLink size={12} /></span></span></a>;
  else preview = (
    <button type="button" onClick={() => setOpen(true)} className={`${frame} group`} aria-label={`View ${label}`}>
      <img src={src} alt={label} className="h-full w-full object-cover" />
      <span className="absolute right-2 top-2 rounded-lg bg-secondary/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 size={14} /></span>
    </button>
  );

  return (
    <div className="overflow-hidden rounded-brand border border-line bg-card">
      {preview}
      <div className="space-y-1.5 border-t border-line p-3">
        <p className="truncate text-sm font-bold">{label}</p>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={doc.status === 'verified' ? 'approved' : doc.status} />
          {doc.createdAt && <span className="text-xs text-muted">{dateLabel(doc.createdAt)}</span>}
        </div>
        {doc.note && <p className="text-xs text-danger">{doc.note}</p>}
        {actions}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={label} size="lg">
        <img src={src} alt={label} className="mx-auto max-h-[75vh] w-auto" />
      </Modal>
    </div>
  );
}
