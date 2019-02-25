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

  async function prepareWordItem (word, lang = Constants.LANG_LATIN) {
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

  it('2 MergeContextWorkflow - query merged', async () => {
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
})