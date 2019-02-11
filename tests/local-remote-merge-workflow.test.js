/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import axios from 'axios'
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
    // console.info('**************tqselector', tqselector)
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
    console.info('******************result remote query', resultQuery)
  })

  it.skip('4 LocalRemoteMergeWorkflow - createAbsentLocalItems creates in local absent wordItems', async () => {
    let udm = new UserDataManager()
    let resultRemoteQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'remote')
    // console.info('****************resultRemoteQuery', resultRemoteQuery)

    let localDataItems = []
    let remoteDataItems = resultRemoteQuery.slice(0, 1)
    console.info('********************remoteDataItems', remoteDataItems)
    
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let dbDriverRemote = new WordItemRemoteDbDriver()
    let mergedResult = udm.createAbsentLocalItems(dbDriverLocal, dbDriverRemote, localDataItems, remoteDataItems)
    
    let resultLocalQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'local')
    console.info('****************resultRemoteQuery', resultLocalQuery)
  })

  it.skip('5 LocalRemoteMergeWorkflow - query with local absent wordItems', async () => {
    let udm = new UserDataManager()

    let resultRemoteQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'remote')
    console.info('***************resultRemoteQuery', resultRemoteQuery)

    let resultLocalQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'local')
    console.info('****************resultLocalQuery', resultLocalQuery)

    let resultQuery = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }})
    console.info('***************resultQuery', resultQuery)

    let resultLocalQueryFinal = await udm.query({ dataType: 'WordItem', params: { languageCode: Constants.STR_LANG_CODE_LAT }}, 'local')
    console.info('****************resultLocalQueryFinal', resultLocalQueryFinal)
  })

  it.skip('6 LocalRemoteMergeWorkflow - query with remote absent', async () => {
    /*
    let testLocalItem = await prepareWordItem('placito')
    let udm = new UserDataManager()
    let result = await udm.create({ dataObj: testLocalItem }, { onlyRemote: true })
    console.info('*****************result create remote', result)
    */
    let dbDriverRemote = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(dbDriverRemote)
/*
    let url = dbDriverRemote.storageMap.post.url(data)
    let content = dbDriverRemote.storageMap.post.serialize(data)
*/
    let url = 'https://w2tfh159s2.execute-api.us-east-2.amazonaws.com/prod/words/lat-placito'

    let content = {
      "ID":"lat-uestem",
      "listID":"alpheiosMockUser-lat",
      "userID":"alpheiosMockUser",
      "languageCode":"lat",
      "targetWord":"uestem",
      "important": false,
      "createdDT":"2019/02/11 @ 16:28:18",
      "homonym":{"targetWord":"uestem","lemmasList":"uestem"},
      "context":[
        {
          "target":{
          "source":"http://localhost:8888/demo/",
          "selector": {
            "type":"TextQuoteSelector",
            "exact":"uestem",
            "prefix":"a bene ",
            "languageCode":"lat",
            "suffix":" "
          },
          /*"selector":
            {"type":"TextQuoteSelector","exact":"uestem","prefix":"a bene ","suffix":"","languageCode":"lat"}*/
          },
          "languageCode":"lat",
          "targetWord":"uestem",
          "createdDT":"2019/02/11 @ 16:28:18"
        }
      ]
    }

    let result = await axios.post(url, content, dbDriverRemote.requestsParams)
    console.info('*******************LocalRemoteMergeWorkflow result', result.status, result.statusText)

  })

  it('7 LocalRemoteMergeWorkflow - delete all in remote', async () => {
    let udm = new UserDataManager()
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
  })
})