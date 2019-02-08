import RemoteConfig from '@/storage/remote-db-config.json'

export default class WordItemRemoteDbDriver {
  constructor (userId) {
    this.config = RemoteConfig
    this.userId = userId || this.config.testUserID
    
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

  _constructPostURL (wordItem) {
    return `/words/${this._makeStorageID(wordItem)}`
  }

  _constructGetURL (data) {
    if (data.wordItem) {
      return `/words/${this._makeStorageID(data.wordItem)}`
    }
    if (data.languageCode) {
      return `/words?languageCode=${data.languageCode}`
    }
    return
  }

  _constructDeleteManyURL (data) {
    return `/words?languageCode=${data.languageCode}`
  }

  _makeStorageID (wordItem) {
    return wordItem.languageCode + '-' + wordItem.targetWord
  }

  _serialize (wordItem) {
    return {
      ID: this._makeStorageID(wordItem),
      listID: this.userId + '-' + wordItem.languageCode,
      userID: this.userId,
      languageCode: wordItem.languageCode,
      targetWord: wordItem.targetWord,
      important: wordItem.important,
      createdDT: WordItemRemoteDbDriver.currentDate,
      homonym: {
        targetWord: wordItem.homonym.targetWord,
        lemmasList: wordItem.lemmasList
      },
      context: this._serializeContext(wordItem)
    }
  }

  _serializeContext (worditem) {
    let result = []
    for (let tq of worditem.context) {
      let resultItem = {
        target: {
          source: tq.source,
          selector: {
            type: 'TextQuoteSelector',
            exact: tq.text,
            prefix: tq.prefix,
            suffix: tq.suffix,
            contextHTML: tq.contextHTML,
            languageCode: tq.languageCode
          }
        },
        languageCode: worditem.languageCode,
        targetWord: worditem.targetWord,
        createdDT: WordItemRemoteDbDriver.currentDate
      }
      result.push(resultItem)
    }
    return result
  }

  _checkPostResult (result) {
    return result.status === 201
  }

  _checkPutResult (result) {
    return result.status === 200
  }

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

  static get currentDate () {
    let dt = new Date()
    return dt.getFullYear() + '/'
        + ((dt.getMonth()+1) < 10 ? '0' : '') + (dt.getMonth()+1)  + '/'
        + ((dt.getDate() < 10) ? '0' : '') + dt.getDate() + ' @ '
                + ((dt.getHours() < 10) ? '0' : '') + dt.getHours() + ":"
                + ((dt.getMinutes() < 10) ? '0' : '') + dt.getMinutes() + ":"
                + ((dt.getSeconds() < 10) ? '0' : '') + dt.getSeconds()

  }

  getCheckArray (dataItems) {
    return dataItems.map(item => this._makeStorageID(item))
  }
}
