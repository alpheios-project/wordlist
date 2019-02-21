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

      if (localAdapter.available && !params.onlyRemote) {
        createdLocal = await localAdapter.create(data.dataObj)
        this.printErrors(localAdapter)
      } else if (params.onlyRemote) {
        createdLocal = true
      } else {
        console.error('LocalAdapter is not available for the usage')
      }

      if (remoteAdapter.available && !params.onlyLocal) {
        createdRemote = await remoteAdapter.create(data.dataObj)    
        this.printErrors(remoteAdapter) 
      } else if (params.onlyLocal) {
        createdRemote = true
      } else {
        console.error('RemoteAdapter is not available for usage')
      }

      this.blocked = false
      this.checkRequestQueue()

      return createdLocal && createdRemote
    
    } catch (error) {
      console.error('Some errors happen on creating data in IndexedDB or RemoteDBAdapter', error.message)
    }
    
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
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'update',
        data: data
      })
      return
    }
    try {
      this.blocked = true
      let finalConstrName = this.defineConstructorName(data.dataObj.constructor.name)

      let localAdapter = this._localStorageAdapter(finalConstrName)
      let remoteAdapter = this._remoteStorageAdapter(finalConstrName)

      let updatedLocal = false
      let updatedRemote = false

      if (localAdapter.available && !params.onlyRemote) {
        updatedLocal = await localAdapter.update(data.dataObj, data.params)
        this.printErrors(localAdapter)
      } else if (params.onlyRemote) {
        updatedLocal = true
      } else {
        console.error('LocalAdapter is not available for usage')
      }

      if (remoteAdapter.available && !params.onlyLocal) {
        updatedRemote = await remoteAdapter.update(data.dataObj) 
        this.printErrors(remoteAdapter)    
      } else if (params.onlyLocal) {
        updatedRemote = true
      } else {
        console.error('RemoteAdapter is not available for usage')
      }

      this.blocked = false
      this.checkRequestQueue()

      return updatedLocal && updatedRemote
    } catch (error) {
      console.error('Some errors happen on updating data in IndexedDB', error.message)
    }
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
      console.info('Result of deleted many from IndexedDB', deletedLocal)

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

      let notInLocalWI = await this.mergeLocalRemote(localAdapter.dbDriver, remoteAdapter.dbDriver, localDataItems, remoteDataItems)
      result = [...localDataItems,...notInLocalWI]
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
  async mergeLocalRemote (localDBDriver, remoteDBDriver, localDataItems, remoteDataItems) {
    let notInLocalWI = await this.createAbsentLocalItems(localDBDriver, remoteDBDriver, localDataItems, remoteDataItems)
    this.createAbsentRemoteItems(localDBDriver, remoteDBDriver, localDataItems, remoteDataItems)
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
  async createAbsentRemoteItems (localDBDriver, remoteDBDriver, localDataItems, remoteDataItems) {
    let remoteCheckAray = remoteDBDriver.getCheckArray(remoteDataItems)

    let notInRemote = localDataItems.filter(item => !remoteCheckAray.includes(localDBDriver.makeIDCompareWithRemote(item)))
    for (let item of notInRemote) {
      await this.create({ dataObj: item }, { onlyRemote: true })
    }
    return notInRemote
  }

  /**
   * Promise-based method - creates absent local items
   * @param {WordItemIndexedDbDriver} localDBDriver
   * @param {WordItemRemoteDbDriver} remoteDBDriver
   * @param {WordItem[]} localDataItems - items that are stored localy before merging
   * @param {WordItem[]} remoteDataItems - items that are stored remotely before merging
   * @return {WordItem[]} - new wordItems that were created after merging
   */
  async createAbsentLocalItems (localDBDriver, remoteDBDriver, localDataItems, remoteDataItems) {
    let localCheckAray = localDBDriver.getCheckArray(localDataItems)

    let notInLocal = remoteDataItems.filter(item => !localCheckAray.includes(remoteDBDriver._makeStorageID(item)))

    let notInLocalWI = []
    for (let item of notInLocal) {
      let dataItemForLocal = localDBDriver.createFromRemoteData(item)
      await this.create({ dataObj: dataItemForLocal }, { onlyLocal: true })
      notInLocalWI.push(dataItemForLocal)
    }
    return notInLocalWI
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
