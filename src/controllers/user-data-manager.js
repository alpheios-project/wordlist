import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter.js'
import RemoteDBAdapter from '@/storage/remote-db-adapter.js'

export default class UserDataManager {

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

  _localStorageAdapter(dataType) {
    let dbDriver = new UserDataManager.LOCAL_DRIVER_CLASSES[dataType](this.userID)
    return new IndexedDBAdapter(dbDriver)
  }

  _remoteStorageAdapter(dataType) {
    let dbDriver = new UserDataManager.REMOTE_DRIVER_CLASSES[dataType](this.userID)
    return new RemoteDBAdapter(dbDriver)
  }

  async update(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'update',
        data, params
      })
      return
    }
    try {
      this.blocked = true
      params.source = params.source||'both'
      let finalConstrName = this.defineConstructorName(data.dataObj.constructor.name)

      let localAdapter = this._localStorageAdapter(finalConstrName)
      let remoteAdapter = this._remoteStorageAdapter(finalConstrName)
      
      let result = false
      let segment = data.params && data.params.segment ? data.params.segment : localAdapter.dbDriver.segments

      if (params.source === 'local') {
        result = await localAdapter.update(data.dataObj, data.params)
      } else if (params.source === 'remote') {
        result = await remoteAdapter.update(data.dataObj, data.params)  
      } else {
        let currentRemoteItems = await remoteAdapter.checkAndUpdate(data.dataObj, segment)
        result = await localAdapter.checkAndUpdate(data.dataObj, segment, currentRemoteItems)
      }

      this.printErrors(remoteAdapter)
      this.printErrors(localAdapter)

      this.blocked = false
      this.checkRequestQueue()
      return result
    } catch (error) {
      console.error('Some errors happen on updating data in IndexedDB or RemoteDBAdapter', error.message)
    }
  }

  async delete(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'delete',
        data, params
      })
      return
    }
    try {
      this.blocked = true
      let finalConstrName = this.defineConstructorName(data.dataObj.constructor.name)
      
      let localAdapter = this._localStorageAdapter(finalConstrName)
      let remoteAdapter = this._remoteStorageAdapter(finalConstrName)
    
      let remoteResult = true
      let localResult = true
      
      if (params.source !== 'local') {
        remoteResult = await remoteAdapter.deleteOne(data.dataObj)
      }
      if (params.source !== 'remote') {
        localResult = await localAdapter.deleteOne(data.dataObj)
      }

      this.printErrors(remoteAdapter)
      this.printErrors(localAdapter)

      this.blocked = false
      this.checkRequestQueue()

      return remoteResult && localResult
    } catch (error) {
      console.error('Some errors happen on deleting item from IndexedDB or RemoteDBAdapter', error.message)
    }
  }

  async deleteMany(data, params = {}) {
    if (this.blocked) {
      this.requestsQueue.push({
        method: 'deleteMany',
        data, params
      })
      return
    }
    try {
      this.blocked = true
      let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
      let localAdapter = this._localStorageAdapter(data.dataType)

      let deletedLocal = true
      let deletedRemote = true
      
      if (params.source !== 'local') {
        deletedRemote = await remoteAdapter.deleteMany(data.params)
      }
      if (params.source !== 'remote') {
        deletedLocal = await localAdapter.deleteMany(data.params)
      }      

      this.printErrors(remoteAdapter)
      this.printErrors(localAdapter)

      console.warn('Result of deleted many from IndexedDB', deletedLocal)

      this.blocked = false
      this.checkRequestQueue()

      return deletedLocal && deletedRemote
    } catch (error) {
      console.error('Some errors happen on deleting data from IndexedDB or RemoteDBAdapter', error.message)
    }
  }

  async query (data, params = {}) {
    try {
      params.type = params.type||'short'
      params.source = params.source||'both'

      let remoteAdapter =  this._remoteStorageAdapter(data.dataType)
      let localAdapter = this._localStorageAdapter(data.dataType)

      let finalItems = []
      let remoteItems

      if (params.source === 'local') {
        finalItems = await localAdapter.query(data.params)
      } else if (params.source === 'remote') {
        remoteItems = await remoteAdapter.query(data.params)
        for(let remoteItem of remoteItems) {
          finalItems.push(localAdapter.dbDriver.createFromRemoteData(remoteItem))
        }
      } else {
        remoteItems = await remoteAdapter.query(data.params)
        if (params.type === 'full') {
          for (let remoteItem of remoteItems) {
            await localAdapter.checkAndUpdate(remoteItem, data.params.segment, [remoteItem])
          }
          let localItems = await localAdapter.query(data.params)
          finalItems = localItems
        } else {
          remoteItems = await remoteAdapter.query(data.params)
          for(let remoteItem of remoteItems) {
            let wordItem = localAdapter.dbDriver.createFromRemoteData(remoteItem)
            finalItems.push(wordItem)
            localAdapter.checkAndUpdate(wordItem, null, [remoteItem])
          }

        }
      }

      this.printErrors(remoteAdapter)
      this.printErrors(localAdapter)
      return finalItems
    } catch (error) {
      console.error('Some errors happen on quiring data from IndexedDB or RemoteDBAdapter', error.message)
    }
  }

  printErrors (adapter) {
    if (adapter.errors && adapter.errors.length > 0) {
      adapter.errors.forEach(error => console.error(`Print error - ${error}`))
    }
  }

  checkRequestQueue () {
    if (this.requestsQueue.length > 0) {
      let curRequest = this.requestsQueue.shift()
      this[curRequest.method](curRequest.data, curRequest.params)
    }
  }

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
}

// Constants (could be done better, dynamically, etc.)
UserDataManager.LOCAL_DRIVER_CLASSES = {
  WordItem: WordItemIndexedDbDriver
}
UserDataManager.REMOTE_DRIVER_CLASSES = {
  WordItem: WordItemRemoteDbDriver
}
  