import { Homonym, WordItem, Lexeme, Lemma, LanguageModelFactory as LMF } from 'alpheios-data-models'

import IndexedDBObjectStoresStructure from '@/storage/indexeddbDriver/indexed-db-object-stores-structure'
import IndexedDBLoadProcess from '@/storage/indexeddbDriver/indexed-db-load-process'

export default class WordItemIndexedDbDriver {

  /**
   * @constructor
   * @param {String} userId user id for the database
   */
  constructor(userId) {
    this.userId = userId
    this.storageMap = {
      _loadFirst: 'common',
      common: {
        objectStoreData: {
          name: 'WordListsCommon',
          structure: IndexedDBObjectStoresStructure.WordListsCommon
        },
        load: IndexedDBLoadProcess.loadBaseObject,
        serialize: this._serializeCommon.bind(this),
        delete: this._segmentDeleteQueryByID.bind(this)
      },
      context: {
        objectStoreData: {
          name: 'WordListsContext',
          structure: IndexedDBObjectStoresStructure.WordListsContext
        },
        serialize: this._serializeContext.bind(this),
        load: IndexedDBLoadProcess.loadContext,
        delete: this._segmentDeleteQueryByWordItemID.bind(this)
      },
      shortHomonym: {
        objectStoreData: {
          name: 'WordListsHomonym',
          structure: IndexedDBObjectStoresStructure.WordListsHomonym
        },
        serialize: this._serializeHomonym.bind(this),
        load: IndexedDBLoadProcess.loadHomonym,
        delete: this._segmentDeleteQueryByID.bind(this)
      },
      fullHomonym: {
        objectStoreData: {
          name: 'WordListsFullHomonym',
          structure: IndexedDBObjectStoresStructure.WordListsFullHomonym
        },
        serialize: this._serializeHomonymWithFullDefs.bind(this),
        load: IndexedDBLoadProcess.loadHomonym,
        delete: this._segmentDeleteQueryByID.bind(this)
      }
    }
  }

  /**
  * dbName getter
  */
  get dbName () {
    return 'AlpheiosWordLists'
  }

  /**
   * dbVersion getter
   */
  get dbVersion () {
    return 3
  }

  /**
   * db segments getter
   */
  get segments() {
    return Object.keys(this.storageMap).filter(key => key.substr(0,1) !== '_')
  }

  get segmentsNotFirst () {
    return this.segments.filter(segment => segment !== this.storageMap._loadFirst)
  }
  /**
   * objectStores getter
   * @return {Object} the IndexedDb objectStores for the WordItems
   */
  get objectStores () {
    return this.allObjectStoreData.map(objectStoreData => objectStoreData.name)
  }

  get allObjectStoreData () {
    return this.segments.map(segment => this.storageMap[segment].objectStoreData)
  }

  _objectStoreData (segment) {
    return this.storageMap[segment].objectStoreData
  }

  _objectStoreName (segment) {
    return this._objectStoreData(segment).name
  }
  
  _formatQuery (segment, indexName, indexValue, indexType = 'only') {
    return {
      objectStoreName: this._objectStoreName(segment),
      condition: {indexName: indexName, value: indexValue, type: indexType }
    }
  }

  loadFirst (data) {
    return this.storageMap[this.storageMap._loadFirst].load(data)
  }

  /**
   * load a segment of a data model object from the database
   */
  loadSegment(segment, worditem, jsonObj) {
    if (this.storageMap[segment].load) {
      this.storageMap[segment].load(worditem, jsonObj)
    }
  }

  /**
   * get a query object which retrieves a list of WordItems
   * @param {Object} params query parameters
   * @return {Object} IndexedDBQuery object
   */
  listItemsQuery(params) {
    if (params.languageCode) {
      return this._formatQuery('common', 'listID', this._makeStorageListID(params.languageCode))
    } else if (params.wordItem) {
      return this.segmentSelectQuery('common', params.wordItem)
    } else {
      throw new Error("Invalid query parameters - missing languageCode")
    }
  }

  /**
   * get a query object which retrieves a segment of an item
   * @param {String} segment segment name
   * @param {WordItem} worditem the worditem object
   * @return {Object} IndexedDBQuery object
   */
  segmentSelectQuery(segment, worditem) {
    let ID = this._makeStorageID(worditem)
    let index = (segment === 'context') ? 'wordItemID' : 'ID'
    return this._formatQuery(segment, index, ID)
  }

  segmentDeleteQuery (segment, worditem) {
    return this.storageMap[segment].delete(segment,worditem)
  }

  _segmentDeleteQueryByID(segment, worditem) {
    let ID = this._makeStorageID(worditem)
    return this._formatQuery(segment, 'ID', ID)
  }

  _segmentDeleteQueryByWordItemID(segment, worditem) {
    let ID = this._makeStorageID(worditem)
    return this._formatQuery(segment, 'wordItemID', ID)
  }


  segmentDeleteManyQuery(segment, params) {
    if (params.languageCode) {
      let listID = this.userId + '-' + params.languageCode
      return this._formatQuery(segment, 'listID', listID)
    } else {
      throw new Error("Invalid query parameters - missing languageCode")
    }
  }

  updateSegmentQuery(segment,data) {
    let dataItems = []
    let resDataItem = this.storageMap[segment].serialize(data)
    if (!Array.isArray(resDataItem)) {
      dataItems.push(resDataItem)
    } else {
      dataItems = dataItems.concat(resDataItem)
    }
    return {
      objectStoreName: this._objectStoreName(segment),
      dataItems: dataItems
    }
  }

  /**
   * private method to convert the common segment to storage
  */
  _serializeCommon (worditem) {
    return {
      ID: this._makeStorageID(worditem),
      listID: this.userId + '-' + worditem.languageCode,
      userID: this.userId,
      languageCode: worditem.languageCode,
      targetWord: worditem.targetWord,
      important: worditem.important,
      createdDT: WordItemIndexedDbDriver.currentDate
    }
  }

  /**
   * private method to convert the context segment to storage
   */
  _serializeContext (worditem) {
    let result = []
    let index = 0
    let wordItemId = this._makeStorageID(worditem)
    for (let tq of worditem.context) {
      index++
      let resultItem = {
        ID: wordItemId + '-' + index,
        listID: this.userId + '-' + worditem.languageCode,
        userID: this.userId,
        languageCode: worditem.languageCode,
        targetWord: worditem.targetWord,
        wordItemID: wordItemId,
        target: {
          source: tq.source,
          selector: {
            type: 'TextQuoteSelector',
            exact: tq.text,
            prefix: tq.prefix,
            suffix: tq.suffix,
            contextHTML: tq.contextHTML,
            languageCode: tq.languageCode
          }
        },
        createdDT: WordItemIndexedDbDriver.currentDate
      }
      result.push(resultItem)
    }
    return result
  }

  /**
   * private method to convert the homonym segment to storage
   * @param {WordItem}
   */
  _serializeHomonym (worditem, addMeaning = false) {
    let resultHomonym = worditem.homonym && (worditem.homonym instanceof Homonym) ? worditem.homonym.convertToJSONObject(addMeaning) : {}
    return {
      ID: this._makeStorageID(worditem),
      listID: this.userId + '-' + worditem.languageCode,
      userID: this.userId,
      languageCode: worditem.languageCode,
      targetWord: worditem.targetWord,
      homonym: resultHomonym
    }
  }


/**
 * private method to serialize homonymns with full defs
 * @param {WordItem}
 */
_serializeHomonymWithFullDefs (worditem) {
  return this._serializeHomonym(worditem,true)
}

static get currentDate () {
  let dt = new Date()
  return dt.getFullYear() + '/'
      + ((dt.getMonth()+1) < 10 ? '0' : '') + (dt.getMonth()+1)  + '/'
      + ((dt.getDate() < 10) ? '0' : '') + dt.getDate() + ' @ '
              + ((dt.getHours() < 10) ? '0' : '') + dt.getHours() + ":"
              + ((dt.getMinutes() < 10) ? '0' : '') + dt.getMinutes() + ":"
              + ((dt.getSeconds() < 10) ? '0' : '') + dt.getSeconds()

}

  /**
  * private method to create the storage ID for a WordItem
  */
  _makeStorageID(item) {
    return this.userId + '-' + item.languageCode + '-' + item.targetWord
  }

  /**
  * private method to create the storage ID for a WordItem
  */
  _makeStorageListID(languageCode) {
    return this.userId + '-' + languageCode
  }

  makeIDCompareWithRemote (item) {
    return item.languageCode + '-' + item.targetWord
  }

  getCheckArray (dataItems) {
    return dataItems.map(item => this.makeIDCompareWithRemote(item))
  }

  createFromRemoteData (remoteDataItem) {
    let wordItem = this.loadFirst(remoteDataItem)
    
    this.loadSegment('context', wordItem, remoteDataItem.context)
    this.loadSegment('shortHomonym', wordItem, [ remoteDataItem ])
    return wordItem
  }
}
