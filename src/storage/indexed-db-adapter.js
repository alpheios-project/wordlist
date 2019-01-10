import StorageAdapter from '@/storage/storage-adapter.js'
import IndexedDBStructure from '@/storage/indexed-db-structure.js'

/**
 * An implementation of a StorageAdapter interface for a local storage.
 */
export default class IndexedDBAdapter extends StorageAdapter {
  
  constructor (domain = 'alpheios-storage-domain') {
    super(domain)

    this.available = this.initIndexedDBNamespaces()
    this.dbData = new IndexedDBStructure()
  }

  /**
   * This method checks if IndexedDB is used in the current browser
   */
  initIndexedDBNamespaces () {
    this.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    this.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"}; // This line should only be needed if it is needed to support the object's constants for older browsers
    this.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
    if (!this.indexedDB) {
      console.info("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
      return false
    }
    return true
  }

  /**
   * This method create a request for opening database and passes callbacks for two events
   */
  openDatabase (upgradeCallback, successCallback) {
    let request = this.indexedDB.open(this.dbName, this.currentVersion)
    request.onerror = (event) => {
      console.info('*************Some problems with opening LabirintOrders', event.target)
    }
    request.onsuccess = successCallback
    request.onupgradeneeded = upgradeCallback
    return request
  }

  async set (data) {
    // console.info('***************indexedDB set', data)
    let promiseOpenDB = await new Promise((resolve, reject) => {
      let request = this.indexedDB.open(this.dbData.dbName, this.dbData.dbVersion)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        this.dbData.createObjectStores(db)
        // console.info('*****************indexedDB set in onupgradeneeded', db)
      }
      request.onsuccess = async (event) => {
        const db = event.target.result
        await this.putItem(db, data)
        // console.info('*****************indexedDB set in onsuccess', db)
        resolve()
      }
      request.onerror = (event) => {
        // console.info('*************indexedDB set in onerror', event.target)
        reject()
      }
    })
    console.info('*****************final indexedDB set', data.dataItem)
    return promiseOpenDB
  }

  async putItem (db, data) {
    // console.info('********************putItem', data.objectStoreName, data)
    let promisePut = await new Promise((resolve, reject) => {
      const transaction = db.transaction([data.objectStoreName], 'readwrite')
      transaction.onerror = (event) => {
        reject()
      }
      const objectStore = transaction.objectStore(data.objectStoreName)
      const requestPut = objectStore.put(data.dataItem)
      requestPut.onsuccess = (event) => {
        // console.info('**********************requestPut success', data.dataItem)
        resolve()
      }
      requestPut.onerror = (event) => {
        // console.info('**********************requestPut error', event.target)
        reject()
      }
    })
    // console.info('*****************final indexedDB putItem', data.dataItem)
    return promisePut
  }

  async get (data) {
    let promiseOpenDB = await new Promise((resolve, reject) => {
      let request = this.indexedDB.open(this.dbData.dbName, this.dbData.dbVersion)
      request.onsuccess = async (event) => {
        const db = event.target.result
        const transaction = db.transaction([data.objectStoreName])
        const objectStore = transaction.objectStore(data.objectStoreName)

        const index = objectStore.index(data.condition.indexName)
        const keyRange = this.IDBKeyRange[data.condition.type](data.condition.value)

        const requestOpenCursor = index.getAll(keyRange, 0)
        requestOpenCursor.onsuccess = (event) => {
          resolve(event.target.result)
        }

        requestOpenCursor.onerror = (event) => {
          console.info('****************cursor with condition - some error', event.target)
          reject()
        }        
      }
      request.onerror = (event) => {
        // console.info('*************indexedDB set in onerror', event.target)
        reject()
      }
    })
    // console.info('*****************final indexedDB get', data.condition)
    return promiseOpenDB
  }
  /**
   * This method create a request for put data to the selected ObjectStore
   * and executes onComplete callback on success
   * It creates transaction with readwrite access (onComplete callback would be executes on transaction finalize)
   * And then it goes through data Array and executes put request (put allows adding data and rewriting existing data by keyValue)
   */
  set_backup (db, objectStoreName, data, onCompleteF) {
    const transaction = db.transaction([objectStoreName], 'readwrite')
    transaction.oncomplete = (event) => {
      // console.info('**************set data successfull')
      if (onCompleteF) {
        onCompleteF()
      }
    }
    transaction.onerror = (event) => {
        console.info('**************testData onerror')
    }
    const objectStore = transaction.objectStore(objectStoreName);
    data.forEach(dataItem => {
      const requestPut = objectStore.put(dataItem)
      requestPut.onsuccess = (event) => {
        // console.info('****************wordlist added successful', event.target.result)
      }
      requestPut.onerror = (event) => {
        console.info('****************wordlist error with adding data', event.target)
      }
    })
  }

  /**
   * This method creates a request for getting data from table
   * it creates transaction and executes one of the methods - getWithCondition or getWithoutConditions
   * (depending on passed condition argument)
   * callback function is passed to final get request
   */
  get_backup (db, objectStoreName, condition, callbackF) {
    const transaction = db.transaction([objectStoreName])
    const objectStore = transaction.objectStore(objectStoreName)

    if (this.hasProperCondition(condition)) {
      this.getWithCondition(objectStore, condition, callbackF)
    } else {
      console.info('There is not enough information for creating index condition')
      this.getWithoutConditions(objectStore, callbackF)
    }
  }

    /**
   * This method checks if condition is correct
   * I have limited here for 'only' compare method because I am using only it, but it could be upgraded later
   */
  hasProperCondition_backup (condition) {
    const allowedTypes = [ 'only' ]
    return condition.indexName && condition.value && condition.type && allowedTypes.includes(condition.type)
  }

  /**
   * This method gets all data from the table without any filtering
   * I don't use this method in the code, but it could be useful later
   */
  getWithoutConditions_backup (objectStore, callbackF) {
    const requestOpenCursor = objectStore.openCursor(null)
    requestOpenCursor.onsuccess = (event) => {
      callbackF(event.target.result)
    }
    requestOpenCursor.onerror = (event) => {
      console.info('****************cursor without condition - some error', event.target)
    }
  }

  /**
   * This method gets data with filtering condition
   * I use IDBKeyRange for filtering, so it looks like this for example
   *     this.IDBKeyRange.only('userIDTest-lat')
   * where IDBKeyRange is defined with userIDLangCode index
   * so it gets all wordItems for latin wordList for the current user
   * and success callback it passes retrieved data using callback function, for example WordlistController.parseResultToWordList
   */
  getWithCondition_backup (objectStore, condition, callbackF) {
    const index = objectStore.index(condition.indexName)
    const keyRange = this.IDBKeyRange[condition.type](condition.value)

    const requestOpenCursor = index.getAll(keyRange, 0)
    requestOpenCursor.onsuccess = (event) => {
      callbackF(event.target.result)
    }

    requestOpenCursor.onerror = (event) => {
      console.info('****************cursor with condition - some error', event.target)
    }
  }

  /**
   * This method create a request for delete data from the selected ObjectStore
   * and executes onComplete callback on success
   * It creates transaction with readwrire access (onComplete callback would be executes on transaction finalize)
   * And then it goes through data Array and executes put request (put allows adding data and rewriting existing data by keyValue)
   */
  delete (db, objectStoreName, data, onCompleteF) {
    console.info('*****************delete method', data)
    const transaction = db.transaction([objectStoreName], 'readwrite')
    transaction.oncomplete = (event) => {
      console.info('**************delete data successfull')
      if (onCompleteF) {
        onCompleteF()
      }
    }
    transaction.onerror = (event) => {
        console.info('**************testData onerror')
    }
    const objectStore = transaction.objectStore(objectStoreName);
    data.forEach(dataItem => {
      const requestPut = objectStore.delete(dataItem)
      requestPut.onsuccess = (event) => {
        console.info('****************worditem was deleted', event.target.result)
      }
      requestPut.onerror = (event) => {
        console.info('****************wordlist error with deleting data', event.target)
      }
    })
  }
}