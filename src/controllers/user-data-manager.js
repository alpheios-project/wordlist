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

  async create(data, params) {
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

      console.info('*****************createdLocal 1', localAdapter.available, !params.onlyRemote)
      if (localAdapter.available && !params.onlyRemote) {
        createdLocal = await localAdapter.create(data.dataObj)
        console.info('*****************createdLocal 2', createdLocal)
        this.printErrors(localAdapter)
      } else if (params.onlyRemote) {
        createdLocal = true
      } else {
        console.error('LocalAdapter is not available for the usage')
      }

      if (remoteAdapter.available && !params.onlyLocal) {
        createdRemote = await remoteAdapter.create(data.dataObj)     
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
  async update(data) {
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

      if (localAdapter.available) {
        updatedLocal = await localAdapter.update(data.dataObj, data.params)
        this.printErrors(localAdapter)
      } else {
        console.error('LocalAdapter is not available for usage')
      }

      if (remoteAdapter.available) {
        updatedRemote = await remoteAdapter.update(data.dataObj)     
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
  async delete(data) {
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
      let deletedLocal = await localAdapter.deleteOne(data.dataObj)
      let deletedRemote = await remoteAdapter.deleteOne(data.dataObj)
      this.printErrors(localAdapter)
      
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
  async deleteMany(data) {
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
      let deletedLocalResult = localAdapter.deleteMany(data.params)
      let deletedRemoteResult = remoteAdapter.deleteMany(data.params)
      const finalResult = [await deletedLocalResult, await deletedRemoteResult]
      
      this.printErrors(localAdapter)      
      this.blocked = false
      console.info('Result of deleted many from IndexedDB', finalResult)

      this.checkRequestQueue()
      
    } catch (error) {
      console.error('Some errors happen on deleting data from IndexedDB', error.message)
    }
  }

  async query (data, type = 'merged') {
    let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
    let localAdapter = this._localStorageAdapter(data.dataType)

    let remoteDataItems = await remoteAdapter.query(data.params)
    let localDataItems = await localAdapter.query(data.params)

    this.printErrors(localAdapter)

    if (type === 'local') {
      return localDataItems
    } else if (type === 'remote') {
      return remoteDataItems
    } else {
      let notInLocalWI = await this.mergeLocalRemote(localAdapter.dbDriver, remoteAdapter.dbDriver, localDataItems, remoteDataItems)
      return [...localDataItems,...notInLocalWI]
    }
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

  /**
   * Query the user data stores
   * @param {Object} data object adhering to
   *                      { dataType: the name of the datatype to query
   *                        params: query parameters to
   *                      }
   * @return {Object[]} an array of data items
   */
  async query_backup(data) {
    // query queries both the remote and local stores and merges
    // the results
    let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
    let localAdapter = this._localStorageAdapter(data.dataType)

    let remoteDataItems = await remoteAdapter.query(data.params)
    let localDataItems = await localAdapter.query(data.params)

    this.printErrors(localAdapter)

    // if we have any remoteData items then we are going to
    // reset the local store from the remoteData, adding back in any
    // items that appeared only in the local
    /*
    if (remoteDataItems.length > 0) {
        localAdapter.deleteMany(params)
    }
    */
    let addToRemote = []
    let updateInRemote = []
    
    localDataItems.forEach(item => {
      let inRemote = false
      for (let i=0; i<remoteDataItems.length; i++ ) {
        if (remoteDataItems[i].isSameItem(item)) {
          inRemote = true
          // if the item exists in the remote db, check to see if they differ
          // and if so merge and update
          if (remoteDataItems[i].isNotEqual(item)) {
            let merged = remoteDataItems[i].merge(item)
            remoteDataItems[i] = merged
            updateInRemote.push(remoteDataItems[i].merge(item))
          }
        }
      }
      if (!inRemote) {
        addToRemote.push(item)
      }
    })
    addToRemote.forEach(item => {
      remoteAdapter.create(item)
    })
    updateInRemote.forEach(item => {
      remoteAdapter.update(item)
    })
    let mergedList = [...remoteDataItems, ...addToRemote]
    mergedList.forEach(item=> {
      localAdapter.create(item)
    })
    
    // return [...remoteDataItems,...addToRemote]
    return localDataItems
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
