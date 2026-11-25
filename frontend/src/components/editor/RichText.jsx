import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading3, List, ListOrdered, Quote, Link2, Undo2, Redo2, Unlink } from 'lucide-react';
import { cx } from '../../lib/format';

/**
 * Lightweight rich-text editor (TipTap). H2 is reserved for section headings in the
 * structured content editor, so the body toolbar offers H3 and below — keeps a clean
 * heading hierarchy for SEO. Output HTML is sanitised again on the server.
 */
export function RichText({ value, onChange, placeholder = 'Write here…', minimal }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3, 4] }, link: { openOnClick: false, autolink: true } })],
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: { attributes: { class: 'tiptap prose-lt px-3.5 py-3 text-[15px]', 'data-placeholder': placeholder } },
  });

  // Sync when the parent loads a different document
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(editor.isEmpty && !value)) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="input h-32" />;
  const Btn = ({ on, active, icon: Icon, label }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={on} title={label} aria-label={label} className={cx('grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink', active && 'bg-primary-soft text-primary')}><Icon size={15} /></button>
  );
  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL (use /hotels/... for internal links)', prev || '');
    if (url === null) return;
    if (url === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  return (
    <div className="overflow-hidden rounded-brand border border-line bg-card focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface/60 px-1.5 py-1">
        <Btn icon={Bold} label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <Btn icon={Italic} label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        {!minimal && <Btn icon={Heading3} label="Sub-heading (H3)" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />}
        <Btn icon={List} label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <Btn icon={ListOrdered} label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        {!minimal && <Btn icon={Quote} label="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />}
        <Btn icon={Link2} label="Link" on={setLink} active={editor.isActive('link')} />
        {editor.isActive('link') && <Btn icon={Unlink} label="Remove link" on={() => editor.chain().focus().unsetLink().run()} />}
        <span className="mx-1 h-5 w-px bg-line" />
        <Btn icon={Undo2} label="Undo" on={() => editor.chain().focus().undo().run()} />
        <Btn icon={Redo2} label="Redo" on={() => editor.chain().focus().redo().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
