import uuidv4 from 'uuid/v4'
import { Homonym } from 'alpheios-data-models'

export default class WordItem {
  constructor (homonym) {
    this.targetWord = homonym.targetWord
    this.languageID = homonym.languageID
    this.homonym = homonym
    this.important = false
    this.ID = uuidv4()
  }

  makeImportant () {
    this.important = true
  }

  removeImportant () {
    this.important = false
  }

  get lemmasList () {
    return this.homonym.lexemes.map(lexeme => lexeme.lemma.word).join(', ')
  }

  static uploadFromJSON (jsonObj) {
    let homonym = Homonym.readObject(jsonObj.homonym)
    return new WordItem(homonym)
  }
}