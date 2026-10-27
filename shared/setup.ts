export const downloadableModels = ["qwen3:4b", "qwen3:1.7b"] as const;
export interface ModelDownload {
  model: string; status: "downloading" | "completed" | "failed" | "cancelled";
  detail: string; completed: number; total: number;
}
export interface SetupStatus {
  local: boolean; connected: boolean; spreadsheetId: string; serviceEmail: string;
  ai: { connected: boolean; models: string[]; model: string; detail: string };
  download?: ModelDownload;
}
export interface SheetsSetupCheck {
  checkId: string; spreadsheetId: string; serviceEmail: string; missingTabs: number;
  counts: { leads: number; campaigns: number; conversations: number };
}
