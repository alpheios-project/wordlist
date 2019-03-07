/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { ClientAdapters } from 'alpheios-client-adapters'
import { Constants, WordItem, TextQuoteSelector, LanguageModelFactory as LMF } from 'alpheios-data-models'
import UserDataManager from '@/controllers/user-data-manager'

import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver.js'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver.js'
import IndexedDBAdapter from '@/storage/indexed-db-adapter.js'
import RemoteDBAdapter from '@/storage/remote-db-adapter.js'

import axios from 'axios'

import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

describe('new-merge-worditem.test.js', () => {
  // console.error = function () {}
  console.log = function () {}
  console.warn = function () {}

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

  function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async function getWordItemStep1 (targetWord, languageCode, contextData = {}) {
    let wordItem = new WordItem({ targetWord, languageCode })

    let tqselector = TextQuoteSelector.readObject({
      languageCode: languageCode,
      targetWord: targetWord,
      target: {
        source: contextData.source || 'foosource',
        selector: {
        exact: targetWord,
        prefix: contextData.prefix || 'fooprefix',
        suffix: contextData.suffix || 'foosuffix'
        }
      }
    })
    wordItem.addContext([tqselector])
    return wordItem
  }

  async function getWordItemStep2 (wordItem) {
    let langId = LMF.getLanguageIdFromCode(wordItem.languageCode)
    let adapterTuftsRes = await ClientAdapters.morphology.tufts({
      method: 'getHomonym',
      params: {
        languageID: langId,
        word: wordItem.targetWord
      }
    })
    let testHomonym = adapterTuftsRes.result
    wordItem.homonym = testHomonym
  }

  async function getWordItemStep3 (wordItem) {
    wordItem.gotLexemes = 0
    let adapterLexiconResFull = await ClientAdapters.lexicon.alpheios({
      method: 'fetchFullDefs',
      params: {
        opts: {
          allow: ['https://github.com/alpheios-project/ls']
        },
        homonym: wordItem.homonym,
        callBackEvtSuccess: { pub: () => { wordItem.gotLexemes = wordItem.gotLexemes + 1 } }
      }
    })
  }

  function mergeRemoteContext (currentItem, newItem, remoteDbDriver) {
    currentItem.important = currentItem.important || newItem.important
    currentItem.homonym = currentItem.homonym || newItem.homonym

    let pushContext = currentItem.context
    // console.info('************currentItem.context', currentItem.context)
    // console.info('************newItem.context', newItem.context)
    for (let contextItem of newItem.context) {
      let hasCheck = currentItem.context.some(tqChange => {       
        return TextQuoteSelector.readObject(tqChange).isEqual(contextItem) 
      })
      if (!hasCheck) {
        // console.info('*****contextTemp contextItem', contextItem)
        let contextTemp = remoteDbDriver._serializeContextItem(contextItem, currentItem)
        
        // console.info('*****contextTemp contextTemp', contextTemp)
        pushContext.push(remoteDbDriver._serializeContextItem(contextItem, currentItem))
      }
    }
    currentItem.context = pushContext
    return currentItem
  }

  async function updateRemote (remoteAdapter, wordItem, segment) {
    let segmentsForUpdate = ['common', 'context', 'shortHomonym']
    if (segmentsForUpdate.includes(segment)) {
      let currentItems = await remoteAdapter.query({ wordItem })
      if (currentItems.length === 0) {
        await remoteAdapter.create(wordItem)
      } else {
        let resultWordItem = mergeRemoteContext(currentItems[0], wordItem, remoteAdapter.dbDriver)
        // console.info('******resultWordItem', resultWordItem)
        await remoteAdapter.update(resultWordItem)
      }
    }
  }

  async function updateLocal (localAdapter, wordItem, segment, remoteAdapter) {  
    let currentItems 
    if (segment === 'context' && remoteAdapter)  {
      currentItems = await remoteAdapter.query({ wordItem })
      if (currentItems.length > 0) {
        wordItem.context = []
        for(let contextItem of currentItems[0].context) {
          wordItem.context.push(WordItem.readContext([contextItem])[0])
        }
      }
    }
    console.info('*****updateLocal', wordItem)
    currentItems = await localAdapter.query({ wordItem })
    if (currentItems.length === 0) {
      await localAdapter.update(wordItem, { segment: 'common' })  
    }
    await localAdapter.update(wordItem, { segment })
  }

  it('1 test creation', async () => {
    // onTextQuoteSelectorReceived
    let dbDriverRemote = new WordItemRemoteDbDriver('alpheiosMockUser')
    let remoteAdapter = new RemoteDBAdapter(dbDriverRemote)

    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let currentItems

    let udm = new UserDataManager('alpheiosMockUser')
    /*
    await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})

    let testWordItem = await getWordItemStep1('beautum', 'lat')
    console.info('*****onTextQuoteSelectorReceived', testWordItem)

    let promiseR1 =  await updateRemote(remoteAdapter, testWordItem, 'common')
    let promiseL1 =  await updateLocal(localAdapter, testWordItem, 'common')

    let promiseR2 =  await updateRemote(remoteAdapter, testWordItem, 'context', remoteAdapter)
    let promiseL2 =  await updateLocal(localAdapter, testWordItem, 'context', remoteAdapter)

    let promise3 =  await getWordItemStep2(testWordItem).then(async (result) => {
      console.info('*****onHomonymReady', testWordItem)
      await updateRemote(remoteAdapter, testWordItem, 'shortHomonym')
      await updateLocal(localAdapter, testWordItem, 'shortHomonym')
      return true
    })

    
    let promise4 =  await getWordItemStep3(testWordItem).then(async (result) => {
      console.info('*****onDefinitionsReady start', testWordItem)

      let startGotLexemes = 0
      for(let i=0; i<35; i++) {
        await timeout(500)
        if (startGotLexemes < testWordItem.gotLexemes) {
          for (let k=startGotLexemes; k<testWordItem.gotLexemes; k++) {
            // onDefinitionsReady
            console.info('*****onDefinitionsReady', k)
            await updateRemote(remoteAdapter, testWordItem, 'fullHomonym')
            await updateLocal(localAdapter, testWordItem, 'fullHomonym')
          }
          startGotLexemes = testWordItem.gotLexemes
        }
        if (testWordItem.gotLexemes === testWordItem.homonym.lexemes.length) {
          break
        }
      }
      return true
    })

    
    currentItems = await localAdapter.query({ wordItem: testWordItem })
    console.info('*****final local', currentItems)
    
    currentItems = await remoteAdapter.query({ wordItem: testWordItem })
    console.info('*****final remote1', currentItems)
    console.info('*****final remote2', currentItems[0].context)
    currentItems[0].context.forEach(contextItem => {
      console.info('*****final remote3', contextItem.target.selector)
    })
    */
    //*************************add new context
    let testWordItem2 = await getWordItemStep1('cepit', 'lat', {
      source: 'source3',
      prefix: 'prefix3',
      suffix: 'suffix3'
    })
    let testWordItem3 = await getWordItemStep1('cepit', 'lat', {
      source: 'source4',
      prefix: 'prefix4',
      suffix: 'suffix4'
    })

    await updateRemote(remoteAdapter, testWordItem2, 'context')
    await updateRemote(remoteAdapter, testWordItem3, 'context')
/*
    currentItems = await remoteAdapter.query({ wordItem: testWordItem })
    console.info('*****final remote1-1', currentItems)
    console.info('*****final remote2-1', currentItems[0].context)
    currentItems[0].context.forEach(contextItem => {
      console.info('*****final remote3-1', contextItem.target.selector)
    })
    */
    await updateLocal(localAdapter, testWordItem2, 'context', remoteAdapter)
    // await updateLocal(localAdapter, testWordItem3, 'context', remoteAdapter)

    await getWordItemStep2(testWordItem2)
    await updateLocal(localAdapter, testWordItem2, 'shortHomonym')
    await timeout(5000)
    
    currentItems = await localAdapter.query({ wordItem: testWordItem2 })
    console.info('*****final local2-1', currentItems)
    // console.info('*****final local2-2', currentItems[0].context)
    // console.info('*****final local2-3', currentItems[0].context[0])
    
    await timeout(5000)
    // return final
  }, 50000)
  
})