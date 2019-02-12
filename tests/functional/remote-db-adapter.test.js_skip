/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { Constants, WordItem } from 'alpheios-data-models'
import { ClientAdapters } from 'alpheios-client-adapters'

import RemoteDBAdapter from '@/storage/remote-db-adapter'
import WordItemRemoteDbDriver from '@/storage/worditem-remotedb-driver'

describe('remote-db-adapter.test.js', () => {
  // console.error = function () {}
  console.log = function () {}
  console.warn = function () {}
  
  let testWord = 'provincias'
  let testHomonym

  beforeAll(async () => {
    let adapterTuftsRes = await ClientAdapters.morphology.tufts({
      method: 'getHomonym',
      params: {
        languageID: Constants.LANG_LATIN,
        word: testWord
      }
    })
    testHomonym = adapterTuftsRes.result
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

  it.skip('1 RemoteDBAdapter - create a new wordItem', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let testWordItem = new WordItem({
      targetWord: 'provincias',
      languageCode: Constants.STR_LANG_CODE_LAT,
      homonym: testHomonym
    })

    let result = await remoteAdapter.create(testWordItem)
    expect(result).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)

    result = await remoteAdapter.query({ wordItem: testWordItem })
    console.info('*************result', result)
    expect(result.targetWord).toEqual('provincias')
    expect(remoteAdapter.errors.length).toEqual(0)
  })

  it.skip('2 RemoteDBAdapter - update an existed wordItem', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let testWordItem = new WordItem({
      targetWord: 'provincias',
      languageCode: Constants.STR_LANG_CODE_LAT,
      important: true,
      homonym: testHomonym
    })

    let result = await remoteAdapter.update(testWordItem)
    console.info(remoteAdapter.errors)
    expect(result).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)

    result = await remoteAdapter.query({ wordItem: testWordItem })
    // console.info('********************result', result)
    expect(result.targetWord).toEqual('provincias')
    expect(result.important).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)
  })

  it.skip('3 RemoteDBAdapter - get an wordItem', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let testWordItem = new WordItem({
      targetWord: 'provincias',
      languageCode: Constants.STR_LANG_CODE_LAT,
      homonym: testHomonym
    })

    let result = await remoteAdapter.query({ wordItem: testWordItem })
    // console.info('*****************GET result', result)

    expect(result.targetWord).toEqual('provincias')
    expect(remoteAdapter.errors.length).toEqual(0)
  })

  it.skip('4 RemoteDBAdapter - get all wordItems', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let result = await remoteAdapter.query({ languageCode: Constants.STR_LANG_CODE_LAT })
    console.info('*****************GET result', result)

    expect(result.some(item => item.targetWord === 'provincias')).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)
  })

  it.skip('5 RemoteDBAdapter - delete one existed wordItem', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let testWordItem = new WordItem({
      targetWord: 'provincias',
      languageCode: Constants.STR_LANG_CODE_LAT,
      homonym: testHomonym
    })

    let result = await remoteAdapter.deleteOne(testWordItem)
    expect(result).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)

    result = await remoteAdapter.query({ languageCode: Constants.STR_LANG_CODE_LAT })

    console.info('Query all', result)
    expect(result.some(item => item.tragetWord === 'provincias')).toBeFalsy()
    expect(remoteAdapter.errors.length).toEqual(0)
  })

  it.skip('6 RemoteDBAdapter - delete all wordItem', async () => {
    let remoteAdapterDriver = new WordItemRemoteDbDriver()
    let remoteAdapter = new RemoteDBAdapter(remoteAdapterDriver)

    let result = await remoteAdapter.deleteMany({ languageCode: Constants.STR_LANG_CODE_LAT })
    expect(result).toBeTruthy()
    expect(remoteAdapter.errors.length).toEqual(0)

    result = await remoteAdapter.query({ languageCode: Constants.STR_LANG_CODE_LAT })

    expect(result.length).toEqual(0)
    expect(remoteAdapter.errors.length).toEqual(0)
  })
})