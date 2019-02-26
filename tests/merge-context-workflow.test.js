/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { ClientAdapters } from 'alpheios-client-adapters'

import { Constants, WordItem, TextQuoteSelector, LanguageModelFactory as LMF } from 'alpheios-data-models'
import UserDataManager from '@/controllers/user-data-manager'

import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver'
import RemoteDBAdapter from '@/storage/remote-db-adapter'

import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter'

import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

describe('merge-context-workflow.test.js', () => {
  // console.error = function () {}
  console.log = function () {}
  console.warn = function () {}

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

  async function prepareWordItem (word, contextData, lang = Constants.LANG_LATIN) {
    let langCode = LMF.getLanguageCodeFromId(lang)
    /*
    let adapterTuftsRes = await ClientAdapters.morphology.tufts({
    method: 'getHomonym',
    params: {
        languageID: lang,
        word: word
    }
    })

    let testHomonym = adapterTuftsRes.result
    */
    let context = []
    let tqselector = TextQuoteSelector.readObject({
    languageCode: langCode,
    targetWord: word,
    target: {
        source: contextData.source,
        selector: {
        exact: word,
        prefix: contextData.prefix,
        suffix: contextData.suffix
        }
    }
    })
    context.push(tqselector)

    return new WordItem({
    targetWord: word,
    languageCode: langCode,
    // homonym: testHomonym,
    context: context
    })
  }

  it.skip('1 MergeContextWorkflow - createAbsentRemoteItems, createAbsentLocalItems', async () => {
    let dbDriverRemote = new WordItemRemoteDbDriver('alpheiosMockUser')
    let remoteAdapter = new RemoteDBAdapter(dbDriverRemote)

    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let udm = new UserDataManager('alpheiosMockUser')

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let testWord1 = await prepareWordItem('caeli')
    testWord1.context[0].source = 'foosource1'
    testWord1.context[0].prefix = 'fooprefix1'
    testWord1.context[0].suffix = 'foosuffix1'

    let testWord2 = await prepareWordItem('caeli')
    testWord2.context[0].source = 'foosource2'
    testWord2.context[0].prefix = 'fooprefix2'
    testWord2.context[0].suffix = 'foosuffix2'

    await udm.create({ dataObj: testWord1 }, { onlyLocal: true })
    
    await udm.create({ dataObj: testWord2 }, { onlyRemote: true })

    let remoteItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(remoteItems[0].context.length).toEqual(1)
    expect(remoteItems[0].context[0].target.source).toEqual('foosource2')

    let localItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(localItems[0].context.length).toEqual(1)
    expect(localItems[0].context[0].source).toEqual('foosource1')
    
    await udm.createAbsentRemoteItems(localAdapter, remoteAdapter, localItems, remoteItems)
    
    remoteItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'remote')
    expect(remoteItems[0].context.length).toEqual(2)
    expect(remoteItems[0].context[0].target.source).toEqual('foosource2')
    expect(remoteItems[0].context[0].target.selector.prefix).toEqual('fooprefix2')
    expect(remoteItems[0].context[0].target.selector.suffix).toEqual('foosuffix2')
    expect(remoteItems[0].context[1].target.source).toEqual('foosource1')
    expect(remoteItems[0].context[1].target.selector.prefix).toEqual('fooprefix1')
    expect(remoteItems[0].context[1].target.selector.suffix).toEqual('foosuffix1')

    await udm.createAbsentLocalItems(localAdapter, remoteAdapter, localItems, remoteItems)
    localItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
    expect(localItems[0].context.length).toEqual(2)
    expect(localItems[0].context[0].source).toEqual('foosource1')
    expect(localItems[0].context[0].prefix).toEqual('fooprefix1')
    expect(localItems[0].context[0].suffix).toEqual('foosuffix1')

    expect(localItems[0].context[1].source).toEqual('foosource2')
    expect(localItems[0].context[1].prefix).toEqual('fooprefix2')
    expect(localItems[0].context[1].suffix).toEqual('foosuffix2')

   await timeout(5000)
  }, 50000)

  it.skip('2 MergeContextWorkflow - query merged', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let testWord1 = await prepareWordItem('caeli')
    testWord1.context[0].source = 'foosource1'
    testWord1.context[0].prefix = 'fooprefix1'
    testWord1.context[0].suffix = 'foosuffix1'

    let testWord2 = await prepareWordItem('caeli')
    testWord2.context[0].source = 'foosource2'
    testWord2.context[0].prefix = 'fooprefix2'
    testWord2.context[0].suffix = 'foosuffix2'

    await udm.create({ dataObj: testWord1 }, { onlyLocal: true })
    await udm.create({ dataObj: testWord2 }, { onlyRemote: true })

    let finalItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    for(let check = 0; check < 5; check++) {
      if (udm.requestsQueue.length > 0) {
        await timeout(5000)
      }
    }

    if (udm.requestsQueue.length === 0) {
      expect(finalItems.length).toEqual(1)
      expect(finalItems[0].context.length).toEqual(2)
      expect(finalItems[0].context.some(item => item.source === 'foosource1')).toBeTruthy()
      expect(finalItems[0].context.some(item => item.source === 'foosource2')).toBeTruthy()
    }
    await timeout(5000)
  }, 50000)

  it.skip('3 MergeContextWorkflow - merge several times', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    await udm.create({ dataObj: testWord1 }, { onlyLocal: true })
    await udm.create({ dataObj: testWord2 }, { onlyRemote: true })

    let finalItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    await timeout(5000)

    let testWord3 = await prepareWordItem('caeli', {
      source: 'foosource3',
      prefix: 'fooprefix3',
      suffix: 'foosuffix3'
    })
    await udm.update({ dataObj: testWord3 })

    console.info('*************finalItems', finalItems)
  }, 50000)

  it.skip('4 MergeContextWorkflow - create an item - no local, no remote', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let currentLocal = await localAdapter.query({ wordItem: testWord1 })
    // console.info('*************currentLocal', currentLocal)
    expect(currentLocal).toEqual([])

    let currentRemote = await remoteAdapter.query({ wordItem: testWord1 })
    // console.info('*************currentRemote', currentRemote)
    expect(currentRemote).toEqual([])

    if (currentLocal.length === 0) {
      await localAdapter.create(testWord1)
    }
    if (currentRemote.length === 0) {
      await remoteAdapter.create(testWord1)
    }
    
    currentLocal = await localAdapter.query({ wordItem: testWord1 })
    expect(currentLocal.length).toEqual(1)
    expect(currentLocal[0].context.length).toEqual(1)
    expect(currentLocal[0].context[0].source).toEqual('foosource1')
    console.info('*************currentLocal after', currentLocal)
    // expect(currentLocal).toEqual([])

    currentRemote = await remoteAdapter.query({ wordItem: testWord1 })
    console.info('*************currentRemote after', currentRemote)
    expect(currentRemote[0].context.length).toEqual(1)
    expect(currentRemote[0].context[0].target.source).toEqual('foosource1')
    // expect(currentRemote).toEqual([])
  })

  it.skip('5 MergeContextWorkflow - create an item with another context - has in local, has in remote, they are equal', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await localAdapter.create(testWord1)
    await remoteAdapter.create(testWord1)

    /*****************start with creating testWord2******/
    let currentLocal = await localAdapter.query({ wordItem: testWord2 })
    let updateLocal = localAdapter.dbDriver.comparePartly(currentLocal[0], testWord2)

    await localAdapter.update(updateLocal)
    expect(updateLocal.context.length).toEqual(2)

    let currentRemote = await remoteAdapter.query({ wordItem: testWord2 })
    let updateRemote = remoteAdapter.dbDriver.comparePartly(currentRemote[0], testWord2)

    await remoteAdapter.update(updateLocal)
    expect(updateRemote.context.length).toEqual(2)
    
  })

  it.skip('6 MergeContextWorkflow - create an item with another context - has in local, has in remote, they are equal', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    let testWord3 = await prepareWordItem('caeli', {
      source: 'foosource3',
      prefix: 'fooprefix3',
      suffix: 'foosuffix3'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await localAdapter.create(testWord1)
    await remoteAdapter.create(testWord2)

    /*****************start with creating testWord3******/
    let currentLocal = await localAdapter.query({ wordItem: testWord3 })
    let currentRemote = await remoteAdapter.query({ wordItem: testWord3 })

    let updateLocalStep1 = localAdapter.dbDriver.comparePartly(currentLocal[0], currentRemote[0])
    let updateLocalStep2 = localAdapter.dbDriver.comparePartly(updateLocalStep1, testWord3)

    console.info('***************updateLocalStep1', updateLocalStep1)
    console.info('***************updateLocalStep2', updateLocalStep2)

    await remoteAdapter.update(updateLocalStep2)
    
  })

  it('7 MergeContextWorkflow - create an item with userDataManager.create - no local, no remote', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    let testWord3 = await prepareWordItem('caeli', {
      source: 'foosource3',
      prefix: 'fooprefix3',
      suffix: 'foosuffix3'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    await udm.create({dataObj: testWord1})
    let currentLocal = await localAdapter.query({ wordItem: testWord3 })
    expect(currentLocal[0].context.length).toEqual(1)
    
    let currentRemote = await remoteAdapter.query({ wordItem: testWord3 })
    expect(currentRemote[0].context.length).toEqual(1)
  }, 50000)

  it('8 MergeContextWorkflow - create an item with userDataManager.create - has local, has remote, equal', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    let testWord3 = await prepareWordItem('caeli', {
      source: 'foosource3',
      prefix: 'fooprefix3',
      suffix: 'foosuffix3'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await localAdapter.create(testWord1)
    await remoteAdapter.create(testWord1)

    await udm.create({dataObj: testWord2})

    let currentLocal = await localAdapter.query({ wordItem: testWord3 })
    expect(currentLocal[0].context.length).toEqual(2)
    
    let currentRemote = await remoteAdapter.query({ wordItem: testWord3 })
    expect(currentRemote[0].context.length).toEqual(2)
  }, 50000)

  it('9 MergeContextWorkflow - create an item with userDataManager.create - has local, has remote, not equal', async () => {
    let udm = new UserDataManager('alpheiosMockUser')
    let finalConstrName = 'WordItem'

    let localAdapter = udm._localStorageAdapter(finalConstrName)
    let remoteAdapter = udm._remoteStorageAdapter(finalConstrName)

    let testWord1 = await prepareWordItem('caeli', {
      source: 'foosource1',
      prefix: 'fooprefix1',
      suffix: 'foosuffix1'
    })

    let testWord2 = await prepareWordItem('caeli', {
      source: 'foosource2',
      prefix: 'fooprefix2',
      suffix: 'foosuffix2'
    })

    let testWord3 = await prepareWordItem('caeli', {
      source: 'foosource3',
      prefix: 'fooprefix3',
      suffix: 'foosuffix3'
    })

    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
    await localAdapter.create(testWord1)
    await remoteAdapter.create(testWord2)

    await udm.create({dataObj: testWord3})

    let currentLocal = await localAdapter.query({ wordItem: testWord3 })
    expect(currentLocal[0].context.length).toEqual(3)
    
    let currentRemote = await remoteAdapter.query({ wordItem: testWord3 })
    expect(currentRemote[0].context.length).toEqual(3)
  }, 50000)
})