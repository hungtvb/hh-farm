import type {
  SaveSlotSnapshot,
  SaveStorage,
} from '../../application/save/saveStorage';

export const HH_FARM_SAVE_DATABASE_NAME = 'hh-farm-save';
export const HH_FARM_SAVE_STORE_NAME = 'save-slots';
export const HH_FARM_CURRENT_SAVE_KEY = 'current';
export const HH_FARM_PREVIOUS_SAVE_KEY = 'previous';
const DATABASE_VERSION = 1;

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
      const transaction = database.transaction(
        HH_FARM_SAVE_STORE_NAME,
        'readonly',
      );
      const completed = transactionToPromise(transaction);
      const store = transaction.objectStore(HH_FARM_SAVE_STORE_NAME);
      const currentPromise = requestToPromise(
        createUnknownRequest(store, HH_FARM_CURRENT_SAVE_KEY),
      );
      const previousPromise = requestToPromise(
        createUnknownRequest(store, HH_FARM_PREVIOUS_SAVE_KEY),
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
      const transaction = database.transaction(
        HH_FARM_SAVE_STORE_NAME,
        'readwrite',
      );
      const completed = transactionToPromise(transaction);
      const store = transaction.objectStore(HH_FARM_SAVE_STORE_NAME);
      const currentRequest = createUnknownRequest(
        store,
        HH_FARM_CURRENT_SAVE_KEY,
      );

      currentRequest.addEventListener(
        'success',
        () => {
          const current = currentRequest.result;

          if (current !== undefined) {
            store.put(current, HH_FARM_PREVIOUS_SAVE_KEY);
          }

          store.put(value, HH_FARM_CURRENT_SAVE_KEY);
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
      const transaction = database.transaction(
        HH_FARM_SAVE_STORE_NAME,
        'readwrite',
      );
      const completed = transactionToPromise(transaction);
      transaction.objectStore(HH_FARM_SAVE_STORE_NAME).clear();
      await completed;
    } finally {
      database.close();
    }
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

      if (!database.objectStoreNames.contains(HH_FARM_SAVE_STORE_NAME)) {
        database.createObjectStore(HH_FARM_SAVE_STORE_NAME);
      }
    });

    return requestToPromise(request);
  }
}
