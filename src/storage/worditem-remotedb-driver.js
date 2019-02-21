import RemoteConfig from '@/storage/remote-db-config.json'

export default class WordItemRemoteDbDriver {
  /**
   * Defines proper headers and uploads config for access to remote storage, defines storageMap
   * @param {String} userID
   */
  constructor (userID) {
    this.config = RemoteConfig
    this.userID = userID || this.config.testUserID
    
    let testAuthID = 'alpheiosMockUserIdlP0DWnmNxe'

    this.requestsParams = {
      baseURL: this.config.baseUrl,
      headers: {
        common: {
          Authorization: 'bearer ' + testAuthID,
          'Content-Type': 'application/json'
        }
      }
    }
    
    this.storageMap = {
      post: {
        url: this._constructPostURL.bind(this),
        serialize: this._serialize.bind(this),
        checkResult: this._checkPostResult.bind(this)
      },
      put: {
        url: this._constructPostURL.bind(this),
        serialize: this._serialize.bind(this),
        checkResult: this._checkPutResult.bind(this)
      },
      get: {
        url: this._constructGetURL.bind(this),
        checkResult: this._checkGetResult.bind(this)
      },
      deleteOne: {
        url: this._constructPostURL.bind(this),
        checkResult: this._checkPutResult.bind(this)
      },
      deleteMany: {
        url: this._constructDeleteManyURL.bind(this),
        checkResult: this._checkPutResult.bind(this)
      }
    }
  }

   /**
   * Defines url for creating item in remote storage
   * @param {WordItem} wordItem
   * @return {String}
   */
  _constructPostURL (wordItem) {
    return `/words/${this._makeStorageID(wordItem)}`
  }

   /**
   * Defines url for getting wordItem or wordList from remote storage
   * @param {WordItem} wordItem
   * @return {String}
   */
  _constructGetURL (data) {
    if (data.wordItem) {
      return `/words/${this._makeStorageID(data.wordItem)}`
    }
    if (data.languageCode) {
      return `/words?languageCode=${data.languageCode}`
    }
    return
  }

  /**
   * Defines url for deleting items from wordList from languageCode in remote storage
   * @param {WordItem} wordItem
   * @return {String}
   */
  _constructDeleteManyURL (data) {
    return `/words?languageCode=${data.languageCode}`
  }

  /**
   * Defines ID to use in remote storage
   * @param {WordItem} wordItem
   * @return {String}
   */
  _makeStorageID (wordItem) {
    return wordItem.languageCode + '-' + wordItem.targetWord
  }

  /**
   * Defines json object from wordItem to save to remote storage
   * @param {WordItem} wordItem
   * @return {Object}
   */
  _serialize (wordItem) {
    let result = {
      ID: this._makeStorageID(wordItem),
      listID: this.userID + '-' + wordItem.languageCode,
      userID: this.userID,
      languageCode: wordItem.languageCode,
      targetWord: wordItem.targetWord,
      important: wordItem.important,
      createdDT: WordItemRemoteDbDriver.currentDate
    }

    let homonym = this._serializeHomonym(wordItem)
    if (homonym) {
      result.homonym = homonym
    }
    let context = this._serializeContext(wordItem)

    if (context && context.length > 0) {
      result.context = context
    }
    return result
  }

  /**
   * Defines json object from homonym to save to remote storage
   * @param {WordItem} wordItem
   * @return {Object}
   */
  _serializeHomonym (wordItem) {
    if (wordItem.homonym && wordItem.homonym.targetWord) {
      return {
        targetWord: wordItem.homonym.targetWord,
        lemmasList: wordItem.lemmasList
      }
    }
    return null
  }

  /**
   * Defines json object from textQuoteSelectors to save to remote storage
   * @param {WordItem} wordItem
   * @return {Object[]}
   */
  _serializeContext (wordItem) {
    let result = []
    for (let tq of wordItem.context) {
      let resultItem = {
        target: {
          source: tq.source,
          selector: {
            type: 'TextQuoteSelector',
            exact: tq.text,
            prefix: tq.prefix.length > 0 ? tq.prefix : ' ',
            suffix: tq.suffix > 0 ? tq.suffix : ' ',
            languageCode: tq.languageCode
          }
        },
        languageCode: wordItem.languageCode,
        targetWord: wordItem.targetWord,
        createdDT: wordItem.currentDate
      }
      result.push(resultItem)
    }
    return result
  }

  /**
   * Checks status of response (post) from remote storage 
   * @param {WordItem} wordItem
   * @return {Boolean}
   */
  _checkPostResult (result) {
    return result.status === 201
  }

  /**
   * Checks status of response (put) from remote storage 
   * @param {WordItem} wordItem
   * @return {Boolean}
   */
  _checkPutResult (result) {
    return result.status === 200
  }

  /**
   * Checks status of response (get) from remote storage 
   * @param {WordItem} wordItem
   * @return {Object/Object[]}
   */
  _checkGetResult (result) {
    if (result.status !== 200) {
      return []
    }
    if (Array.isArray(result.data)) {
      return result.data.map(item => item.body ? item.body : item)
    } else {
      return result.data
    }
  }

  /**
   * Defines date 
   */
  static get currentDate () {
    let dt = new Date()
    return dt.getFullYear() + '/'
        + ((dt.getMonth()+1) < 10 ? '0' : '') + (dt.getMonth()+1)  + '/'
        + ((dt.getDate() < 10) ? '0' : '') + dt.getDate() + ' @ '
                + ((dt.getHours() < 10) ? '0' : '') + dt.getHours() + ":"
                + ((dt.getMinutes() < 10) ? '0' : '') + dt.getMinutes() + ":"
                + ((dt.getSeconds() < 10) ? '0' : '') + dt.getSeconds()

  }

  /**
   * Creates array is IDs from wordItems for comparing with remote storage data
   * @param {WordItem[]} wordItems
   * @return {String[]}
   */
  getCheckArray (dataItems) {
    return dataItems.map(item => this._makeStorageID(item))
  }
}
