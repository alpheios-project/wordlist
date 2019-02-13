export default class IndexedDBObjectStoresStructure {
  /**
   * private method - creates a template for a new Object Store
   */
 static _objectStoreTemplate () {
    return {
      keyPath: 'ID',
      indexes: [
        { indexName: 'ID', keyPath: 'ID', unique: true},
        { indexName: 'listID', keyPath: 'listID', unique: false},
        { indexName: 'userID', keyPath: 'userID', unique: false},
        { indexName: 'languageCode', keyPath: 'languageCode', unique: false},
        { indexName: 'targetWord', keyPath: 'targetWord', unique: false}
      ]
    }
  }

   /**
   * getter for the Common segment store
   */
  static get WordListsCommon () {
    return IndexedDBObjectStoresStructure._objectStoreTemplate()
  }

  /**
   * getter for the Context segment store
   */
  static get WordListsContext () {
    let structure = IndexedDBObjectStoresStructure._objectStoreTemplate()
    structure.indexes.push(
      { indexName: 'wordItemID', keyPath: 'wordItemID', unique: false}
    )
    return structure
  }

  /**
   * getter for the Homonym segment store
   */
  static get WordListsHomonym () {
    return IndexedDBObjectStoresStructure._objectStoreTemplate()
  }

  /**
   * getter for the Full Homonym segment store
   */
  static get WordListsFullHomonym () {
    return IndexedDBObjectStoresStructure._objectStoreTemplate()
  }

}