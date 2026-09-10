import { SAVE_SOURCE_KEYS } from "./saveV14";

export class SaveConflict extends Error {
  constructor() {
    super("ほかのタブで記録が更新されました。この画面からは上書きしていません。");
  }
}

export type ExclusiveWrite = (operation: () => void) => Promise<void>;
const LOCK_NAME = "ikusei-save-writer";
let database: Promise<IDBDatabase> | undefined;

/** The fallback uses a readwrite transaction only as a cross-tab mutex. */
function lockDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCK_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("writer");
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
  });
}

/** All callbacks are synchronous: read, compare, write and update page memory together. */
export const exclusiveSave: ExclusiveWrite = async operation => {
  if (navigator.locks) {
    await navigator.locks.request(LOCK_NAME, operation);
    return;
  }
  const db = await lockDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("writer", "readwrite");
    let failure: unknown;
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(failure ?? transaction.error);
    transaction.onerror = () => reject(failure ?? transaction.error);
    // A request runs only after earlier transactions release the same object store.
    transaction.objectStore("writer").get("lock").onsuccess = () => {
      try { operation(); }
      catch (error) { failure = error; transaction.abort(); }
    };
  });
};

/** Capture BEFORE loading the state. Include legacy sources, deletions and cursor-only writes. */
export function createSaveAccess(store: Pick<Storage, "getItem">, exclusive: ExclusiveWrite = exclusiveSave) {
  const read = () => SAVE_SOURCE_KEYS.map(key => store.getItem(key));
  let expected = read();
  return {
    run(operation: () => void) {
      return exclusive(() => {
        if (read().some((value, i) => value !== expected[i])) throw new SaveConflict();
        try { operation(); }
        finally { expected = read(); }
      });
    },
  };
}
