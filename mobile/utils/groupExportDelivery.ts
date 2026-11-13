import { Platform, Share } from "react-native";

/**
 * expo-print and expo-sharing are native modules. A static import crashes a
 * binary that shipped before they were linked, so they are loaded on demand.
 */

type PrintModule = {
  printToFileAsync: (options: { html: string; width?: number; height?: number }) => Promise<{ uri: string }>;
};

type SharingModule = {
  isAvailableAsync?: () => Promise<boolean>;
  shareAsync: (url: string, options?: {
    mimeType?: string;
    UTI?: string;
    dialogTitle?: string;
  }) => Promise<void>;
};

type LegacyFileSystem = {
  cacheDirectory: string | null;
  writeAsStringAsync: (uri: string, contents: string, options?: { encoding?: string }) => Promise<void>;
  EncodingType: { UTF8: string };
};

async function loadPrint(): Promise<PrintModule | null> {
  try {
    const loaded = await import("expo-print");
    if (typeof loaded.printToFileAsync !== "function") return null;
    return loaded;
  } catch {
    return null;
  }
}

async function loadSharing(): Promise<SharingModule | null> {
  try {
    const loaded = await import("expo-sharing");
    if (typeof loaded.shareAsync !== "function") return null;
    return loaded;
  } catch {
    return null;
  }
}

async function loadLegacyFileSystem(): Promise<LegacyFileSystem | null> {
  try {
    const loaded = await import("expo-file-system/legacy");
    if (typeof loaded.writeAsStringAsync !== "function") return null;
    return loaded as LegacyFileSystem;
  } catch {
    return null;
  }
}

export function isExportCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cancel|dismiss|did not share|abort/i.test(message);
}

/** PDF needs both native modules. Web prints in the browser instead. */
export async function nativePdfExportAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const [printModule, sharing] = await Promise.all([loadPrint(), loadSharing()]);
  if (!printModule || !sharing) return false;
  try {
    if (sharing.isAvailableAsync) return await sharing.isAvailableAsync();
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, mimeType: string, body: string): void {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtmlDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Export");
  iframe.style.position = "fixed";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.border = "none";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Could not prepare the PDF");
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.onafterprint = () => {
    setTimeout(() => iframe.remove(), 400);
  };
  setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
}

async function shareText(filename: string, body: string): Promise<void> {
  await Share.share(
    { title: filename, message: body },
    Platform.OS === "android" ? { dialogTitle: filename } : undefined,
  );
}

async function shareFile(uri: string, filename: string, mimeType: string, uti: string): Promise<boolean> {
  const sharing = await loadSharing();
  if (!sharing) return false;
  try {
    if (sharing.isAvailableAsync && !(await sharing.isAvailableAsync())) return false;
    await sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: filename });
    return true;
  } catch (error) {
    if (isExportCancel(error)) throw error;
    return false;
  }
}

export async function deliverGroupCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === "web") {
    downloadTextFile(filename, "text/csv;charset=utf-8", csv);
    return;
  }
  try {
    const files = await loadLegacyFileSystem();
    const directory = files?.cacheDirectory;
    if (files && directory) {
      const uri = `${directory}${filename}`;
      await files.writeAsStringAsync(uri, csv, { encoding: files.EncodingType.UTF8 });
      const shared = await shareFile(uri, filename, "text/csv", "public.comma-separated-values-text");
      if (shared) return;
    }
  } catch (error) {
    if (isExportCancel(error)) throw error;
  }
  await shareText(filename, csv);
}

export async function deliverGroupPdf(filename: string, html: string): Promise<void> {
  if (Platform.OS === "web") {
    printHtmlDocument(html);
    return;
  }
  const printModule = await loadPrint();
  if (!printModule) {
    throw new Error("PDF export needs an app update");
  }
  const file = await printModule.printToFileAsync({ html, width: 595, height: 842 });
  const shared = await shareFile(file.uri, filename, "application/pdf", "com.adobe.pdf");
  if (!shared) {
    await Share.share(
      { title: filename, url: file.uri, message: filename },
      Platform.OS === "android" ? { dialogTitle: filename } : undefined,
    );
  }
}
