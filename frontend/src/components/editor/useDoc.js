import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

/**
 * Editing state for an SEO entity: load, local edits, dirty tracking, save (create/update).
 * Populated refs (state/city/hotel/categories) are flattened to ids on save.
 */
const ID_FIELDS = ['state', 'city', 'hotel', 'property'];
const ID_ARRAYS = ['categories', 'hotels', 'relatedHotels'];

function toPayload(doc) {
  const out = { ...doc };
  for (const k of ID_FIELDS) if (out[k] && typeof out[k] === 'object') out[k] = out[k]._id;
  for (const k of ID_ARRAYS) if (Array.isArray(out[k])) out[k] = out[k].map((x) => (typeof x === 'object' ? x._id : x));
  for (const k of ['publicUrl', 'absoluteUrl', 'itineraries', 'linkedProperty', '__v']) delete out[k];
  return out;
}

export function useDoc(endpoint, id, defaults, { onCreated } = {}) {
  const isNew = !id || id === 'new';
  const [doc, setDoc] = useState(isNew ? defaults : null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const defaultsRef = useRef(defaults);

  const load = useCallback(async () => {
    if (isNew) { setDoc(defaultsRef.current); return; }
    try { const { data } = await api.get(`${endpoint}/${id}`); setDoc(data); setDirty(false); } catch (e) { setError(e); }
  }, [endpoint, id, isNew]);
  useEffect(() => { load(); }, [load]);

  const set = useCallback((patch) => { setDoc((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })); setDirty(true); }, []);

  const save = useCallback(async (silent) => {
    setSaving(true);
    try {
      const body = toPayload(doc);
      if (isNew) {
        const { data } = await api.post(endpoint, body);
        toast.success('Draft created');
        setDirty(false);
        onCreated?.(data);
        return data;
      }
      await api.put(`${endpoint}/${id}`, body);
      if (!silent) toast.success('Saved');
      setDirty(false);
      await load();
      return doc;
    } catch (e) {
      toast.error(e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [doc, endpoint, id, isNew, load, onCreated, toast]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  return { doc, set, save, saving, dirty, reload: load, error, isNew };
}
