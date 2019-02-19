import RemoteConfig from '@/storage/remote-db-config.json'

export default class WordItemRemoteDbDriver {
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
    let result = {
      ID: this._makeStorageID(wordItem),
      listID: this.userID + '-' + wordItem.languageCode,
      userID: this.userID,
      languageCode: wordItem.languageCode,
      targetWord: wordItem.targetWord,
      important: wordItem.important,
      createdDT: WordItemRemoteDbDriver.currentDate
    }

    if (wordItem.homonym && wordItem.homonym.targetWord) {
      result.homonym = {
        targetWord: wordItem.homonym.targetWord,
        lemmasList: wordItem.lemmasList
      }
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

  _serializeHomonym (wordItem) {
    if (wordItem.homonym && wordItem.homonym.targetWord) {
      return {
        targetWord: wordItem.homonym.targetWord,
        lemmasList: wordItem.lemmasList
      }
    }
    return null
  }

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
