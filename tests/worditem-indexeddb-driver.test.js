/* eslint-env jest */
/* eslint-disable no-unused-vars */
import IndexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

import { WordItem } from 'alpheios-data-models'

import WordItemIndexedDbDriver from '@/storage/worditem-indexeddb-driver'

describe('worditem-indexeddb-driver.test.js', () => {
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

  it('1 WordItemIndexedDbDriver - constructor creates object with the following properties: userId, storageMap', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(dbDriverLocal.userId).toEqual('fooUserId')
    expect(dbDriverLocal.storageMap).toBeDefined()
    expect(dbDriverLocal.storageMap.hasOwnProperty('common')).toBeTruthy()
    expect(dbDriverLocal.storageMap.hasOwnProperty('context')).toBeTruthy()
    expect(dbDriverLocal.storageMap.hasOwnProperty('shortHomonym')).toBeTruthy()
    expect(dbDriverLocal.storageMap.hasOwnProperty('fullHomonym')).toBeTruthy()
  })

  it('2 WordItemIndexedDbDriver - each object has constants: dbName, dbVersion', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(dbDriverLocal.dbName).toBeDefined()
    expect(dbDriverLocal.dbVersion).toBeDefined()
  })

  it('3 WordItemIndexedDbDriver - segments method should return all segments from storageMap', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')
    
    let checkSegments = Object.keys(dbDriverLocal.storageMap)
    expect(dbDriverLocal.segments).toEqual(checkSegments)
  })

  it('4 WordItemIndexedDbDriver - objectStores method should return all objectStores from storageMap', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')
    let checkObjectStores = Object.keys(dbDriverLocal.storageMap).map(segment => dbDriverLocal.storageMap[segment].objectStoreName)
    expect(dbDriverLocal.objectStores).toEqual(checkObjectStores)
  })

  it('5 WordItemIndexedDbDriver - _objectStoreTemplate defines key and index fields of the objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(typeof dbDriverLocal._objectStoreTemplate()).toEqual('object')
    expect(dbDriverLocal._objectStoreTemplate().keyPath).toBeDefined()
    expect(dbDriverLocal._objectStoreTemplate().indexes).toBeDefined()
    expect(Array.isArray(dbDriverLocal._objectStoreTemplate().indexes)).toBeTruthy()
    expect(dbDriverLocal._objectStoreTemplate().indexes.length).toBeGreaterThan(0)
  })

  it('6 WordItemIndexedDbDriver - WordListsCommon defines key and index fields of the objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(typeof dbDriverLocal.WordListsCommon).toEqual('object')
    expect(dbDriverLocal.WordListsCommon.keyPath).toBeDefined()
    expect(dbDriverLocal.WordListsCommon.indexes).toBeDefined()
    expect(Array.isArray(dbDriverLocal.WordListsCommon.indexes)).toBeTruthy()
    expect(dbDriverLocal.WordListsCommon.indexes.length).toBeGreaterThan(0)
  })

  it('7 WordItemIndexedDbDriver - WordListsContext defines key and index fields of the objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(typeof dbDriverLocal.WordListsContext).toEqual('object')
    expect(dbDriverLocal.WordListsContext.keyPath).toBeDefined()
    expect(dbDriverLocal.WordListsContext.indexes).toBeDefined()
    expect(Array.isArray(dbDriverLocal.WordListsContext.indexes)).toBeTruthy()
    expect(dbDriverLocal.WordListsContext.indexes.length).toBeGreaterThan(0)
  })

  it('8 WordItemIndexedDbDriver - WordListsHomonym defines key and index fields of the objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(typeof dbDriverLocal.WordListsHomonym).toEqual('object')
    expect(dbDriverLocal.WordListsHomonym.keyPath).toBeDefined()
    expect(dbDriverLocal.WordListsHomonym.indexes).toBeDefined()
    expect(Array.isArray(dbDriverLocal.WordListsHomonym.indexes)).toBeTruthy()
    expect(dbDriverLocal.WordListsHomonym.indexes.length).toBeGreaterThan(0)
  })

  it('9 WordItemIndexedDbDriver - WordListsFullHomonym defines key and index fields of the objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    expect(typeof dbDriverLocal.WordListsFullHomonym).toEqual('object')
    expect(dbDriverLocal.WordListsFullHomonym.keyPath).toBeDefined()
    expect(dbDriverLocal.WordListsFullHomonym.indexes).toBeDefined()
    expect(Array.isArray(dbDriverLocal.WordListsFullHomonym.indexes)).toBeTruthy()
    expect(dbDriverLocal.WordListsFullHomonym.indexes.length).toBeGreaterThan(0)
  })

  it('10 WordItemIndexedDbDriver - load method returns a WordItem with currentSession = false', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    let testData = {
      ID: 'testUserID-lat-beatum',
      createdDT: '2019/02/12 @ 16:09:04',
      important: false,
      languageCode: 'lat',
      listID: 'testUserID-lat',
      targetWord: 'beatum',
      userID: 'testUserID'
    }

    let loadResult = dbDriverLocal.load(testData)
    expect(loadResult).toBeInstanceOf(WordItem)
    expect(loadResult.currentSession).toBeFalsy()
  })

  it('11 WordItemIndexedDbDriver - loadSegment method executes loadMethod specific for the segment from storageMap', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')

    dbDriverLocal.storageMap.context.load = jest.fn()
    dbDriverLocal.loadSegment('context', 'fooDataObject', 'foodata')

    expect(dbDriverLocal.storageMap.context.load).toHaveBeenCalledWith('fooDataObject', 'foodata')

    dbDriverLocal.storageMap.shortHomonym.load = jest.fn()
    dbDriverLocal.loadSegment('shortHomonym', 'fooDataObject', 'foodata')

    expect(dbDriverLocal.storageMap.shortHomonym.load).toHaveBeenCalledWith('fooDataObject', 'foodata')

    dbDriverLocal.storageMap.fullHomonym.load = jest.fn()
    dbDriverLocal.loadSegment('fullHomonym', 'fooDataObject', 'foodata')

    expect(dbDriverLocal.storageMap.fullHomonym.load).toHaveBeenCalledWith('fooDataObject', 'foodata')
  })

  it('12 WordItemIndexedDbDriver - segmentQuery method returns settings for getting data for an objectStore', () => {
    let dbDriverLocal = new WordItemIndexedDbDriver('fooUserId')
    let testWordItem = new WordItem({
      targetWord: 'caeli', 
      languageCode: 'lat'
    })

    let result = dbDriverLocal.segmentQuery('common', testWordItem)
    expect(result.objectStoreName).toEqual(dbDriverLocal.storageMap.common.objectStoreName)
    expect(result.condition).toBeDefined()
    expect(result.condition.indexName).toEqual('ID')

    result = dbDriverLocal.segmentQuery('context', testWordItem)
    expect(result.objectStoreName).toEqual(dbDriverLocal.storageMap.context.objectStoreName)
    expect(result.condition).toBeDefined()
    expect(result.condition.indexName).toEqual('wordItemID')

    result = dbDriverLocal.segmentQuery('shortHomonym', testWordItem)
    expect(result.objectStoreName).toEqual(dbDriverLocal.storageMap.shortHomonym.objectStoreName)
    expect(result.condition).toBeDefined()
    expect(result.condition.indexName).toEqual('ID')

    result = dbDriverLocal.segmentQuery('fullHomonym', testWordItem)
    expect(result.objectStoreName).toEqual(dbDriverLocal.storageMap.fullHomonym.objectStoreName)
    expect(result.condition).toBeDefined()
    expect(result.condition.indexName).toEqual('ID')
  })
})