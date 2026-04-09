import localforage from "localforage"

export interface EsgReportRecord {
  id: string
  name: string
  createdAtISO: string
  pdfDataUri: string
}

const REPORTS_STORAGE_KEY = "reports"

const esgStorage = localforage.createInstance({
  name: "lumivia",
  storeName: "esg_reports",
})

export async function loadEsgReports(): Promise<EsgReportRecord[]> {
  const stored = await esgStorage.getItem<EsgReportRecord[]>(REPORTS_STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

export async function saveEsgReports(reports: EsgReportRecord[]): Promise<void> {
  await esgStorage.setItem(REPORTS_STORAGE_KEY, reports)
}

export async function appendEsgReport(report: EsgReportRecord): Promise<EsgReportRecord[]> {
  const current = await loadEsgReports()
  const next = [report, ...current].slice(0, 40)
  await saveEsgReports(next)
  return next
}

