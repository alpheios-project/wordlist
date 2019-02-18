/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { ClientAdapters } from 'alpheios-client-adapters'
import { Constants, WordItem, TextQuoteSelector } from 'alpheios-data-models'
import UserDataManager from '@/controllers/user-data-manager'

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

  async function prepareWordItem (word) {
    let adapterTuftsRes = await ClientAdapters.morphology.tufts({
      method: 'getHomonym',
      params: {
        languageID: Constants.LANG_LATIN,
        word: word
      }
    })

    let testHomonym = adapterTuftsRes.result
    
    let context = []
    let tqselector = TextQuoteSelector.readObject({
      languageCode: Constants.STR_LANG_CODE_LAT,
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
      languageCode: Constants.STR_LANG_CODE_LAT,
      homonym: testHomonym,
      context: context
    })
  }

  it('1 UserDataManager - delete many and update method, checking blocking', async () => {
    let udm = new UserDataManager(testUserID)

    let res1 = udm.update({ dataObj: testWordItem1, params: { segment: 'common' }})
    let res2 = udm.update({ dataObj: testWordItem2, params: { segment: 'common' }})
    let res3 = udm.update({ dataObj: testWordItem3, params: { segment: 'common' }})

    let res4 = udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    let res5 = udm.update({ dataObj: testWordItem3, params: { segment: 'common' }})

    let final = [await res1, await res2, await res3, await res4, await res5]

    await timeout(5000)
    let localDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    console.info('**************localDataItems', localDataItems)
    expect(localDataItems.filter(item => item.targetWord === testWordItem1.targetWord).length).toEqual(0)
    expect(localDataItems.filter(item => item.targetWord === testWordItem2.targetWord).length).toEqual(0)
    expect(localDataItems.filter(item => item.targetWord === testWordItem3.targetWord).length).toEqual(1)
    return localDataItems
  }, 50000)

  it('2 UserDataManager - create method - creates wordItem only in local with onlyLocal param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    /*** make sure that in remote there are no words */
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    /*** create the word only in local */
    await udm.create({ dataObj: testWordItem }, { onlyLocal: true })

    // console.info('*****************local')
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // has in local

    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // does not have in remote
  }, 50000)

  it('3 UserDataManager - create method - creates wordItem only in remote with onlyRemote param', async () => {
    let testWord = 'elapsas'
    let testWordItem = await prepareWordItem(testWord)
    let udm = new UserDataManager('alpheiosMockUser')
    
    /*** make sure that in remote there are no words */
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0)

    /*** create the word only in remote */
    await udm.create({ dataObj: testWordItem }, { onlyRemote: true })

    // console.info('*****************local')
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(0) // has in local

    // console.info('********************************************check here')
    checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(checkDataItems.filter(item => item.targetWord === testWord).length).toEqual(1) // does not have in remote
  }, 50000)


})