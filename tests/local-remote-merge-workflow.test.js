/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { Constants, WordItem, TextQuoteSelector } from 'alpheios-data-models'
import { ClientAdapters } from 'alpheios-client-adapters'

import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

import RemoteDBAdapter from '@/storage/remote-db-adapter'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver'
import IndexedDBAdapter from '@/storage/indexed-db-adapter'
import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver'

import UserDataManager from '@/controllers/user-data-manager'

describe('local-remote-merge-workflow.test.js', () => {
  // console.error = function () {}
  // console.log = function () {}
  // console.warn = function () {}
  
  let testWord = 'provincias'

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
      targetWord: testWord,
      target: {
        source: 'foosource',
        selector: {
          exact: word,
          prefix: 'fooprefix',
          suffix: 'foosuffix'
        }
      }
    })
    console.info('**************tqselector', tqselector)
    context.push(tqselector)

    return new WordItem({
      targetWord: word,
      languageCode: Constants.STR_LANG_CODE_LAT,
      homonym: testHomonym,
      context: context
    })
  }

  beforeAll( async () => {
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

  function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  it.skip('1 LocalRemoteMergeWorkflow - recieved wordItem, save to local and remote', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let dbDriverRemote = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(dbDriverRemote)

    let testWordItem = await prepareWordItem(testWord)

    let createResultLocal = await localAdapter.create(testWordItem)
    console.info('***************createResultLocal', createResultLocal)
    let localDataItems = await localAdapter.query({ languageCode: testWordItem.languageCode })
    console.info('**************localDataItems', localDataItems)
    
    let createResultRemote = await remoteAdapter.create(testWordItem)
    console.info('**************createResultRemote', createResultRemote)
    /*
    expect(createResultRemote).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)

    let remoteDataItems = await remoteAdapter.query({ wordItem: testWordItem })
    console.info('********************remoteDataItems', remoteDataItems)
    */

    return createResultLocal && createResultRemote
  }, 50000)

  it.skip('2 LocalRemoteMergeWorkflow - recieved wordItem, save to local and remote via UserDataManager', async () => {
    let testWordItem = await prepareWordItem('mala')
    let udm = new UserDataManager()
    
    let resultCreate = await udm.create({ dataObj: testWordItem })
    expect(resultCreate).toBeTruthy()

    let resultQuery = await udm.query({ dataType: 'WordItem', params: { wordItem: {languageCode: testWordItem.languageCode, targetWord: testWordItem.targetWord} }})
    console.info('*****************resultQuery', resultQuery)
    /*
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let localDataItems = await localAdapter.query({ languageCode: testWordItem.languageCode })
    console.info('**************localDataItems', localDataItems)

    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let remoteDataItems = await remoteAdapter.query({ wordItem: testWordItem })
    console.info('**************remoteDataItems', remoteDataItems)
    */
  })

  it.skip('3 LocalRemoteMergeWorkflow - createAbsentRemoteItems creates in remote absent wordItems', async () => {
    let testWordItem = await prepareWordItem('latus')
    let localDataItems = [ testWordItem ]
    let remoteDataItems = []
    let udm = new UserDataManager()

    let dbDriverRemote = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(dbDriverRemote)

    let resDelete = await remoteAdapter.deleteMany({ languageCode: Constants.STR_LANG_CODE_LAT })
    
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let result = await udm.createAbsentRemoteItems(dbDriverLocal, dbDriverRemote, localDataItems, remoteDataItems)

    let resultQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'remote')
    console.info('******************result remote query', resultQuery[0].context)
    console.info('******************result remote query', resultQuery[0].context[0].target.selector)
  })

  it('4 LocalRemoteMergeWorkflow - createAbsentLocalItems creates in local absent wordItems', async () => {
    let udm = new UserDataManager()
    let resultRemoteQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'remote')
    // console.info('****************resultRemoteQuery', resultRemoteQuery)

    let localDataItems = []
    let remoteDataItems = resultRemoteQuery.slice(0, 1)
    console.info('********************remoteDataItems', remoteDataItems)

    let dbDriverLocal = new WordItemIndexedDbDriver()
    let dbDriverRemote = new WordItemRemoteDbDriver()
    let mergedResult = udm.createAbsentLocalItems(dbDriverLocal, dbDriverRemote, localDataItems, remoteDataItems)
  })
})