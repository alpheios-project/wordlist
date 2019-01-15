/**
 * An interface to IndexedDB Storage
 */
export default class IndexedDBAdapter {

  /**
   * @param {String} domain the storage domain
   * @param {Object} dbDriver a driver for a specific data type
   */
  constructor (domain = 'alpheios-storage-domain', dbDriver) {
    super(domain)
    this.available = this._initIndexedDBNamespaces()
    this.dbDriver = dbDriver
  }

  /**
   * Create a new data item in the data base
   * @param {Object} data the data model item to be created
   * @return {Boolean} true if create succeeded false if not
   */
  async create(data) {
    let storageMap = this.dbDriver.storageMap
    // iterate through the declared segmentation of the object
    // and store accordingly
    // TODO we need transaction handling here
    Object.keys(storageMap).forEach(property) {
      let updated = await this.update(data, property)
      if (! updated) {
        break
        // TODO rollback?
      }
    }
    return updated > 0
  }

  /**
   * Clear the datastore of many items of a given type
   * @param {Object} params data type specific parameters for identifying the items
   *                        to be deleted
   * @return {int} number of items deleted
   *
   */
  async deleteMany(params) {
    let deleteCondition = this.dbDriver.deleteListCondition(params)
    return await this._deleteItem(deleteCondition)
  }

  /**
   * Remove a single item from the data store
   * @param {Object} data the deta model object to be deleted
   * @return {int} number of items deleted
   *
   */
  async deleteOne(data) {
    let deleteCondition = this.dbDriver.deleteOneCondition(data)
    return await this._deleteItem(deleteCondition)
  }

  /**
   * Update a data item, creating it if it doesn't exist
   * @param {Object} data the data model object to update
   * @param {String} segment if only a particular segment needs to be updated,
   *                         it can be specified here
   * @return {Boolean} true if update succeeded false if not
   */
  async update (data, segment) {
    let storageMap = this.dbDriver.storageMap
    let segments = [segment]
    let result
    if (segments.length === 0)  {
      segments = Object.values(this.dbDriver.storageMap)
    }
    for (let s of segements) {
      let dataItems = []
      let resDataItem = dbDriver[storageMap[property].convertMethodName](data)
      if (!Array.isArray(resDataItem)) {
        dataItems.push(resDataItem)
      } else {
        dataItems = dataItems.concat(resDataItem)
      }
      try {
        return await this._set({
          objectStoreName: storageMap[property].objectStoreName,
          dataItems: dataItems
        })
      } catch(error e) {
        // TODO need transaction rollback handling here if mulitple segments?
        return false
      }
    }
    return result
  }

  /**
   * Query for a set of data items
   * @param {Object} params datatype specific query parameters
   * @return Object[] array of data model items
   */
  async query(params) {
    let listQuery = this.dbDriver.listQuery(params)
    let storageMap = this.dbDriver.storageMap
    let res = await this._getFromStore(listQuery)
    let items = []
    if (res.length > 0) {
      for (let item of res) {
        let modelObj = this.dbDriver.create(item)
        Object.keys(storageMap).forEach(property) {
          if (storageMap[property].uploadMethodName) {
            let res = await this._getFromStore({
              objectStoreName: storageMap[property].objectStoreName,
              condition: {indexName: 'listID', value: id, type: 'only' }
            })
            if (res.length > 0) {
              for (let item of res) {
                dbDriver[storageMap[property].uploadMethodName](modelObj,item)
              }
            }
          }
        }
        items.push(modelObj)
      }
    }
    return items
  }


  /**
   * This method checks if IndexedDB is used in the current browser
   */
  _initIndexedDBNamespaces () {
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
   * utility method ot open a database. Sets a callback which causes the database to be created if it doesn't exist
   */
  _openDatabaseRequest () {
    let request = this.indexedDB.open(this.dbDriver.dbName, this.dbDriver.dbVersion)
    // TODO - will onupgradeneeded be called if the database doesn't exist? Is this how it gets created?
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      const upgradeTransaction = event.target.transaction
      this._createObjectStores(db, upgradeTransaction)
    }
    return request
  }

  /**
   * Iniitalize the object store(s) for for an IndexedDb adapter
   */
  _createObjectStores (db, upgradeTransaction) {
    let objectStores = this.dbDriver.objectStores
    Object.keys(objectStores).forEach(objectStoreName => {
      const objectStoreStructure = this.dbDriver.objectStores[objectStoreName]

      let objectStore
      if (!db.objectStoreNames.contains(objectStoreName)) {
        objectStore = db.createObjectStore(objectStoreName, { keyPath: objectStoreStructure.keyPath })
      } else {
        objectStore = upgradeTransaction.objectStore(objectStoreName)
      }
      objectStoreStructure.indexes.forEach(index => {
        if (!objectStore.indexNames.contains(index.indexName)) {
          objectStore.createIndex(index.indexName, index.keyPath, { unique: index.unique })
        }
      })
    })
  }

  /**
   * Internal method to open a database and update one or items in a specific store
   * @param {Object} data data item to be updated  in the format
   *                      { objectStoreName: name of the object store,
   *                        dataItems: array of data items to be updated }
   * @return {Promise} resolves to true on success
   */
  async _set (data) {
    let promiseOpenDB = await new Promise((resolve, reject) => {
      let request = this._openDatabaseRequest()
      request.onsuccess = async (event) => {
        const db = event.target.result
        let rv = await this._putItem(db, data)
        resolve(rv)
      }
      request.onerror = (event) => {
        reject()
      }
    })
    return promiseOpenDB
  }

  /**
   * Internal method to put an item into a database
   * @param {} db the database handle
   * @param {Object} data data item to be updated  in the format
   *                      { objectStoreName: name of the object store,
   *                        dataItems: array of data items to be updated }
   * @return {Promise} resolves to true on success
   */
  async _putItem (db, data) {
    let promisePut = await new Promise((resolve, reject) => {
      const transaction = db.transaction([data.objectStoreName], 'readwrite')
      transaction.onerror = (event) => {
        reject()
      }
      const objectStore = transaction.objectStore(data.objectStoreName)
      let objectsDone = data.dataItems.length
      // console.info('************************data.dataItems', data.dataItems)
      for (let dataItem of data.dataItems) {
        // console.info('************************dataItem', dataItem)
        const requestPut = objectStore.put(dataItem)
        requestPut.onsuccess = () => {
          objectsDone = objectsDone - 1
          if (objectsDone === 0) {
            resolve(true)
          }
        }
        requestPut.onerror = () => {
          reject()
        }
      }
    })
    return promisePut
  }

  /**
   * Internal method to get an item from a database store
   * @param {Object} data data item to be retrieved  in the format
   *                      { objectStoreName: name of the object store,
   *                        condition: query parameters }
   * @return {Promise} resolves to the retrieved items
   */
  async _getFromStore (data) {
    let promiseOpenDB = await new Promise((resolve, reject) => {
      let request = this._openDatabaseRequest()
      request.onsuccess = (event) => {
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
          reject()
        }
      }
      request.onerror = (event) => {
        reject()
      }
    })
    return promiseOpenDB
  }

  /**
   * Internal method to delete an item from the database
   * @param {Object} condition query parameters to identify the item to be deleted
   * @return {Promise} resolves to the number of deleted items
   */
  async _deleteItem (condition) {
    for (let objectStoreData of Object.values(this.dbDriver.storageMap)) {
      await this._deleteFromStore({
        objectStoreName: objectStoreData.objectStoreName,
        condition: condition
      })
    }
  }

  /**
   * Internal method to delete an item from  a specific data store
   * @param {Object} data data item to be retrieved  in the format
   *                      { objectStoreName: name of the object store,
   *                        condition: query parameters }
   * @return {Promise} resolves to the number of deleted items
   */
  async _deleteFromStore (data) {
    let promiseOpenDB = await new Promise((resolve, reject) => {
      let request = this._openDatabaseRequest()
      request.onsuccess = (event) => {
        const db = event.target.result
        const transaction = db.transaction([data.objectStoreName], 'readwrite')
        const objectStore = transaction.objectStore(data.objectStoreName)

        const index = objectStore.index(data.condition.indexName)
        const keyRange = this.IDBKeyRange[data.condition.type](data.condition.value)

        let requestOpenCursor = index.openCursor(keyRange)
        requestOpenCursor.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor) {
            const requestDelete = cursor.delete()
            requestDelete.onerror = (event) => {
              reject()
            }
            cursor.continue()
          } else {
            // TODO I want to return the number of items deleted here
            resolve()
          }
        }
      }

      request.onerror = (event) => {
        reject()
      }
    })

    return promiseOpenDB
  }

}