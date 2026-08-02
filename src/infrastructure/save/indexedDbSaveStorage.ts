import type {
  SaveSlotSnapshot,
  SaveStorage,
} from '../../application/save/saveStorage';

export const HH_FARM_SAVE_DATABASE_NAME = 'hh-farm-save';
const DATABASE_VERSION = 1;
const STORE_NAME = 'save-slots';
const CURRENT_KEY = 'current';
const PREVIOUS_KEY = 'previous';

export type SaveSlotName = 'current' | 'previous';

export class SaveStorageUnavailableError extends Error {
  public constructor(message = 'IndexedDB is unavailable.') {
    super(message);
    this.name = 'SaveStorageUnavailableError';
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed.')),
      { once: true },
    );
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () =>
        reject(
          transaction.error ?? new Error('IndexedDB transaction was aborted.'),
        ),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed.')),
      { once: true },
    );
  });
}

function defaultIndexedDbFactory(): IDBFactory | null {
  return typeof indexedDB === 'undefined' ? null : indexedDB;
}

function createUnknownRequest(
  store: IDBObjectStore,
  key: string,
): IDBRequest<unknown> {
  return store.get(key) as IDBRequest<unknown>;
}

export class IndexedDbSaveStorage implements SaveStorage {
  private readonly factory: IDBFactory | null;
  private readonly databaseName: string;

  public constructor(
    factory: IDBFactory | null = defaultIndexedDbFactory(),
    databaseName = HH_FARM_SAVE_DATABASE_NAME,
  ) {
    this.factory = factory;
    this.databaseName = databaseName;
  }

  public async readSlots(): Promise<SaveSlotSnapshot> {
    const database = await this.openDatabase();

    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const completed = transactionToPromise(transaction);
      const store = transaction.objectStore(STORE_NAME);
      const currentPromise = requestToPromise(
        createUnknownRequest(store, CURRENT_KEY),
      );
      const previousPromise = requestToPromise(
        createUnknownRequest(store, PREVIOUS_KEY),
      );
      const current = await currentPromise;
      const previous = await previousPromise;

      await completed;

      return {
        current: current ?? null,
        previous: previous ?? null,
      };
    } finally {
      database.close();
    }
  }

  public async commitCurrent(value: unknown): Promise<void> {
    const database = await this.openDatabase();

    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const completed = transactionToPromise(transaction);
      const store = transaction.objectStore(STORE_NAME);
      const currentRequest = createUnknownRequest(store, CURRENT_KEY);

      currentRequest.addEventListener(
        'success',
        () => {
          const current = currentRequest.result;

          if (current !== undefined) {
            store.put(current, PREVIOUS_KEY);
          }

          store.put(value, CURRENT_KEY);
        },
        { once: true },
      );

      await completed;
    } finally {
      database.close();
    }
  }

  public async clear(): Promise<void> {
    const database = await this.openDatabase();

    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const completed = transactionToPromise(transaction);
      transaction.objectStore(STORE_NAME).clear();
      await completed;
    } finally {
      database.close();
    }
  }

  public async writeRawSlotForDiagnostics(
    slot: SaveSlotName,
    value: unknown,
  ): Promise<void> {
    const database = await this.openDatabase();

    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const completed = transactionToPromise(transaction);
      transaction.objectStore(STORE_NAME).put(value, slot);
      await completed;
    } finally {
      database.close();
    }
  }

  public async deleteDatabase(): Promise<void> {
    const factory = this.requireFactory();
    await requestToPromise(factory.deleteDatabase(this.databaseName));
  }

  private requireFactory(): IDBFactory {
    if (this.factory === null) {
      throw new SaveStorageUnavailableError();
    }

    return this.factory;
  }

  private async openDatabase(): Promise<IDBDatabase> {
    const factory = this.requireFactory();
    const request = factory.open(this.databaseName, DATABASE_VERSION);

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    return requestToPromise(request);
  }
}
