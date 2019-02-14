import { Homonym, WordItem, Lexeme, Lemma, LanguageModelFactory as LMF } from 'alpheios-data-models'

export default class IndexedDBLoadProcess {
  /**
   * load a data model object from the database
   */
  static loadBaseObject(jsonObj) {
    // make sure when we create from the database
    // that the currentSession flag is set to false
    jsonObj.currentSession = false
    return new WordItem(jsonObj)
  }

  /**
  * private method to load the Context property of a WordItem
  */
  static loadContext (jsonObjs, worditem) {
    if (! Array.isArray(jsonObjs)) {
      jsonObjs = [jsonObjs]  
    }
    worditem.context = WordItem.readContext(jsonObjs)
    return worditem
  }

  /**
   * private method to load the Homonym property of a WordItem
   */
  static loadHomonym (jsonObj, worditem) {
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
      return worditem
    }
  }

  

}