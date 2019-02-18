import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter.js'
import RemoteDBAdapter from '@/storage/remote-db-adapter.js'
export default class UserDataManager {

  constructor (userID,events) {
    this.userID = userID
    if (events) {
      events.WORDITEM_UPDATED.sub(this.update.bind(this))
      events.WORDITEM_DELETED.sub(this.delete.bind(this))
      events.WORDLIST_DELETED.sub(this.deleteMany.bind(this))
    }
    this.blocked = false
    this.requestsQueue = []
  }

  _localStorageAdapter(dataType) {
    let dbDriver = new UserDataManager.LOCAL_DRIVER_CLASSES[dataType](this.userID)
    return new IndexedDBAdapter(dbDriver)
  }

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

  async create(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'create',
        data: data
      })
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
   * Update data in the user data stores
   * @param {Object} data object adhering to
   *                      { dataObj: the data model object to be updated}
   *                        params: datatype specific parameters
   *                      }
   * @return {Boolean} true if update succeeded false if not
   */
  async update(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'update',
        data: data
      })
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
   * Delete a single data model object from the user data stores
   * @param {Object} data object adhering to
   *                      { dataObj: the data model object to be updated} }
   * @return {Boolean} true if delete succeeded false if not
   */
  async delete(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'delete',
        data: data
      })
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
   * Delete a set objects from the data store
   * @param {Object} data object adhering to
   *                      { dataType: the name of the datatype to delete,
   *                        params: parameters to identify items to be deleted
   *                      }
   */
  async deleteMany(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'deleteMany',
        data: data
      })
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
   * Query the user data stores
   * @param {Object} data object adhering to
   *                      { dataType: the name of the datatype to query
   *                        params: query parameters to
   *                      }
   * @return {Object[]} an array of data items
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

  async mergeLocalRemote (localDBDriver, remoteDBDriver, localDataItems, remoteDataItems) {
    let notInLocalWI = await this.createAbsentLocalItems(localDBDriver, remoteDBDriver, localDataItems, remoteDataItems)
    this.createAbsentRemoteItems(localDBDriver, remoteDBDriver, localDataItems, remoteDataItems)
    return notInLocalWI
  }

  async createAbsentRemoteItems (localDBDriver, remoteDBDriver, localDataItems, remoteDataItems) {
    let remoteCheckAray = remoteDBDriver.getCheckArray(remoteDataItems)

    let notInRemote = localDataItems.filter(item => !remoteCheckAray.includes(localDBDriver.makeIDCompareWithRemote(item)))
    for (let item of notInRemote) {
      await this.create({ dataObj: item }, { onlyRemote: true })
    }
    return notInRemote
  }

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

  checkRequestQueue () {
    if (this.requestsQueue.length > 0) {
      let curRequest = this.requestsQueue.shift()
      this[curRequest.method](curRequest.data)
    }
  }

  printErrors (localAdapter) {
    if (localAdapter.errors && localAdapter.errors.length > 0) {
      localAdapter.errors.forEach(error => console.error(`Print error - ${error.message}`))
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
