import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "litecode-settings.json";
const RECENT_KEY = "recentFiles";
const MAX_RECENT = 20;

/**
 * Load recent files list from persistent store.
 */
export async function loadRecentFiles(): Promise<string[]> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    const files = await store.get<string[]>(RECENT_KEY);
    return files ?? [];
  } catch {
    return [];
  }
}

/**
 * Save recent files list to persistent store.
 */
export async function saveRecentFiles(files: string[]): Promise<void> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    await store.set(RECENT_KEY, files.slice(0, MAX_RECENT));
  } catch (err) {
    console.error("Failed to save recent files:", err);
  }
}

/**
 * Add a file to the recent files list and persist.
 */
export async function addRecentFile(
  filePath: string,
  currentList: string[]
): Promise<string[]> {
  const filtered = currentList.filter((f) => f !== filePath);
  const updated = [filePath, ...filtered].slice(0, MAX_RECENT);
  await saveRecentFiles(updated);
  return updated;
}

/**
 * Add a single file to the persistent store (fire-and-forget safe).
 * Call this whenever a file is opened; it deduplicates and trims to MAX_RECENT.
 * Uses a promise queue to serialize writes and prevent lost updates.
 */
let persistQueue = Promise.resolve();

export function persistRecentFile(filePath: string): Promise<void> {
  persistQueue = persistQueue.then(async () => {
    try {
      const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
      const current = (await store.get<string[]>(RECENT_KEY)) ?? [];
      const filtered = current.filter((f) => f !== filePath);
      const updated = [filePath, ...filtered].slice(0, MAX_RECENT);
      await store.set(RECENT_KEY, updated);
    } catch (err) {
      console.error("Failed to persist recent file:", err);
    }
  });
  return persistQueue;
}

/**
 * Clear the recent files list.
 */
export async function clearRecentFiles(): Promise<void> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    await store.set(RECENT_KEY, []);
  } catch (err) {
    console.error("Failed to clear recent files:", err);
  }
}
