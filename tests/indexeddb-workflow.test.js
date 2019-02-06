/* eslint-env jest */
/* eslint-disable no-unused-vars */
import axios from 'axios'
import { Constants, WordItem } from 'alpheios-data-models'
import IndexedDBAdapter from '@/storage/indexed-db-adapter'
import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver'
import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

describe('indexeddb-workflow.test.js', () => {
  // console.error = function () {}
  console.log = function () {}
  console.warn = function () {}

  let remoteUrl = 'https://w2tfh159s2.execute-api.us-east-2.amazonaws.com/prod'
  let testID = 'alpheiosMockUserIdlP0DWnmNxe'
  let testUserID = 'alpheiosMockUser'

  axios.defaults.baseURL = remoteUrl
  axios.defaults.headers.common['Authorization'] = 'bearer ' + testID
  // axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'

  let testWordItem1 = new WordItem({
    targetWord: 'tuli',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  let testWordItem2 = new WordItem({
    targetWord: 'bene',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  let testWordItem3 = new WordItem({
    targetWord: 'caeli',
    languageCode: Constants.STR_LANG_CODE_LAT
  })

  function makeID (wordItem) {
    return `${wordItem.languageCode}-${wordItem.targetWord}`
  }

  function serializeCommon (wordItem) {
    let testWordItemID = `${wordItem.languageCode}-${wordItem.targetWord}`
    return {
      ID: testWordItemID,
      listID: testUserID + '-' + wordItem.languageCode,
      userID: testUserID,
      languageCode: wordItem.languageCode,
      targetWord: wordItem.targetWord,
      important: wordItem.important,
      createdDT: WordItemIndexedDbDriver.currentDate
    }
  
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

  function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  it.skip('1 IndexedDBWorkflow - check IndexedDB availability', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    expect(localAdapter.available).toBeTruthy()
  })

  it.skip('2 IndexedDBWorkflow - update method', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver()
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let updatedLocal = await localAdapter.update(testWordItem, { segment: 'common' })
    expect(updatedLocal).toBeTruthy()
    
    let localDataItems = await localAdapter.query({ languageCode: testWordItem.languageCode })
    console.info('localDataItems', localDataItems)
    expect(localDataItems.filter(wordItem => wordItem.targetWord === testWordItem.targetWord).length).toBeGreaterThan(0)
  })

  it('3 IndexedDBWorkflow - update data remotely', async () => {
    try {
      let postUrl = encodeURI('/words/' + makeID(testWordItem1))
      let resPost = await axios.post(postUrl, { body: serializeCommon(testWordItem1) })
      console.info('Post res1', resPost.status, resPost.statusText, resPost.data)

      postUrl = encodeURI('/words/' + makeID(testWordItem3))
      resPost = await axios.post(postUrl, { body: serializeCommon(testWordItem3) })
      
      console.info('Post res2', resPost.status, resPost.statusText, resPost.data)
      
      let getUrl = encodeURI('/words?languageCode=lat')
      let resGet = await axios.get(getUrl)
      console.info('GET res', getUrl, resGet.status, resGet.statusText, resGet.data)

      await timeout(5000)
    } catch (error) {
      console.error('Axios Error', error.response.status, error.response.statusText, error.message)
      // console.error('Full axios', error)
    }
  }, 50000)

  it.skip('4 IndexedDBWorkflow - query all remotely', async () => {
    let getUrl = encodeURI('/words?languageCode=lat')
    
    try {
      let res = await axios.get(getUrl)
      console.info('GET res', res.status, res.statusText, res.data)
    } catch (error) {
      console.error('Axios Error', error.response.status, error.response.statusText, error.message)
      // console.error('Full axios', error)
    }
  })

  it.skip('5 IndexedDBWorkflow - query one remotely', async () => {  
    let getUrl, res
    try {
      let getUrl = encodeURI('/words/' + makeID(testWordItem1))
      let res = await axios.get(getUrl)
      console.info('GET res', getUrl, res.status, res.statusText, res.data)
      
      getUrl = encodeURI('/words/' + makeID(testWordItem2))
      res = await axios.get(getUrl)
      console.info('GET res', getUrl, res.status, res.statusText, res.data)      
    } catch (error) {
      console.error('Axios Error', error.response.status, error.response.statusText, error.message)
      console.error('Full axios', error)
    }
  })

  it.skip('6 IndexedDBWorkflow - delete all remotely', async () => {
    let deleteUrl = encodeURI('/words?languageCode=lat')
    
    try {
      let res = await axios.delete(deleteUrl)
      console.info('Delete res', res.status, res.statusText, res.data)
    } catch (error) {
      console.error('Axios Error', error.response.status, error.response.statusText, error.message)
      // console.error('Full axios', error)
    }
  })

})