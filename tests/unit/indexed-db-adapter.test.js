/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'
import { ClientAdapters } from 'alpheios-client-adapters'
import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver'
import IndexedDBAdapter from '@/storage/indexed-db-adapter'
import axios from 'axios'
import { WordItem, Constants, TextQuoteSelector } from 'alpheios-data-models'

import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

describe('indexed-db-adapter.test.js', () => {
  console.error = function () {}
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
  
  it('1 IndexedDBAdapter - constructor creates object with the following properties: dbDriver, available, errors', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    expect(localAdapter.dbDriver).toEqual(dbDriverLocal)
    expect(localAdapter.available).toBeTruthy()
    expect(localAdapter.errors).toEqual([])
  })

  it('2 IndexedDBAdapter - create method executes update with each segment from WordItemIndexedDbDriver and saves data to IndexedDB', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let testWordItem = new WordItem({
      targetWord: 'tuli',
      languageCode: Constants.STR_LANG_CODE_LAT
    })

    jest.spyOn(localAdapter, 'update')

    let result = await localAdapter.create(testWordItem)
    expect(result).toBeTruthy()
    expect(localAdapter.update).toHaveBeenCalledTimes(dbDriverLocal.segments.length)

    let localItems = await localAdapter.query({languageCode: 'lat'})
    expect(localItems[0].targetWord).toEqual('tuli')
    await localAdapter.deleteMany({languageCode: 'lat'})
  })

  it('3 IndexedDBAdapter - create method saves error to errors property', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    localAdapter.update = jest.fn(() => { throw new Error('Something is wrong') })

    let result = await localAdapter.create()
    expect(result).toBeFalsy()
    expect(localAdapter.errors.length).toEqual(1)
    expect(localAdapter.errors[0].message).toEqual('Something is wrong')

    let localItems = await localAdapter.query({languageCode: 'lat'})
    expect(localItems.length).toEqual(0)
  })

  it('4 IndexedDBAdapter - deleteMany method executes segmentDeleteManyQuery and _deleteFromStore for each segment from WordItemIndexedDbDriver', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    let testWordItem = new WordItem({
      targetWord: 'tuli',
      languageCode: Constants.STR_LANG_CODE_LAT
    })

    await localAdapter.create(testWordItem)

    jest.spyOn(localAdapter, '_deleteFromStore')
    jest.spyOn(dbDriverLocal, 'segmentDeleteManyQuery')

    let result = await localAdapter.deleteMany({languageCode: 'lat'})
    expect(result).toBeTruthy()
    expect(localAdapter._deleteFromStore).toHaveBeenCalledTimes(dbDriverLocal.segments.length)
    expect(dbDriverLocal.segmentDeleteManyQuery).toHaveBeenCalledTimes(dbDriverLocal.segments.length)

    let localItems = await localAdapter.query({languageCode: 'lat'})
    expect(localItems.length).toEqual(0)
    await localAdapter.deleteMany({languageCode: 'lat'})
  })

  it('5 IndexedDBAdapter - deleteMany method saves error to errors property', async () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('alpheiosMockUser')
    let localAdapter = new IndexedDBAdapter(dbDriverLocal)

    localAdapter._deleteFromStore = jest.fn(() => { throw new Error('Something is wrong') })

    let result = await localAdapter.deleteMany({languageCode: 'lat'})
    expect(result).toBeFalsy()
    expect(localAdapter.errors.length).toEqual(1)
    expect(localAdapter.errors[0].message).toEqual('Something is wrong')
  })
})