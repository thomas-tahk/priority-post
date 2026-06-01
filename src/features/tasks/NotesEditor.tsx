"use client";

import { useEffect, useRef, useTransition } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily } from "@tiptap/extension-text-style";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { updateTaskNotes } from "./actions";

const SAVE_DEBOUNCE_MS = 600;

const FONTS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, 'SF Mono', Menlo, monospace" },
];

const COLORS = ["#dc2626", "#ea580c", "#16a34a", "#2563eb", "#9333ea", "#db2777"];

function htmlOf(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

function Toolbar({ editor }: { editor: Editor }) {
  const currentFont = editor.getAttributes("textStyle").fontFamily ?? "";
  const currentColor = editor.getAttributes("textStyle").color ?? "";

  return (
    <div className="notes-toolbar">
      <button
        type="button"
        title="Bold"
        className={editor.isActive("bold") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        title="Italic"
        className={editor.isActive("italic") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        title="Strikethrough"
        className={editor.isActive("strike") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </button>

      <span className="notes-toolbar-sep" />

      <button
        type="button"
        title="Bullet list"
        className={editor.isActive("bulletList") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </button>
      <button
        type="button"
        title="Checklist"
        className={editor.isActive("taskList") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        ☑
      </button>

      <span className="notes-toolbar-sep" />

      <select
        title="Font"
        className="notes-toolbar-font"
        value={currentFont}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={`Color ${c}`}
          className={`notes-swatch${currentColor === c ? " active" : ""}`}
          style={{ background: c }}
          onClick={() => editor.chain().focus().setColor(c).run()}
        />
      ))}
      <button
        type="button"
        title="Default color"
        className={`notes-swatch notes-swatch-clear${currentColor === "" ? " active" : ""}`}
        onClick={() => editor.chain().focus().unsetColor().run()}
      >
        ⊘
      </button>
    </div>
  );
}

export function NotesEditor({
  taskId,
  initialContent,
}: {
  taskId: number;
  initialContent: string;
}) {
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest HTML in a ref so the unmount flush captures pending edits
  // without depending on editor identity.
  const pending = useRef<string | null>(null);

  function save(html: string) {
    pending.current = null;
    startTransition(() => updateTaskNotes(taskId, html));
  }

  const editor = useEditor({
    // Required for SSR (Next.js) — avoids a hydration mismatch.
    immediatelyRender: false,
    // Re-render on each transaction so toolbar active states stay in sync.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Add notes, links, or context…" }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: { class: "notes-editor-content", "aria-label": "Notes" },
    },
    onUpdate: ({ editor }) => {
      const html = htmlOf(editor);
      pending.current = html;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(html), SAVE_DEBOUNCE_MS);
    },
  });

  // Flush any pending edit when the panel closes/switches (key remount unmounts us).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) save(pending.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!editor) return null;

  return (
    <div className="notes-editor">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
