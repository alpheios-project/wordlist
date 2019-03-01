/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { ClientAdapters } from 'alpheios-client-adapters'
import { Constants, WordItem, TextQuoteSelector, LanguageModelFactory as LMF } from 'alpheios-data-models'
import UserDataManager from '@/controllers/user-data-manager'

import axios from 'axios'

import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

describe('user-data-manager.test.js', () => {
  // console.error = function () {}
  console.log = function () {}
  console.warn = function () {}

  let testUserID = 'alpheiosMockUser'
  let testWordItem1 = new WordItem({
    targetWord: 'tuli',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  let testWordItem2 = new WordItem({
    targetWord: 'bene',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  let testWordItem3 = new WordItem({
    targetWord: 'mare',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  beforeAll( () => {
    window.indexedDB = IndexedDB
    window.IDBKeyRange = IDBKeyRange
  })

  beforeEach(() => {
    jest.spyOn(console, 'error')
    jest.spyOn(console, 'log')
    jest.spyOn(console, 'warn')
  })

  afterEach(() => {
    jest.resetModules()
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  async function prepareWordItem (word, lang = Constants.LANG_LATIN) {
    let langCode = LMF.getLanguageCodeFromId(lang)
    let adapterTuftsRes = await ClientAdapters.morphology.tufts({
      method: 'getHomonym',
      params: {
        languageID: lang,
        word: word
      }
    })

    let testHomonym = adapterTuftsRes.result
    
    let context = []
    let tqselector = TextQuoteSelector.readObject({
      languageCode: langCode,
      targetWord: word,
      target: {
        source: 'foosource',
        selector: {
          exact: word,
          prefix: 'fooprefix',
          suffix: 'foosuffix'
        }
      }
    })
    context.push(tqselector)

    return new WordItem({
      targetWord: word,
      languageCode: langCode,
      homonym: testHomonym,
      context: context
    })
  }
  
  it('1 UserDataManager - delete many and update method, checking blocking', async () => {
    let udm = new UserDataManager(testUserID)

    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let res1 = udm.update({ dataObj: testWordItem1, params: { segment: 'common' }})
    let res2 = udm.update({ dataObj: testWordItem2, params: { segment: 'common' }})
    let res3 = udm.update({ dataObj: testWordItem3, params: { segment: 'common' }})

    let res4 = udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    let res5 = udm.update({ dataObj: testWordItem3, params: { segment: 'common' }})

    let final = [await res1, await res2, await res3, await res4, await res5]
    await timeout(15000)
        
    let localDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)

    expect(localDataItems.filter(item => item.targetWord === testWordItem1.targetWord).length).toEqual(0)
    expect(localDataItems.filter(item => item.targetWord === testWordItem2.targetWord).length).toEqual(0)
    expect(localDataItems.filter(item => item.targetWord === testWordItem3.targetWord).length).toEqual(1)
    
    await timeout(5000)
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    return localDataItems
  }, 550000)

  it('2 UserDataManager - create method - creates wordItem only in local with onlyLocal param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // create the word only in local
    await udm.create({ dataObj: testWordItem }, { onlyLocal: true })

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in local

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // does not have in remote

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('3 UserDataManager - create method - creates wordItem only in remote with onlyRemote param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // create the word only in remote
    await udm.create({ dataObj: testWordItem }, { onlyRemote: true })

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // no in local

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in remote

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('4 UserDataManager - create method - creates wordItem both in remote and local (if no additional parameter)', async () => {
    let testWord = 'mare'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }}, { onlyRemote: true })

    await udm.create({ dataObj: testWordItem })

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in local

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in remote

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }}, { onlyRemote: true })
  }, 50000)

  it('5 UserDataManager - update method - updates wordItem only in local with onlyLocal param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // create the word only in local
    await udm.create({ dataObj: testWordItem }, { onlyLocal: true })
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeFalsy()

    testWordItem.important = true

    // changed important and update
    await udm.update({ dataObj: testWordItem }, { onlyLocal: true })
    await timeout(5000)
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeTruthy()
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('6 UserDataManager - update method - updates wordItem only in remote with onlyRemote param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // create the word only in local
    await udm.create({ dataObj: testWordItem }, { onlyRemote: true })
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeFalsy()

    testWordItem.important = true

    // changed important and update 
    await udm.update({ dataObj: testWordItem }, { onlyRemote: true })
    await timeout(5000)
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')

    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeTruthy()
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('7 UserDataManager - update method - updates wordItem both in local and remote without additional params', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // create the word
    await udm.create({ dataObj: testWordItem })
    
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeFalsy()

    testWordItem.important = true
    await timeout(5000)
    // changed important and update

    await udm.update({ dataObj: testWordItem }, { onlyRemote: true})
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    
    await timeout(5000)

    expect(checkDataItems.filter(item => item.targetWord === testWord)[0].important).toBeTruthy()
  
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

  }, 50000)
  
  it('8 UserDataManager - delete method - deletes wordItem only in local with onlyLocal param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // created both in local and remote
    await udm.create({ dataObj: testWordItem })
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1)

    // delete
    await udm.delete({ dataObj: testWordItem }, { onlyLocal: true })
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // has no in local

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in remote
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('9 UserDataManager - delete method - deletes wordItem only in remote with onlyRemote param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // created both in local and remote
    await udm.create({ dataObj: testWordItem }) 
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1)

    // delete
    await udm.delete({ dataObj: testWordItem }, { onlyRemote: true })
    await timeout(5000)
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')

    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // has no in remote
    
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in remote
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('10 UserDataManager - delete method - deletes wordItem both in remote and local without additional params', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    // make sure that in remote there are no words
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    // created both in local and remote
    await udm.create({ dataObj: testWordItem })
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1)

    // delete
    await udm.delete({ dataObj: testWordItem })
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // has no in remote
    
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)

    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // has no in remote
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 50000)

  it('11 UserDataManager - deleteMany method - deletes all wordItems for given languageCode only in local with onlyLocal param', async () => {
    let testWordItem1 = await prepareWordItem('elapsas')
    let testWordItem2 = await prepareWordItem('caeli')
    let testWordItem3 = await prepareWordItem('ἔννεπε', Constants.LANG_GREEK)
    let checkDataItems 

    let udm = new UserDataManager('alpheiosMockUser')

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'grc' }})

    // created both in local and remote
    await udm.create({ dataObj: testWordItem1 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem2 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem3 })
    await timeout(5000)
    
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.length).toEqual(2)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }})
    await timeout(5000)
    expect(checkDataItems.length).toEqual(1)  

    // delete
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }}, { onlyLocal: true })
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.length).toEqual(0) // has no in local lat

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0) // still has in local grc

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0) // has in remote lat
    
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'grc' }})
    
  }, 500000)

  it('12 UserDataManager - deleteMany method - deletes all wordItems for given languageCode only in remote with onlyRemote param', async () => {
    let testWordItem1 = await prepareWordItem('elapsas')
    let testWordItem2 = await prepareWordItem('caeli')
    let testWordItem3 = await prepareWordItem('ἔννεπε', Constants.LANG_GREEK)

    let udm = new UserDataManager('alpheiosMockUser')

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    // created both in local and remote
    await udm.create({ dataObj: testWordItem1 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem2 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem3 })
    await timeout(5000)

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }})
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0)

    // delete
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }}, { onlyRemote: true })
    await timeout(5000)
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')

    await timeout(5000)
    expect(checkDataItems.length).toEqual(0) // has no in remote lat

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }}, 'remote')
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0) // still has in local grc

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0) // has in remote lat

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  }, 500000)

  it('13 UserDataManager - deleteMany method - deletes all wordItems for given languageCode both in local and remote without additional parameters', async () => {
    let testWordItem1 = await prepareWordItem('elapsas')
    let testWordItem2 = await prepareWordItem('caeli')
    let testWordItem3 = await prepareWordItem('ἔννεπε', Constants.LANG_GREEK)

    let udm = new UserDataManager('alpheiosMockUser')

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    // created both in local and remote
    await udm.create({ dataObj: testWordItem1 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem2 })
    await timeout(5000)

    await udm.create({ dataObj: testWordItem3 })
    await timeout(5000)

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }})
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0)

    // delete
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await timeout(5000)

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    await timeout(5000)

    expect(checkDataItems.length).toEqual(0) // has no in remote lat
    
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    await timeout(5000)
    expect(checkDataItems.length).toEqual(0) // has no in local lat

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'grc' }})
    await timeout(5000)
    expect(checkDataItems.length).toBeGreaterThan(0) // still has grc

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
   
  }, 500000)

})