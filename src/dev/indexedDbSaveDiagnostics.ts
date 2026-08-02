import {
  HH_FARM_CURRENT_SAVE_KEY,
  HH_FARM_PREVIOUS_SAVE_KEY,
  HH_FARM_SAVE_DATABASE_NAME,
  HH_FARM_SAVE_STORE_NAME,
} from '../infrastructure/save/indexedDbSaveStorage';

export type DiagnosticSaveSlot = 'current' | 'previous';

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () =>
        reject(
          transaction.error ??
            new Error('Diagnostic IndexedDB transaction was aborted.'),
        ),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () =>
        reject(
          transaction.error ??
            new Error('Diagnostic IndexedDB transaction failed.'),
        ),
      { once: true },
    );
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HH_FARM_SAVE_DATABASE_NAME, 1);

    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      'error',
      () =>
        reject(
          request.error ?? new Error('Diagnostic IndexedDB open failed.'),
        ),
      { once: true },
    );
  });
}

export async function writeRawSaveSlotForDiagnostics(
  slot: DiagnosticSaveSlot,
  value: unknown,
): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(
      HH_FARM_SAVE_STORE_NAME,
      'readwrite',
    );
    const completed = transactionToPromise(transaction);
    const key =
      slot === 'current'
        ? HH_FARM_CURRENT_SAVE_KEY
        : HH_FARM_PREVIOUS_SAVE_KEY;
    transaction.objectStore(HH_FARM_SAVE_STORE_NAME).put(value, key);
    await completed;
  } finally {
    database.close();
  }
}
