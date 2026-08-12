"use client";

import { useEffect, useRef } from "react";
import "react-quill-new/dist/quill.snow.css";
import "quill-better-table/dist/quill-better-table.css";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

/**
 * Normalize HTML tables so quill-better-table can safely manage column resizing & context menus
 * without null pointer crashes (colGroup, cellNode, colBlot, startTd, endTd).
 */
function normalizeTableHtmlForQuill(html: string): string {
  if (!html || !html.includes("<table")) return html || "";

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tables = doc.querySelectorAll("table");

    tables.forEach((table) => {
      if (!table.classList.contains("quill-better-table")) {
        table.classList.add("quill-better-table");
      }

      // Ensure every tr/td/th has data-row attribute so quill-better-table selection handlers (startTd/endTd) never return null
      const rows = table.querySelectorAll("tr");
      rows.forEach((tr, rIdx) => {
        const rowId = `row_${rIdx + 1}_${Math.random().toString(36).substr(2, 4)}`;
        const cells = tr.querySelectorAll("td, th");
        cells.forEach((cell) => {
          if (!cell.getAttribute("data-row")) {
            cell.setAttribute("data-row", rowId);
          }
        });
      });

      if (!table.querySelector("colgroup")) {
        if (rows[0]) {
          const colCount = rows[0].children.length;
          const colgroup = doc.createElement("colgroup");
          for (let i = 0; i < colCount; i++) {
            const col = doc.createElement("col");
            col.setAttribute("width", "150");
            colgroup.appendChild(col);
          }
          table.insertBefore(colgroup, table.firstChild);
        }
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    return html;
  }
}

/**
 * Sanitize HTML from Quill editor:
 * - Replace &nbsp; with regular space so text wraps naturally in browsers
 * - Remove CSS variable references like var(--ldx-...) from pasted content
 * - Clean up quill-better-table UI overlays
 */
function sanitizeQuillHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<div class="qlbt-col-tool"[\s\S]*?<\/div>/g, "")
    .replace(/<div class="qlbt-operation-menu"[\s\S]*?<\/div>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/background-color:\s*var\(--[^)]+\);?/g, "")
    .replace(/style="\s*"/g, "");
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    let isMounted = true;

    Promise.all([import("quill"), import("quill-better-table")]).then(([QuillModule, BetterTableModule]) => {
      if (!isMounted || !containerRef.current) return;

      const Quill = QuillModule.default || QuillModule;
      const QuillBetterTable = BetterTableModule.default || BetterTableModule;

      try {
        Quill.register({ "modules/better-table": QuillBetterTable }, true);
      } catch (e) {
        // Module might already be registered
      }

      const editorContainer = containerRef.current.querySelector(".editor-container");
      if (!editorContainer) return;

      // Mouse event guard to prevent quill-better-table startTd / endTd null pointer crashes
      const guardMouseEvent = (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        const table = target.closest(".quill-better-table");
        if (table) {
          const rows = table.querySelectorAll("tr");
          rows.forEach((tr, rIdx) => {
            const rowId = `row_${rIdx + 1}`;
            const cells = tr.querySelectorAll("td, th");
            cells.forEach((cell) => {
              if (!cell.hasAttribute("data-row")) {
                cell.setAttribute("data-row", rowId);
              }
            });
          });

          // If clicked inside table but NOT on an actual td[data-row] (e.g. colgroup, border, tool bar),
          // stop immediate propagation so quill-better-table's un-guarded mouseDownHandler never runs with startTd = null
          const td = target.closest("td[data-row]");
          if (!td) {
            e.stopImmediatePropagation();
          }
        }
      };

      editorContainer.addEventListener("mousedown", guardMouseEvent, true);
      editorContainer.addEventListener("mousemove", guardMouseEvent, true);

      const quill = new Quill(editorContainer as HTMLElement, {
        theme: "snow",
        placeholder: placeholder || "Biên soạn nội dung bài đọc HTML phong phú (Heading, Bảng, Danh sách, Video YouTube, Hình ảnh...)",
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, 4, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ align: [] }],
              ["blockquote", "code-block"],
              ["link", "image", "video"],
              ["insert-table"],
              ["clean"],
            ],
            handlers: {
              "insert-table": function () {
                const tableModule = quill.getModule("better-table") as any;
                if (tableModule && typeof tableModule.insertTable === "function") {
                  tableModule.insertTable(3, 3);
                }
              },
            },
          },
          "better-table": {
            operationMenu: {
              items: {
                unmergeCells: {
                  text: "Tách ô",
                },
              },
              color: {
                colors: ["#fff1ea", "#ffffff", "#6d3807", "#d8c2b6"],
                text: "Màu nền ô",
              },
            },
          },
          keyboard: {
            bindings: QuillBetterTable.keyboardBindings,
          },
        },
      });

      quillRef.current = quill;

      if (value) {
        const normalized = normalizeTableHtmlForQuill(value);
        quill.clipboard.dangerouslyPasteHTML(normalized);
      }

      quill.on("text-change", () => {
        if (isUpdatingRef.current) return;
        const html = quill.root.innerHTML;
        onChange(sanitizeQuillHtml(html));
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update editor content if value changes externally
  useEffect(() => {
    if (!quillRef.current) return;
    const currentHtml = quillRef.current.root.innerHTML;
    if (value !== currentHtml && !isUpdatingRef.current) {
      isUpdatingRef.current = true;
      const selection = quillRef.current.getSelection();
      const normalized = normalizeTableHtmlForQuill(value || "");
      quillRef.current.clipboard.dangerouslyPasteHTML(normalized);
      if (selection) quillRef.current.setSelection(selection);
      isUpdatingRef.current = false;
    }
  }, [value]);

  return (
    <div ref={containerRef} className="rich-editor-wrapper text-xs text-[#211a16] bg-white rounded-2xl border border-[#d8c2b6] overflow-hidden shadow-2xs">
      <div className="editor-container min-h-[180px]" />
    </div>
  );
}
