export default class WordItemIndexedDbDriver {

  constructor(userId) {
    this.userId = userId
  }

  // create a data model item populated from the db
  create(data) {
    return new WordItem(data)
  }

  makeStorageID(item) {
    return this.userId + '-' + item.languageCode + '-' + item.targetWord
  }

  get dbName () {
    return 'AlpheiosWordLists'
  }

  get dbVersion () {
    return 2
  }

  get listQuery(params) {
    if (params.languageCode) {
      let listID = this.userId + '-' + params.languageCode
      return {
        objectStoreName: this.storageMap.common.objectStoreName,
        condition: {indexName: 'listID', value: listID, type: 'only' }
      }
    } else {
      // TODO throw error
    }
  }

  get deleteOneCondition(worditem) {
    let ID = this.makeStorageID(worditem)
    return  { indexName: 'ID', value: ID, type: 'only' }
  }

  get deleteListCondition(params) {
    if (params.languageCode) {
      let listID = this.userId + '-' + params.languageCode
      return { indexName: 'listID', value: listID, type: 'only' }
    } else {
      // TODO throw error
    }
  }

  get objectStores () {

  get objectStores () {
    return {
      WordListsCommon: this.wordListsCommon,
      WordListsContext: this.wordListsContext,
      WordListsHomonym: this.wordListsHomonym,
      WordListsFullHomonym: this.wordListsFullHomonym
    }
  }

  get objectStoreTemplate () {
    return {
      keyPath: 'ID',
      indexes: [
        { indexName: 'ID', keyPath: 'ID', unique: true},
        { indexName: 'listID', keyPath: 'listID', unique: false},
        { indexName: 'userID', keyPath: 'userID', unique: false},
        { indexName: 'languageCode', keyPath: 'languageCode', unique: false},
        { indexName: 'targetWord', keyPath: 'targetWord', unique: false}
      ]
    }
  }

  get storageMap () {
    return {
      common: {
        objectStoreName: 'WordListsCommon',
        convertMethodName: 'convertCommonToStorage'
      },
      textQuoteSelector: {
        objectStoreName: 'WordListsContext',
        uploadMethodName: 'uploadTQSelectorFromStorage'
        convertMethodName: 'convertTQSelectorToStorage'
      },
      shortHomonym: {
        objectStoreName: 'WordListsHomonym',
        uploadMethodName: 'uploadShortHomonymFromStorage'
        convertMethodName: 'convertShortHomonymToStorage'
      },
      fullHomonym: {
        objectStoreName: 'WordListsFullHomonym',
        uploadMethodName: 'uploadFullHomonymFromStorage',
        convertMethodName: 'convertFullHomonymToStorage'
      }
    }
  }

  get wordListsCommon () {
    return this.objectStoreTemplate
  }

  get wordListsContext () {
    let structure = this.objectStoreTemplate
    structure.indexes.push(
      { indexName: 'wordItemID', keyPath: 'wordItemID', unique: false}
    )
    return structure
  }

  get wordListsHomonym () {
    return this.objectStoreTemplate
  }

  get wordListsFullHomonym () {
    return this.objectStoreTemplate
  }

  uploadCommonFromStorage(worditem, jsonObj)   {
    worditem.listID = jsonObj.listID
    wordItem.languageCode = jsonObj.languageCode
    wordItem.targetWord = jsonObj.targetWord
    wordItem.important = jsonObj.important
    wordItem.createdDT = jsonObj.createdDT
  }

  uploadHomonymFromStorage (worditem,jsonObj) {
    worditem.homonym = Homonym.readObject(jsonObj.homonym)
  }

  uploadContextFromStorage (worditem, jsonObjs) {
    let tqs = []
    for (let jsonObj of jsonObjs) {
      let tq = TextQuoteSelector.readObject(jsonObj)
      tqs.push(tq)
    }
    worditem.addContext(tqs)
  }

  convertCommonToStorage (worditem) {
    return {
      ID: this.makeStorageID(worditem),
      listID: worditem.listID,
      languageCode: worditem.languageCode,
      targetWord: worditem.targetWord,
      important: worditem.important,
      createdDT: WordItem.currentDate
    }
  }

  convertTQSelectorToStorage (worditem) {
    let result = []
    let index = 0
    let wordItemId = this.makeStorageID(worditem)
    for (let tq of worditem.textQuoteSelectors) {
      index++
      let resultItem = {
        ID: wordItemId + '-' + index
        listID: worditem.listID,
        userID: worditem.userID,
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
        createdDT: WordItem.currentDate
      }
      result.push(resultItem)
    }
    return result
  }

  convertHomonymToStorage (worditem,addMeaning = false) {
    let resultHomonym = worditem.homonym.convertToJSONObject(addMeaning)
    return {
      ID: this.makeStorageID(worditem),
      listID: worditem.listID,
      userID: worditem.userID,
      languageCode: worditem.languageCode,
      targetWord: worditem.targetWord,
      homonym: resultHomonym
    }
  }
  convertShortHomonymToStorage (worditem) {
    return this.convertHomonymToStorage(worditem,false)
  }

  convertFullHomonymToStorage (worditem) {
    return this.convertHomonymToStorage(worditem,true)
  }
}
