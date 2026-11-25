import { Input, Select } from '../ui';
import { RichText } from './RichText';
import { Repeater } from './Repeater';

/** H1 + intro + ordered H2/H3 sections — gives editors explicit control of heading hierarchy. */
export function ContentEditor({ value = {}, onChange, h1Placeholder }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <Input label="H1 heading (one per page)" value={value.h1 || ''} placeholder={h1Placeholder} onChange={(e) => set({ h1: e.target.value })} hint="Main page heading — include the primary keyword naturally" />
      <div><p className="field-label">Introduction</p><RichText value={value.intro || ''} onChange={(v) => set({ intro: v })} placeholder="Opening paragraph shown under the H1" /></div>
      <Repeater
        title="Sections (H2 / H3)"
        items={value.sections || []}
        onChange={(sections) => set({ sections })}
        newItem={() => ({ heading: '', level: 'h2', body: '' })}
        addLabel="Add section"
        render={(s, update) => (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Input label="Heading" value={s.heading} onChange={(e) => update({ heading: e.target.value })} />
              <Select label="Level" value={s.level} onChange={(e) => update({ level: e.target.value })} options={[{ value: 'h2', label: 'H2' }, { value: 'h3', label: 'H3' }]} />
            </div>
            <RichText value={s.body} onChange={(v) => update({ body: v })} />
          </div>
        )}
      />
    </div>
  );
}

export function FaqEditor({ value = [], onChange }) {
  return (
    <Repeater
      items={value}
      onChange={onChange}
      newItem={() => ({ question: '', answer: '' })}
      addLabel="Add FAQ"
      render={(f, update) => (
        <div className="space-y-3">
          <Input label="Question" value={f.question} onChange={(e) => update({ question: e.target.value })} />
          <div><p className="field-label">Answer</p><RichText minimal value={f.answer} onChange={(v) => update({ answer: v })} /></div>
        </div>
      )}
    />
  );
}

export function LinksEditor({ value = [], onChange }) {
  return (
    <Repeater
      compact
      items={value}
      onChange={onChange}
      newItem={() => ({ label: '', url: '' })}
      addLabel="Add internal link"
      render={(l, update) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input input-sm" placeholder="Anchor text" value={l.label} onChange={(e) => update({ label: e.target.value })} />
          <input className="input input-sm" placeholder="/hotels/rajasthan/udaipur/..." value={l.url} onChange={(e) => update({ url: e.target.value })} />
        </div>
      )}
    />
  );
}

/** Simple string list (facilities, amenities, meals, tips) */
export function StringList({ value = [], onChange, placeholder, addLabel = 'Add' }) {
  return (
    <Repeater compact items={value.map((v) => ({ v }))} onChange={(arr) => onChange(arr.map((x) => x.v))} newItem={() => ({ v: '' })} addLabel={addLabel} render={(x, update) => <input className="input input-sm" placeholder={placeholder} value={x.v} onChange={(e) => update({ v: e.target.value })} />} />
  );
}
