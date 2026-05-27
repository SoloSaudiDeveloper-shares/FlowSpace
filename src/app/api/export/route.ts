import { NextRequest, NextResponse } from "next/server"
import { exportElements, exportTasks, exportAllData } from "@/lib/actions/export-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? "all"
  const format = (searchParams.get("format") ?? "json") as "json" | "csv"
  const projectId = searchParams.get("projectId")

  try {
    let data: string
    let fileName: string
    let contentType: string

    switch (type) {
      case "elements":
        data = await exportElements(format)
        fileName = `flowspace-elements.${format}`
        contentType =
          format === "json" ? "application/json" : "text/csv"
        break

      case "tasks":
        if (!projectId) {
          return NextResponse.json(
            { error: "projectId required for task export" },
            { status: 400 }
          )
        }
        data = await exportTasks(projectId, format)
        fileName = `flowspace-tasks.${format}`
        contentType =
          format === "json" ? "application/json" : "text/csv"
        break

      case "all":
      default:
        data = await exportAllData()
        fileName = "flowspace-full-export.json"
        contentType = "application/json"
        break
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    )
  }
}
