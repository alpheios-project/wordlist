import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter.js'
import RemoteDBAdapter from '@/storage/remote-db-adapter.js'
export default class UserDataManager {

  /**
   * Creates with userID argument, subscribe to WordItem and WorList events, inits blocked property and request queue
   * @param {String} userID - userID that would be used for access to remote storage
   * @param {String} events - events object of the WordlistController, passed in UIController
   */
  constructor (userID, events) {
    this.userID = userID
    if (events) {
      events.WORDITEM_UPDATED.sub(this.update.bind(this))
      events.WORDITEM_DELETED.sub(this.delete.bind(this))
      events.WORDLIST_DELETED.sub(this.deleteMany.bind(this))
    }
    this.blocked = false
    this.requestsQueue = []
  }

  /**
   * Initializes IndexedDBAdapter with appropriate local dbDriver (WordItemIndexedDbDriver) 
   * @param {String} dataType - data type for choosing a proper dbDriver (WordItem)
   * @return {IndexedDBAdapter}
   */
  _localStorageAdapter(dataType) {
    let dbDriver = new UserDataManager.LOCAL_DRIVER_CLASSES[dataType](this.userID)
    return new IndexedDBAdapter(dbDriver)
  }

  /**
   * Initializes RemoteDBAdapter with appropriate remote dbDriver (WordItemRemoteDbDriver) 
   * @param {String} dataType - data type for choosing a proper dbDriver (WordItem)
   * @return {RemoteDBAdapter}
   */
  _remoteStorageAdapter(dataType) {
    let dbDriver = new UserDataManager.REMOTE_DRIVER_CLASSES[dataType](this.userID)
    return new RemoteDBAdapter(dbDriver)
  }

  /**
   * Checks and formats Class name (if neccessary) to a normal state (after uglifying pugins)
   * @param {String} sourceConstrName recieved class name
   * @return {String} formatted class name
   */

  defineConstructorName (sourceConstrName) {
    let firstLetter = sourceConstrName.substr(0,1)
    let finalConstrName

    if (firstLetter == firstLetter.toUpperCase()) {
      finalConstrName = sourceConstrName
    } else {
      let removed = sourceConstrName.split('_').length-1
      let classNameStart = sourceConstrName.replace('_', '').toLowerCase().length/2
      finalConstrName = sourceConstrName.substr(-(classNameStart+removed-2))
    }
    return finalConstrName
  }

  /**
   * Promise-based method - creates a new object in local/remote storage
   * uses blocking workflow: 
   *       at the starting of the method it checks if some data method (create, update, delete) is already using DB
   *         if it is bocked, it pushes params to queue
   *         if it is unblocked, it blocks, starts the data manipulation process and at the end
   *            it removes blocking and checks the queue
   * @param {Object} data
   * @param {WordItem} data.dataObj - object for saving to local/remote storage
   * @param {Object} [params={}] - could have the following additional parameters
   *                                 onlyLocal - it creates data only in local DB
   *                                 onlyRemote - it creates data only in remote DB
   *                               if there are no parameters it creates both in local, remote
   * @return {Boolean} true if created successful, false if not
   * @return {RemoteDBAdapter}
   */
  async create(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'create',
        data: data
      })
      return
    }
    try {
      this.blocked = true
      let finalConstrName = this.defineConstructorName(data.dataObj.constructor.name)

      let localAdapter = this._localStorageAdapter(finalConstrName)
      let remoteAdapter = this._remoteStorageAdapter(finalConstrName)

      let createdLocal = false
      let createdRemote = false

      if (this.checkAdapters(localAdapter, remoteAdapter, params)) {
        let newDataObj = data.dataObj
        
        if (params.onlyLocal) {
          createdLocal = await this.compareAndSaveAdapter(localAdapter, newDataObj)
          createdRemote = true
        } else if (params.onlyRemote) {
          createdRemote = await this.compareAndSaveAdapter(remoteAdapter, newDataObj)
          createdLocal = true
        } else {
          if (localAdapter.available && remoteAdapter.available) {
            let res = await this.compareAndSaveBothAdapter(localAdapter, remoteAdapter, newDataObj)
            createdLocal = res[0]
            createdRemote = res[1]
          }
        }
        this.printErrors(localAdapter)
        this.printErrors(remoteAdapter)  
      }

      this.blocked = false
      this.checkRequestQueue()

      return createdLocal && createdRemote
    } catch (error) {
      console.error('Some errors happen on creating data in IndexedDB or RemoteDBAdapter', error.message)
    }    
  }

  checkAdapters (localAdapter, remoteAdapter, params) {
    let localCheck = false
    let remoteCheck = false

    if (params.onlyRemote) {
      localCheck = true
      remoteCheck = remoteAdapter.available
    } else if (params.onlyLocale) {
      localCheck = localAdapter.available
      remoteCheck = true
    } else {
      localCheck = localAdapter.available
      remoteCheck = remoteAdapter.available
      if (!localAdapter.available) {
        this.printErrorAdapterUnvailable(localAdapter)
      }
      if (!remoteAdapter.available) {
        this.printErrorAdapterUnvailable(remoteAdapter)
      }
    }

    return localCheck && remoteCheck
  }

  async compareAndSaveAdapter (adapter, newDataObj) {
    try {
      // console.info('*****compareAndSaveAdapter start')
      let currentItems = await adapter.query({ wordItem: newDataObj })
      // console.info('*****compareAndSaveAdapter', currentItems)
      let finalNewDataObj = newDataObj

      if (currentItems.length > 0) {
        finalNewDataObj = adapter.dbDriver.comparePartly(currentItems[0], newDataObj)
        // console.info('*****compareAndSaveAdapter finalNewDataObj', finalNewDataObj)
        // console.info('*****compareAndSaveAdapter adapter', adapter.constructor.name)
        return await adapter.update(finalNewDataObj)
      } else {
        return await adapter.create(finalNewDataObj)
      }
    } catch (error) {
      console.error('Some errors happen on compareAndSaveAdapter with ${adapter.constructor.name}', error.message)
      return false
    }
  }

  async compareAndSaveBothAdapter (localAdapter, remoteAdapter, newDataObj) {
    // console.info('*****compareAndSaveBothAdapter start')
    let currentLocal = await localAdapter.query({ wordItem: newDataObj })
    let currentRemote = await remoteAdapter.query({ wordItem: newDataObj })

    // console.info('*****compareAndSaveBothAdapter currentLocal', currentLocal)
    // console.info('*****compareAndSaveBothAdapter currentRemote', currentRemote)

    let finalNewDataObj = newDataObj
    let createdLocal, createdRemote

    if (currentLocal.length > 0 && currentRemote.length === 0) {
      
      finalNewDataObj = localAdapter.dbDriver.comparePartly(currentLocal[0], newDataObj)
      createdRemote = await remoteAdapter.create(finalNewDataObj)
      createdLocal = await localAdapter.update(finalNewDataObj)

    } else if (currentLocal.length === 0 && currentRemote.length > 0) {
      // console.info('*****compareAndSaveBothAdapter adapterN1 1', currentRemote[0].context)
      // console.info('*****compareAndSaveBothAdapter adapterN1 1', currentRemote[0].context[0].target)
      // console.info('*****compareAndSaveBothAdapter adapterN1 2', newDataObj.context)

      finalNewDataObj = remoteAdapter.dbDriver.comparePartly(currentRemote[0], newDataObj)

      // console.info('*****compareAndSaveBothAdapter adapterN1 3-1', finalNewDataObj)
      // console.info('*****compareAndSaveBothAdapter adapterN1 3-2', finalNewDataObj.context[0].target)

      createdRemote = await remoteAdapter.update(finalNewDataObj)

      // console.info('*****compareAndSaveBothAdapter adapterN1 4 createdRemote', createdRemote)

      let finalNewWordItem = localAdapter.dbDriver.createFromRemoteData(finalNewDataObj)

      createdLocal = await localAdapter.create(finalNewWordItem)
      // console.info('*****compareAndSaveBothAdapter adapterN1 4 createdLocal', createdLocal)

    } else if (currentLocal.length > 0 && currentRemote.length > 0) {
      // console.info('*****compareAndSaveBothAdapter adapter1', currentLocal[0].context)
      // console.info('*****compareAndSaveBothAdapter adapter1', currentRemote[0].context)

      let mergedObject = localAdapter.dbDriver.comparePartly(currentLocal[0], currentRemote[0])
      // console.info('*****compareAndSaveBothAdapter adapter2', mergedObject.context)
      
      finalNewDataObj = localAdapter.dbDriver.comparePartly(mergedObject, newDataObj)
      // console.info('*****compareAndSaveBothAdapter adapter3', finalNewDataObj.context)

      createdRemote = await remoteAdapter.update(finalNewDataObj)
      createdLocal = await localAdapter.update(finalNewDataObj)

    } else {
      createdLocal = await localAdapter.create(newDataObj)
      createdRemote = await remoteAdapter.create(newDataObj)
    }
    return [createdLocal, createdRemote]
  }

  printErrorAdapterUnvailable(adapter) {
    console.error(`Adapter is not available - ${adapter.constructor.name}`)
  }

  /**
   * Promise-based method - updates object in local/remote storage
   * uses blocking workflow: 
   * @param {Object} data
   * @param {WordItem} data.dataObj - object for saving to local/remote storage
   * @param {Object} [params={}] - the same as in create method
   * @return {Boolean} true if updated successful, false if not
   */
  async update(data, params = {}) {
    this.create(data, params)
  }

  /**
   * Promise-based method - deletes single object in local/remote storage
   * uses blocking workflow: 
   * @param {Object} data
   * @param {WordItem} data.dataObj - object for saving to local/remote storage
   * @param {Object} [params={}] - the same as in create method
   * @return {Boolean} true if deleted successful, false if not
   */
  async delete(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'delete',
        data: data
      })
      return
    }
    try {
      this.blocked = true
      let finalConstrName = this.defineConstructorName(data.dataObj.constructor.name)

      let localAdapter = this._localStorageAdapter(finalConstrName)
      let remoteAdapter = this._remoteStorageAdapter(finalConstrName)

      let deletedLocal, deletedRemote

      if (localAdapter.available && !params.onlyRemote) {
        deletedLocal = await localAdapter.deleteOne(data.dataObj)
        this.printErrors(localAdapter)
      } else if (params.onlyRemote) {
        deletedLocal = true
      } else {
        console.error('LocalAdapter is not available for usage')
      }

      if (remoteAdapter.available && !params.onlyLocal) {
        deletedRemote = await remoteAdapter.deleteOne(data.dataObj)
        this.printErrors(remoteAdapter)
      } else if (params.onlyLocal) {
        deletedRemote = true
      } else {
        console.error('RemoteAdapter is not available for usage')
      }    
      
      this.blocked = false

      this.checkRequestQueue()
      
      return deletedLocal && deletedRemote
    } catch (error) {
      console.error('Some errors happen on deleting data from IndexedDB', error.message)
    }
  }

  /**
   * Promise-based method - deletes all objects from the wordlist by languageCode in local/remote storage
   * uses blocking workflow: 
   * @param {Object} data
   * @param {String} data.languageCode - languageCode of Wordlist to be deleted
   * @param {Object} [params={}] - the same as in create method
   * @return {Boolean} true if deleted successful, false if not
   */
  async deleteMany(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'deleteMany',
        data: data
      })
      return
    }
    try {
      this.blocked = true

      let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
      let localAdapter = this._localStorageAdapter(data.dataType)

      let deletedLocal, deletedRemote

      if (localAdapter.available && !params.onlyRemote) {
        deletedLocal = await localAdapter.deleteMany(data.params)
        this.printErrors(localAdapter)
      } else if (params.onlyRemote) {
        deletedLocal = true
      } else {
        console.error('LocalAdapter is not available for usage')
      }

      if (remoteAdapter.available && !params.onlyLocal) {
        deletedRemote = await remoteAdapter.deleteMany(data.params)
        this.printErrors(remoteAdapter)
      } else if (params.onlyLocal) {
        deletedRemote = true
      } else {
        console.error('RemoteAdapter is not available for usage')
      }    
    
      this.blocked = false
      console.warn('Result of deleted many from IndexedDB', deletedLocal)

      this.checkRequestQueue()
      return deletedLocal && deletedRemote
    } catch (error) {
      console.error('Some errors happen on deleting data from IndexedDB', error.message)
    }
  }

  /**
   * Promise-based method - queries all objects from the wordlist by languageCode 
   * or one wordItem from local/remote storage 
   * @param {Object} data
   * @param {String} data.languageCode
   * @param {WordItem} data.wordItem
   * @param {String} [type = merged] - there are the following available values:
   *                                     local - queries data from local DB
   *                                     remote - queries data from remote DB
   *                                     merged - queries data from local and remote DB, compares, 
   *                                              merges and saves absent data to local/remote
   * @return {WordItem[]} 
   */
  async query (data, type = 'merged') {
    let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
    let localAdapter = this._localStorageAdapter(data.dataType) 

    let result
    if (type === 'local') {
      let localDataItems = await localAdapter.query(data.params)
      result = localDataItems
    } else if (type === 'remote') {
      let remoteDataItems = await remoteAdapter.query(data.params)
      result = remoteDataItems
    } else {
      let localDataItems = await localAdapter.query(data.params)
      
      let remoteDataItems = await remoteAdapter.query(data.params)

      let finalLocal = await this.mergeLocalRemote(localAdapter, remoteAdapter, localDataItems, remoteDataItems)
      result = finalLocal
    }

    this.printErrors(remoteAdapter)
    this.printErrors(localAdapter)
    return result
  }

  /**
   * Promise-based method - inits methods for creating absent local items, absent remote items
   * @param {WordItemIndexedDbDriver} localDBDriver
   * @param {WordItemRemoteDbDriver} remoteDBDriver
   * @param {WordItem[]} localDataItems - items that are stored localy before merging
   * @param {WordItem[]} remoteDataItems - items that are stored remotely before merging
   * @return {WordItem[]} - new wordItems that were created after merging
   */
  async mergeLocalRemote (localAdapter, remoteAdapter, localDataItems, remoteDataItems) {
    // console.info('********mergeLocalRemote1', localDataItems[0].context)
    let notInLocalWI = await this.createAbsentLocalItems(localAdapter, remoteAdapter, localDataItems, remoteDataItems)
    // console.info('********mergeLocalRemote2', localDataItems[0].context)
    this.createAbsentRemoteItems(localAdapter, remoteAdapter, localDataItems, remoteDataItems)
    // console.info('********mergeLocalRemote3', localDataItems[0].context)
    return notInLocalWI
  }

  /**
   * Promise-based method - creates absent remote items
   * @param {WordItemIndexedDbDriver} localDBDriver
   * @param {WordItemRemoteDbDriver} remoteDBDriver
   * @param {WordItem[]} localDataItems - items that are stored localy before merging
   * @param {WordItem[]} remoteDataItems - items that are stored remotely before merging
   * @return {WordItem[]} - new wordItems that were created after merging
   */
  async createAbsentRemoteItems (localAdapter, remoteAdapter, localDataItems, remoteDataItems) {
    let remoteDBDriver = remoteAdapter.dbDriver
    let localDBDriver = localAdapter.dbDriver

    let remoteCheckAray = remoteDBDriver.getCheckArray(remoteDataItems)
    
    let notInRemote = []
    
    // console.info('********createAbsentRemoteItems', localDataItems[0].context)
    for (let localItem of localDataItems) {
      let checkID = localDBDriver.makeIDCompareWithRemote(localItem)
      if (!remoteCheckAray.includes(checkID)) {
        await this.create({ dataObj: localItem }, { onlyRemote: true })
        notInRemote.push(localItem)
      } else {
        let remoteItem = remoteDBDriver.getByStorageID(remoteDataItems, checkID)

        // console.info('*****query remoteItem, localItem', remoteItem, localItem)
        let updateRemote = remoteDBDriver.comparePartly(remoteItem, localItem)
        if (updateRemote) {
          await remoteAdapter.update(updateRemote, true) 
        }       
      }
    }
  }

  /**
   * Promise-based method - creates absent local items
   * @param {WordItemIndexedDbDriver} localDBDriver
   * @param {WordItemRemoteDbDriver} remoteDBDriver
   * param {WordItem[]} localDataItems - items that are stored localy before merging
   * @param {WordItem[]} remoteDataItems - items that are stored remotely before merging
   * @return {WordItem[]} - new wordItems that were created after merging
   */
  async createAbsentLocalItems (localAdapter, remoteAdapter, localDataItems, remoteDataItems) {
    let remoteDBDriver = remoteAdapter.dbDriver
    let localDBDriver = localAdapter.dbDriver

    let localCheckAray = localDBDriver.getCheckArray(localDataItems)

    let finalLocal = []

    for (let remoteItem of remoteDataItems) {
      let checkID = remoteDBDriver._makeStorageID(remoteItem)
      if (!localCheckAray.includes(checkID)) {
        let dataItemForLocal = localDBDriver.createFromRemoteData(remoteItem)
        await this.create({ dataObj: dataItemForLocal }, { onlyLocal: true })
        finalLocal.push(dataItemForLocal)
      } else {
        let localItem = localDBDriver.getByStorageID(localDataItems, checkID)
        // console.info('*****createAbsentLocalItems before localItem', localItem)
        // console.info('*****createAbsentLocalItems remoteItem', remoteItem)
        let updateLocal = localDBDriver.comparePartly(localItem, remoteItem)
        
        // console.info('*****createAbsentLocalItems after localItem', localItem)
        // console.info('*****createAbsentLocalItems updateLocal', updateLocal)
        if (updateLocal) {
          await this.update({ dataObj: updateLocal }, { onlyLocal: true })
          finalLocal.push(updateLocal)
        } else {
          finalLocal.push(localItem)
        }  
      }
    }
    return finalLocal
  }

  /**
   * Method checks request queue, and if it is not empty executes the first in the queue
   */
  checkRequestQueue () {
    if (this.requestsQueue.length > 0) {
      let curRequest = this.requestsQueue.shift()
      this[curRequest.method](curRequest.data)
    }
  }

  /**
   * Method prints errors from the errors property of the given adapter
   */
  printErrors (adapter) {
    if (adapter.errors && adapter.errors.length > 0) {
      adapter.errors.forEach(error => console.error(`Print error - ${error.message}`))
    }
  }
}

// Constants (could be done better, dynamically, etc.)
UserDataManager.LOCAL_DRIVER_CLASSES = {
  WordItem: WordItemIndexedDbDriver
}
UserDataManager.REMOTE_DRIVER_CLASSES = {
  WordItem: WordItemRemoteDbDriver
}
