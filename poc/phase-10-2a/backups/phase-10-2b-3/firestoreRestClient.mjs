/**
 * Phase 10.2B-1: Cloud Firestore REST API Client with Write Preconditions
 * 
 * Implements Google Cloud Firestore REST API v1 using pure fetch.
 * Supports:
 * - ACID Transactions (:beginTransaction, :commit, :rollback)
 * - Strict Write Preconditions (currentDocument: { exists: false } for creation)
 * - Distinction between creates and updates
 * - ALREADY_EXISTS (409) and FAILED_PRECONDITION (412) error handling
 * - Automatic exponential backoff retry exclusively on HTTP 409 ABORTED conflicts
 */

/**
 * Encodes a JavaScript value to a Firestore REST API Value object
 */
export function encodeValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(encodeValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Decodes a Firestore REST API Value object to a native JavaScript value
 */
export function decodeValue(valObj) {
  if (!valObj || typeof valObj !== 'object') return null;

  if ('nullValue' in valObj) return null;
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return valObj.doubleValue;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('timestampValue' in valObj) return new Date(valObj.timestampValue);
  if ('arrayValue' in valObj) {
    const arr = valObj.arrayValue.values || [];
    return arr.map(decodeValue);
  }
  if ('mapValue' in valObj) {
    const result = {};
    const fields = valObj.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = decodeValue(v);
    }
    return result;
  }
  return null;
}

export function encodeDocument(fieldsObj) {
  const fields = {};
  for (const [k, v] of Object.entries(fieldsObj)) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return { fields };
}

export function decodeDocument(docObj) {
  if (!docObj || !docObj.fields) return null;
  const result = {};
  for (const [k, v] of Object.entries(docObj.fields)) {
    result[k] = decodeValue(v);
  }
  return result;
}

export class FirestoreRestClient {
  constructor(projectId, tokenProvider, options = {}) {
    this.projectId = projectId;
    this.tokenProvider = tokenProvider;
    this.databaseId = options.databaseId || '(default)';
    this.fetchImpl = options.fetchImpl || fetch;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async _getHeaders() {
    const { token } = await this.tokenProvider();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Begins a new transaction
   */
  async beginTransaction(options = { readWrite: {} }) {
    const headers = await this._getHeaders();
    const url = `${this.baseUrl}:beginTransaction`;

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ options })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`beginTransaction failed [HTTP ${res.status}]: ${errText}`);
    }

    const data = await res.json();
    return data.transaction; // Base64 transaction identifier
  }

  /**
   * Reads a single document, optionally within a transaction
   */
  async getDocument(collectionPath, docId, transactionId = null) {
    const headers = await this._getHeaders();
    let url = `${this.baseUrl}/${collectionPath}/${docId}`;
    if (transactionId) {
      url += `?transaction=${encodeURIComponent(transactionId)}`;
    }

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers
    });

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`getDocument failed [HTTP ${res.status}]: ${errText}`);
    }

    const docObj = await res.json();
    return {
      id: docId,
      path: docObj.name,
      data: decodeDocument(docObj),
      createTime: docObj.createTime,
      updateTime: docObj.updateTime
    };
  }

  /**
   * Batch reads multiple documents within a transaction
   */
  async batchGetDocuments(documentPaths, transactionId = null) {
    const headers = await this._getHeaders();
    const url = `${this.baseUrl}:batchGet`;

    const body = {
      documents: documentPaths.map(p => {
        if (p.startsWith('projects/')) return p;
        return `projects/${this.projectId}/databases/${this.databaseId}/documents/${p}`;
      })
    };
    if (transactionId) {
      body.transaction = transactionId;
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`batchGet failed [HTTP ${res.status}]: ${errText}`);
    }

    const results = await res.json();
    return results.map(item => {
      if (item.found) {
        return {
          found: true,
          path: item.found.name,
          data: decodeDocument(item.found),
          updateTime: item.found.updateTime
        };
      }
      return { found: false, missing: item.missing };
    });
  }

  /**
   * Commits an array of writes atomically, optionally inside a transaction
   */
  async commit(writes, transactionId = null) {
    const headers = await this._getHeaders();
    const url = `${this.baseUrl}:commit`;

    const body = { writes };
    if (transactionId) {
      body.transaction = transactionId;
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (res.status === 409) {
      const errText = await res.text();
      let errCode = 'ABORTED';
      if (errText.includes('ALREADY_EXISTS') || errText.toLowerCase().includes('already exists')) {
        errCode = 'ALREADY_EXISTS';
      }
      const err = new Error(`Transaction failed [HTTP 409]: ${errText}`);
      err.code = errCode;
      err.status = 409;
      throw err;
    }

    if (res.status === 412) {
      const errText = await res.text();
      let errCode = 'FAILED_PRECONDITION';
      if (errText.includes('ALREADY_EXISTS') || errText.toLowerCase().includes('already exists')) {
        errCode = 'ALREADY_EXISTS';
      }
      const err = new Error(`Precondition failed [HTTP 412]: ${errText}`);
      err.code = errCode;
      err.status = 412;
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`commit failed [HTTP ${res.status}]: ${errText}`);
    }

    return await res.json();
  }

  /**
   * Rolls back an open transaction
   */
  async rollback(transactionId) {
    const headers = await this._getHeaders();
    const url = `${this.baseUrl}:rollback`;

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transaction: transactionId })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`rollback failed [HTTP ${res.status}]: ${errText}`);
    }
  }

  /**
   * Creates an INSERT write payload with strict currentDocument: { exists: false } precondition
   * Ensures that document creation NEVER accidentally overwrites an existing document.
   */
  createInsertWrite(collectionPath, docId, data) {
    const fullPath = `projects/${this.projectId}/databases/${this.databaseId}/documents/${collectionPath}/${docId}`;
    const encoded = encodeDocument(data);

    return {
      update: {
        name: fullPath,
        fields: encoded.fields
      },
      currentDocument: {
        exists: false
      }
    };
  }

  /**
   * Creates an UPDATE write payload
   * Optionally applies currentDocument precondition (e.g. exists: true, or updateTime)
   */
  createUpdateWrite(collectionPath, docId, data, updateMaskFields = null, precondition = null) {
    const fullPath = `projects/${this.projectId}/databases/${this.databaseId}/documents/${collectionPath}/${docId}`;
    const encoded = encodeDocument(data);

    const write = {
      update: {
        name: fullPath,
        fields: encoded.fields
      }
    };

    if (updateMaskFields && updateMaskFields.length > 0) {
      write.updateMask = { fieldPaths: updateMaskFields };
    }

    if (precondition) {
      write.currentDocument = precondition;
    }

    return write;
  }

  /**
   * Runs a complete read-validate-write ACID transaction with bounded automated retry
   */
  async runTransaction(updateFunction, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      let txId = null;
      try {
        txId = await this.beginTransaction();
        const txContext = {
          get: async (collectionPath, docId) => {
            return await this.getDocument(collectionPath, docId, txId);
          },
          writes: [],
          // Strict creation with exists: false precondition
          create: (collectionPath, docId, data) => {
            txContext.writes.push(this.createInsertWrite(collectionPath, docId, data));
          },
          // Standard update with optional mask and precondition
          update: (collectionPath, docId, data, updateMask = null, precondition = null) => {
            txContext.writes.push(this.createUpdateWrite(collectionPath, docId, data, updateMask, precondition));
          },
          // Flexible set: if createOnly is true, enforces exists: false
          set: (collectionPath, docId, data, options = {}) => {
            if (options.createOnly) {
              txContext.writes.push(this.createInsertWrite(collectionPath, docId, data));
            } else {
              txContext.writes.push(this.createUpdateWrite(collectionPath, docId, data, null, options.precondition || null));
            }
          }
        };

        const userResult = await updateFunction(txContext);
        await this.commit(txContext.writes, txId);
        return userResult;
      } catch (err) {
        if (txId) {
          try {
            await this.rollback(txId);
          } catch (_) {
            // Ignore rollback errors on failed transactions
          }
        }
        // ONLY retry on ABORTED concurrency conflicts.
        // Never retry ALREADY_EXISTS, FAILED_PRECONDITION, or business rule validation errors!
        if (err.code === 'ABORTED' && attempt < maxRetries) {
          // Exponential backoff with jitter (50ms - 150ms)
          const delay = Math.floor(Math.random() * 50) + (attempt * 50);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }
}
