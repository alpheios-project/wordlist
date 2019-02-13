import { Homonym, WordItem, Lexeme, Lemma, LanguageModelFactory as LMF } from 'alpheios-data-models'

export default class IndexedDBLoadProcess {
  /**
   * load a data model object from the database
   */
  static loadBaseObject(data) {
    // make sure when we create from the database
    // that the currentSession flag is set to false
    data.currentSession = false
    return new WordItem(data)
  }

  /**
  * private method to load the Context property of a WordItem
  */
  static loadContext (worditem, jsonObjs) {
    if (! Array.isArray(jsonObjs)) {
      jsonObjs = [jsonObjs]  
    }
    worditem.context = WordItem.readContext(jsonObjs)
  }

  /**
   * private method to load the Homonym property of a WordItem
   */
  static loadHomonym (worditem, jsonObj) {
    let jsonHomonym = jsonObj[0].homonym
    if (jsonHomonym.lexemes && Array.isArray(jsonHomonym.lexemes) && jsonHomonym.lexemes.length >0) {
      worditem.homonym = WordItem.readHomonym(jsonObj[0])
    } else {
      let languageID = LMF.getLanguageIdFromCode(jsonObj[0].languageCode)
      let lexemesForms = jsonHomonym.lemmasList.split(', ')
      let lexemes = []
      for (let lexForm of lexemesForms) {
        lexemes.push(new Lexeme(new Lemma(lexForm, languageID), []))
      }
      worditem.homonym = new Homonym(lexemes, jsonHomonym.targetWord)
    }
  }

  

}