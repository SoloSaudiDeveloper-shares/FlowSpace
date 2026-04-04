"use client"

import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"

import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import { useTheme } from "next-themes"
import { useCallback, useRef } from "react"
import { savePageContent } from "@/lib/actions/page-actions"

interface PageEditorProps {
  pageId: string
  initialContent?: string | null
}

export function PageEditor({ pageId, initialContent }: PageEditorProps) {
  const { resolvedTheme } = useTheme()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  })

  const handleChange = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      const content = JSON.stringify(editor.document)
      savePageContent(pageId, content)
    }, 500)
  }, [editor, pageId])

  return (
    <div className="flex-1 [&_.bn-editor]:min-h-[calc(100vh-12rem)]">
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        data-theming-css-variables-demo
      />
    </div>
  )
}
