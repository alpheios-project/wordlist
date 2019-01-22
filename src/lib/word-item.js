export default class WordItem {
  /**
   * @constructor
   * @param {Object} constructorArgs
   *   {String} targetWord
   *   {String} languageCode
   *   {Boolean} important
   *   {Boolean} currentSession
   *   {TextQuoteSelector[]} context
   *   {Homonym} homonym
   *
   */
  constructor (data = { targetWord: null, languageCode: null, important: false, currentSession: true, context: [], homonym: {} }) {
    // TODO handling of version
    this.version = 1
    this.targetWord = data.targetWord
    this.languageCode = data.languageCode
    if (!this.targetWord || !this.languageCode) {
      throw new Error("Unable to constructe a worditem without at least a targetWord and a languageCode")
    }
    this.important = data.important || false
    this.currentSession = data.currentSession || true
    this.context = data.context || []
    this.homonym = data.homonym || {}
  }

  /**
   * Construct a WordItem from JSON
   */
  static readObject(jsonObject) {
    let homonym = {}
    let context = []
    if (jsonObject.homonym) {
        homonym = WordItem.readHomonym(jsonObject)
    }
    if (jsonObject.context) {
        context = WordItem.readContext(jsonObject)
    }
    let worditem = new WordItem({
      targetWord: jsonObject.targetWord,
      languageCode: jsonObject.languageCode,
      important: jsonObject.important,
      currentSession: jsonObject.currentSession,
      context: context,
      homonym: homonym
    })
  }

  /**
   * Construct the homonym portion of a WordItem from JSON
   */
  static readHomonym(jsonObject) {
    return Homonym.readObject(jsonObj.homonym)
  }

  /**
   * Construct the context portion of a WordItem from JSON
   */
  static readContext(jsonObject) {
    let tqs = []
    for (let jsonObj of jsonObject) {
      let tq = TextQuoteSelector.readObject(jsonObj)
      tqs.push(tq)
    }
    return tqs
  }

  /**
   * add one or more context selectors
   * @param {TextQuoteSelector[]} selectors
   */
  addContext(selectors) {
    for (let s of selectors) {
      let found = this.context.filter(tqs => tqs.isEqual(s))
      if (found.length == 0) {
        this.context.push(s)
      }
    }
  }

  /**
   * getter for the lemmas in this WordItem
   */
  get lemmasList () {
    if (this.homonym && this.homonym.lexemes) {
      return this.homonym.lexemes.map(lexeme => lexeme.lemma.word).filter( (value, index, self) => {
        return self.indexOf(value) === index
      }).join(', ')
    }
    return ''
  }


  // TODO NOT SURE HOW THE MERGE FUNCTIONALITY IS USED
  merge (prevWordItem) {
    let checkProps = ['homonym', 'important', 'currentSession']
    for(let prop of checkProps) {
      if (this._emptyProp(prop) && !prevWordItem._emptyProp(prop)) {
        this[prop] = prevWordItem[prop]
      }
    }
  }

  /**
   * private method to detect an empty property
   */
  _emptyProp (propName) {
    return !this[propName] || (typeof this[propName] === 'object' && Object.keys(this[propName]).length === 0)
  }
}
