export default class WordItem {
  constructor (data) {
    this.version = 1
    this.targetWord = data.targetWord
    this.languageCode = data.languageCode
    this.important = data.important || false
    this.currentSession = data.currentSession || false
    this.context = data.context || []
    this.homonym = data.homonym ? data.homonym : {}
  }

  addContext(selectors) {
    for (s of selectors) {
      let found = this.context.filter(tqs => tqs.isEqual(s))
      if (found.length == 0) {
        this.context.push(selector)
      }
    }
  }

  get lemmasList () {
    if (this.homonym && this.homonym.lexemes) {
      return this.homonym.lexemes.map(lexeme => lexeme.lemma.word).filter( (value, index, self) => {
        return self.indexOf(value) === index
      }).join(', ')
    }
    return ''
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

  emptyProp (propName) {
    return !this[propName] || (typeof this[propName] === 'object' && Object.keys(this[propName]).length === 0)
  }

  hasThisTextQuoteSelector (tq) {
    return this.textQuoteSelectors.filter(tqCurrent => tqCurrent.prefix === tq.prefix && tqCurrent.suffix === tq.suffix && tqCurrent.source === tq.source).length > 0
  }

  mergeTextQuoteSelectors (prevWordItem) {
    for (let tq of prevWordItem.textQuoteSelectors) {
      if (!this.hasThisTextQuoteSelector(tq)) {
        this.textQuoteSelectors.push(tq)
      }
    }
  }

  merge (prevWordItem) {
    let checkProps = ['homonym', 'important', 'currentSession']
    for(let prop of checkProps) {
      if (this.emptyProp(prop) && !prevWordItem.emptyProp(prop)) {
        this[prop] = prevWordItem[prop]
      }
    }

    this.mergeTextQuoteSelectors(prevWordItem)
  }
}
