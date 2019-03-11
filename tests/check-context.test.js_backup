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

    async function prepareWordItem (word, contextData = {}, lang = Constants.LANG_LATIN) {
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
          source: contextData.source || 'foosource',
          selector: {
          exact: word,
          prefix: contextData.prefix || 'fooprefix',
          suffix: contextData.suffix || 'foosuffix'
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

    it('1 test creation', async () => {
      let checkDataItems
      let udm = new UserDataManager('alpheiosMockUser')
    
      // await udm.deleteMany({ dataType: 'WordItem', params: { languageCode: 'lat' }})
      // await timeout(5000)
      // checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }}, 'local')
      // console.info('*****checkDataItems before', checkDataItems)

      let testWordItem = await prepareWordItem('beatum')
      await udm.create({ dataObj: testWordItem })
      await udm.create({ dataObj: testWordItem })
    
      // await timeout(5000)
      checkDataItems = await udm.query({ dataType: 'WordItem', params: { languageCode: 'lat' }})

      console.info('*****checkDataItems3', checkDataItems[0].context)

      await timeout(5000)
    }, 50000)
})