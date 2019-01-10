import { LanguageModelFactory as LMF } from 'alpheios-data-models'
import WordItem from '@/lib/word-item'

export default class WordList {
  constructor (userID, languageCode, storageAdapter) {
    this.userID = userID
    this.languageCode = languageCode
    this.storageAdapter = storageAdapter
    this.items = {}
  }

  get languageName () {
    switch(this.languageCode) {
      case 'lat':
        return 'Latin'
      case 'grc':
        return 'Greek'
      case 'ara':
        return 'Arabic'
      case 'per':
        return 'Persian'
      case 'gez':
        return 'Ancient Ethiopic (Ge\'ez)'
      default:
        'Unknown'
    }
  }

  get storageID () {
    return this.userID + '-' + this.languageCode
  }

  get values () {
    return Object.values(this.items)
  }
  
  removeWordItemByWord (wordItem) {
    if (this.contains(wordItem)) { 
      let deleteID = this.getIDByTargetWord(wordItem)
      this.wordItemsToDelete = [ this.storageID + '-' + this.items[deleteID].targetWord ]
      delete this.items[deleteID]
      this.removeFromStorage()
    }
  }

  removeWordItemByID (ID) {
    if (this.items[ID]) { 
      this.wordItemsToDelete = [ this.storageID + '-' + this.items[ID].targetWord ]
      delete this.items[ID]
      this.removeFromStorage()
    }
  }

  removeAllWordItems () {
    this.wordItemsToDelete = this.values.map(item => this.storageID + '-' + item.targetWord)
    let IDsforDelete = this.values.map(item => item.ID)
    IDsforDelete.forEach(ID => {
      delete this.items[ID]
    })
    this.removeFromStorage()
  }

  removeFromStorage () {
    if (this.storageAdapter.available) {
      this.storageAdapter.openDatabase(null, this.deleteStorageTransaction.bind(this))
    }
  }

  deleteStorageTransaction (event) {
    const db = event.target.result
    let successCallBackF = this.upgradeQueue ? this.upgradeQueue.clearCurrentItem.bind(this.upgradeQueue) : null
    this.storageAdapter.delete(db, 'UserLists', this.wordItemsToDelete.slice(), successCallBackF)
    this.wordItemsToDelete = []
  }
 
  contains (wordItem) {
    return this.values.map(item => item.targetWord).includes(wordItem.targetWord)
  }

  getIDByTargetWord (wordItem) {
    let checkRes = this.values.filter(item => item.targetWord === wordItem.targetWord)
    return checkRes ? checkRes[0].ID : null
  }

  makeImportantByID (wordItemID) {
    this.items[wordItemID].makeImportant()
    this.wordItemsToSave = [ this.items[wordItemID] ]
    this.saveToStorage()
  }

  removeImportantByID (wordItemID) {
    this.items[wordItemID].removeImportant()
    this.wordItemsToSave = [ this.items[wordItemID] ]
    this.saveToStorage()
  }

  makeAllImportant () {
    this.values.forEach(wordItem => {
      wordItem.makeImportant()
    })
    this.wordItemsToSave = this.values
    this.saveToStorage()
  }

  removeAllImportant () {
    this.values.forEach(wordItem => {
      wordItem.removeImportant()
    })
    this.wordItemsToSave = this.values
    this.saveToStorage()
  }

  // *****************************
  get storageMap () {
    return {
      common: {
        objectStoreName: 'WordListsCommon',
        convertMethodName: 'convertCommonToStorage'
      },
      textQuoteSelector: {
        objectStoreName: 'WordListsContext',
        convertMethodName: 'convertTQSelectorToStorage'
      },
      shortHomonym: {
        objectStoreName: 'WordListsHomonym',
        convertMethodName: 'convertShortHomonymToStorage'
      },
      fullHomonym: {
        objectStoreName: 'WordListsFullHomonym',
        convertMethodName: 'convertFullHomonymToStorage'
      }
    }
  }

  async pushWordItem (data, type) {
    // console.info('***************pushWordItem data', data)
    let wordItem = new WordItem(data)
    // console.info('***************pushWordItem wordItem', wordItem)
    //check if worditem exists in the list
    if (!this.contains(wordItem)) {
      await this.pushWordItemPart(wordItem, 'common')
    }

    await this.pushWordItemPart(wordItem, type)
    // console.info('****************pushWordItem final', type)
  }

  async pushWordItemPart (wordItem, type) {
    this.items[wordItem.storageID] = wordItem
    if (this.storageMap[type]) {
      let dataItem = wordItem[this.storageMap[type].convertMethodName]()

      await this.storageAdapter.set({
        objectStoreName: this.storageMap[type].objectStoreName,
        dataItem
      })  
    }
  }

  async uploadFromDB () {
    let res = await this.storageAdapter.get({
      objectStoreName: this.storageMap.common.objectStoreName,
      condition: {indexName: 'listID', value: this.storageID, type: 'only' }
    })
    if (res.length === 0) {
      return false
    } else {
      // console.info('*****************uploadFromDB get res common', res)
      for (let resWordItem of res) {
        let resKey = resWordItem.ID
        let wordItem = new WordItem(resWordItem)

        let resFullHomonym = await this.storageAdapter.get({
          objectStoreName: this.storageMap.fullHomonym.objectStoreName,
          condition: {indexName: 'ID', value: resKey, type: 'only' }
        })
        
        // console.info('*****************uploadFromDB get res homonym', res)

        if (resFullHomonym.length > 0) {
          wordItem.uploadHomonym(resFullHomonym[0])
        } else {
          let resShortHomonym = await this.storageAdapter.get({
            objectStoreName: this.storageMap.shortHomonym.objectStoreName,
            condition: {indexName: 'ID', value: resKey, type: 'only' }
          })
          if (resShortHomonym.length > 0)
          wordItem.uploadHomonym(resShortHomonym[0])
        }

        let resTextQuoteSelector = await this.storageAdapter.get({
          objectStoreName: this.storageMap.textQuoteSelector.objectStoreName,
          condition: {indexName: 'ID', value: resKey, type: 'only' }
        })

        if (resTextQuoteSelector.length > 0) {
          console.info('**********************resTextQuoteSelector', resTextQuoteSelector)
        }

        this.items[wordItem.storageID] = wordItem
      }
      // console.info('*****************uploadFromDB get res final', this.items)
      return true
    }
  }
}