import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter.js'
import RemoteDBAdapter from '@/storage/remote-db-adapter.js'
export default class UserDataManager {

  constructor (userID) {
    this.userID = userID
    WordlistController.evt.WORDITEM_UPDATED.sub(UserDataController.update.bind(UserDataController))
    WordlistController.evt.WORDITEM_DELETED.sub(UserDataController.delete.bind(UserDataController))
  }

  _localStorageAdapter(dataType) {
    let dbDriver = new LOCAL_DRIVER_CLASSES[dataType](this.userID)
    return new IndexedDBAdapter(UserDataController.DOMAIN,dbAdapter)
  }

  _remoteStorageAdapter(dataType) {
    let dbDriver = new REMOTE_DRIVER_CLASSES[dataType](this.userID)
    return new RemoteDBAdapter(dbDriver)
  }

  /**
   * Update data in the user data stores
   * @param {Object} data object adhering to
   *                      { model: the data model object to be updated}
   *                        needsUpdate: a list of properties requiring update
   *                                     (if not supplied the full update is updated)
   *                      }
   * @return {Boolean} true if update succeeded false if not
   */
  async update(data) {
    let ls = this._localStorageAdapter(data.model.constructor.name)
    let rs = this._remoteStorageAdapter(data.model.constructor.name)
    let updatedLocal = await ls.update(data.model,data.needsUpdate)
    let updatedRemote = await rs.update(data.model,data.needsUpdate)
    // TODO error handling upon update failure
    return updatedLocal && updatedRemote
  }

  /**
   * Delete data from the user data stores
   * @param {Object} data object adhering to
   *                      { model: the data model object to be updated} }
   * @return {Boolean} true if delete succeeded false if not
   */
  async delete(data) {
    let ls = this._localStorageAdapter(data.model.constructor.name)
    let rs = this._remoteStorageAdapter(data.model.constructor.name)
    let deletedLocal = await ls.deleteOne(data.model)
    let deletedRemote = await rs.deleteOne(data.model)
    // TODO error handling upon delete failure
    return deletedLocal && deletedRemote
  }

  /**
   * Query the user data stores
   * @param {String} dataType the name of the datatype to query
   * @param {Object} params query parameters (datatype specific)
   * @return {Object[]} an array of data items
   */
  async query(dataType,params) {
    // query queries both the remote and local stores and merges
    // the results
    let remoteAdapter =  this._remoteStorageAdapter(dataType)
    let localAdapter = this._localStorageAdapter(dataType)
    let remoteDataItems = await remoteAdapter.query(params)
    let localDataItems = await localAdapter.query(params)

    // if we have any remoteData items then we are going to
    // reset the local store from the remoteData, adding back in any
    // items that appeared only in the local
    if (remoteDataItems.length > 0) {
        localAdapter.deleteMany(params)
    }
    let addToRemote = []
    let updateInRemote = []
    localDataItems.forEach(item => {
      let inRemote = false
      for (let i=0; i<remoteDataItems.length, i++ ) {
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
    return [...remoteDataItems,...addToRemote]
  }
}

// Constants (could be done better, dynamically, etc.)
UserDataController.DOMAIN = 'alpheios-storage-domain'
UserDataController.LOCAL_DRIVER_CLASSES = {
  WordItem: WordItemIndexedDbDriver
}
UserDataController.REMOTE_DRIVER_CLASSES = {
  WordItem: WordItemRemoteDbDriver
}
