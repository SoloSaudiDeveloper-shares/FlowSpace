"use client"

import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"

import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import { useTheme } from "@/components/theme-provider"
import { useCallback, useEffect, useRef, useState } from "react"
import { savePageContent } from "@/lib/actions/page-actions"
import { TTSButton } from "@/components/shared/tts-button"
import { AIActionButton } from "@/components/shared/ai-action-button"
import { SpeechButton } from "@/components/shared/speech-button"

interface PageEditorProps {
  pageId: string
  initialContent?: string | null
}

/** Extract plain text from BlockNote document blocks */
function blocksToText(blocks: unknown[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    const b = block as Record<string, unknown>
    // Inline content
    if (Array.isArray(b.content)) {
      const line = (b.content as Record<string, unknown>[])
        .map((ic) => (typeof ic.text === "string" ? ic.text : ""))
        .join("")
      if (line) lines.push(line)
    }
    // Recurse into nested children
    if (Array.isArray(b.children) && b.children.length > 0) {
      const nested = blocksToText(b.children as unknown[])
      if (nested) lines.push(nested)
    }
  }
  return lines.join("\n")
}

export function PageEditor({ pageId, initialContent }: PageEditorProps) {
  const { resolvedTheme } = useTheme()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [docText, setDocText] = useState("")

  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  })

  // Extract text from initial content on mount
  useEffect(() => {
    setDocText(blocksToText(editor.document as unknown[]))
  }, [editor])

  const handleChange = useCallback(() => {
    // Update plain-text snapshot for AI buttons
    setDocText(blocksToText(editor.document as unknown[]))

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      const content = JSON.stringify(editor.document)
      savePageContent(pageId, content)
    }, 500)
  }, [editor, pageId])

  /** Insert AI result at the end of the document */
  function handleAIResult(result: string, action: string) {
    if (action === "continue" || action === "expand") {
      // Append as a new paragraph at end
      const newBlock = { type: "paragraph" as const, content: result }
      editor.insertBlocks([newBlock], editor.document[editor.document.length - 1], "after")
    } else {
      // Replace entire document with the result
      const newBlock = { type: "paragraph" as const, content: result }
      editor.replaceBlocks(editor.document, [newBlock])
    }
    // Trigger save
    handleChange()
  }

  /** Insert speech transcript at cursor or end */
  function handleTranscript(text: string) {
    const newBlock = { type: "paragraph" as const, content: text }
    editor.insertBlocks([newBlock], editor.document[editor.document.length - 1], "after")
    handleChange()
  }

  return (
    <div className="flex-1">
      {/* AI toolbar */}
      <div className="flex items-center gap-1 mb-2">
        <AIActionButton
          text={docText}
          onResult={handleAIResult}
          actions={["summarize", "expand", "fix_grammar", "improve", "continue"]}
          size="sm"
        />
        <TTSButton text={docText} size="sm" tooltip="Read page aloud" />
        <SpeechButton
          onTranscript={handleTranscript}
          size="sm"
          tooltip="Dictate to page"
        />
      </div>

      <div className="[&_.bn-editor]:min-h-[calc(100vh-14rem)]">
        <BlockNoteView
          editor={editor}
          onChange={handleChange}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          data-theming-css-variables-demo
        />
      </div>
    </div>
  )
}
