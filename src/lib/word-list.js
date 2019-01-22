import WordItem from '@/lib/word-item'

export default class WordList {
  /**
  * @constructor
  * @param {String} languageCode the language code of the list
  * @param {WordItem[]} worditems an optional array of WordItems with which to initialize the list
  */
  constructor (languageCode,worditems=[]) {
    if (!languageCode) {
      throw new Error("Unable to construct a wordlist without a languagecode")
    }
    this.languageCode = languageCode
    this.items = {}
    worditems.forEach(item => {
      this.addWordItem(item)
    })
  }

  /**
   * get the items of the list
   */
  get values () {
    return Object.values(this.items)
  }

  addWordItem (item) {
    if (item.languageCode !== this.languageCode) {
      throw new Error("Language Code mismatch")
    }
    let existingItem = this.getWordItem(item.targetWord,false)
    if (existingItem) {
      item = item.merge(existingItem)
    }
    let key = this._makeItemKey(this.languageCode,item.targetWord)
    this.items[key]  = item
  }

  /**
  * delete an individual word item from the list
  * @param {String} targetWord the word to delete
  * @return {WordItem} the deleted item
  */
  deleteWordItem (targetWord) {
    let key = this._makeItemKey(this.languageCode,targetWord)
    let toDelete = this.items[key]
    if (toDelete) {
      delete this.items[key]
    }
    return toDelete
  }

  /**
  * delete all items from a list
  */
  removeAllWordItems () {
    this.items = {}
  }


  /**
   * get an item from a list
   * @param targetWord the word to get
   * @param {Boolean} create true to create the item if it doesn't exist
   * @return {WordItem} the retrieved item
   */
  getWordItem(targetWord, create=true) {
    let key = this._makeItemKey(this.languageCode,targetWord)
    if (create && !this.items[key]) {
      let wordItem = new WordItem({targetWord: targetWord, languageCode: this.languageCode})
      this.items[key]  = wordItem
    }
    return this.items[key]
  }

   /**
    * make a key for a word item
    * @param {String} languageCode
    * @param {String} targetWord
    */
  _makeItemKey(languageCode,targetWord) {
    return `${languageCode}:${targetWord}`
  }
}
