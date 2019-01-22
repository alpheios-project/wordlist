import { PsEvent } from 'alpheios-data-models'
import WordList from '@/lib/word-list'

export default class WordlistController {
  /**
   * @constructor
   * @param {String[]} availableLangs language codes
   * @param {PSEvent[]} events events that the controller can subscribe to
   */
  constructor (availableLangs,events) {
    this.wordLists = {}
    this.availableLangs = availableLangs
    events.TEXT_QUOTE_SELECTOR_RECEIVED.sub(this.onTextQuoteSelectorRecieved.bind(this))
    events.LEXICAL_QUERY_COMPLETE.sub(this.onHomonymReady.bind(this))
    events.DEFS_READY.sub(uiController.wordlistC.onDefinitionsReady.bind(uiController.wordlistC))
    events.LEMMA_TRANSL_READY.sub(uiController.wordlistC.onLemmaTranslationsReady.bind(uiController.wordlistC))
  }

  /**
   * Asynchronously initialize the word lists managed by this controller
   * @param {UserDataManager} dataManager a user data manager to retrieve initial wordlist data from
   *  // TODO may need a way to process a queue of pending words here e.g. if the wordlist controller isn't
    * // activated until after number of lookups have already occurred
   * Emits a WORDLIST_UPDATED event when the wordlists are available
   */
  async initLists (dataManager) {
    this.availableLangs.forEach(async (languageCode) => {
      let wordItems = await dataManager.query({dataType: WordItem.constructor.name, params: {languageCode: languageCode}})
      if (wordItems.length > 0) {
        this.wordLists[languageCode] = new WordList(languageCode,wordItems)
      }
    })
    WordlistController.evt.WORDLIST_UPDATED.pub(this.wordLists)
  }

  /**
   * Get the wordlist for a specific language code
   * @param {String} languageCode the language for the list
   * @param {Boolean} create set to true to create the list of it doesn't exist
   * Emits a WORDLIST_CREATED event if a new list is created
   * @return {WordList} the wordlist
   */
  getWordList (languageCode, create=true) {
    if (create && ! this.wordListExist(languageCode)) {
      let wordList = new WordList([])
      this.wordLists[languageCode] = wordList
      WordlistController.evt.WORDLIST_CREATED.pub(wordList)
    }
    return this.wordLists[languageCode]
  }

  /**
   * Remove a wordlist for a specific language code and all if its items
   * @param {String} languageCode the language for the list
   * Emits a WORDLIST_DELETED event
   */
  removeWordList (languageCode) {
    let toDelete = this.wordLists[languageCode]
    delete this.wordLists[languageCode]
    WordlistController.evt.WORDLIST_DELETED.pub({dataType: WordItem.constructor.name, params: {languageCode: languageCode}})
  }

  /**
   * Remove a WordItem from a WordList
   * @param {String} languageCode the language of the item to be removed
   * @param {String} targetWord the word to be removed
   * Emits a WORDITEM_DELETED event for for the item that was deleted
   */
  removeWordListItem (languageCode, targetWord) {
    let wordList = this.getWordList(languageCode, false)
    if (wordList) {
      let deleted = wordList.deleteWordItem(targetWord)
      if (deleted) {
        WordlistController.evt.WORDITEM_DELETED.pub({dataObj: wordItem})
      }
    }
    // TODO error handling if item not found
  }

  /**
   * Check to see if we have a wordlist for a specific language code
   * @param {String} languageCode the language code
   * @return {Boolean} true if the wordlist exists otherwise false
   */
  wordListExist (languageCode) {
    return Object.keys(this.wordLists).includes(languageCode)
  }

  /**
   * get an item from a word list
   * @param {String} languageCode the language code of the item
   * @param {String} targetWord the word of the item
   * @param {Boolean} create true to create the item if it doesn't exist
   * @return {WordItem} the retrieved or created WordItem
   */
  getWordListItem (languageCode, targetWord, create=false) {
    let wordList = this.getWordList(languageCode, create)
    let worditem
    if (wordList) {
      worditem = wordList.getWordItem(targetWord,create)
    }
    // TODO error handling for no item?
    return worditem
  }

  /**
   * Responds to a HOMONYM_READY event by creating or updating a wordlist item for a retrieved Homonym
   * @param {Object} data - expected to adhere to
   *                        { homonym: Homonym }
   * Emits WORDITEM_UPDATED and WORDLIST_UPDATED events
   */
   onHomonymReady (data) {
    console.info('********************onHomonymReady1', data)
    // when receiving this event, it's possible this is the first time we are seeing the word so
    // create the item in the word list if it doesn't exist
    let wordItem = this.getWordListItem(data.homonym.language,data.homonym.targetWord,true)
    wordItem.homonym = data.homonym
    WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'homonym'}})
    // emit a wordlist updated event too in case the wordlist was updated
    WordlistController.evt.WORDLIST_UPDATED.pub(this.getWordList(wordItem.languageCode))
  }

  /**
  * Responds to a DEFINITIONS_READY event by updating a wordlist item for retrieved Definitions
  * @param {Object} data - expected to adhere to
  *                        { homonym: Homonym }
  * Emits a WORDITEM_UPDATED event
  */
  onDefinitionsReady (data) {
    console.info('********************onDefinitionsReady', data)
    let wordItem = this.getWordListItem(data.homonym.language,data.homonym.targetWord)
    if (wordItem) {
      wordItem.homonym = data.homonym
      WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'homonym'}})
    } else {
      // TODO error handling
      console.error("Something went wrong: request to add definitions to non-existent item")
    }
  }

  /**
  * Responds to a LEMMA_TRANSLATIONS_READY event by updating a wordlist item for retrieved translations
  * (because lemma translations could come much later we need to resave homonym with translations data to database)
  * @param {Object} data - expected to adhere to
  *                        { homonym: Homonym }
  * Emits a WORDITEM_UPDATED event
  */
  onLemmaTranslationsReady (data) {
    console.info('********************onLemmaTranslationsReady', data.homonym)
    let wordItem = this.getWordListItem(data.homonym.language, data.homonym.targetWord)
    if (wordItem) {
      wordItem.homonym = data.homonym
      WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'homonym'}})
    } else {
      console.error("Something went wrong: request to add translations to non-existent item")
    }
  }

  /**
  * Responds to a TextQuoteSelectorReceived  event by creating or updating a wordlist item for a retrieved Homonym
  * @param {Object} data - expected to adhere to
  *                        { textquoteselector: TextQuoteSelector }
  * Emits a WORDITEM_UPDATED and WORDLIST_UPDATED events
  */
  onTextQuoteSelectorRecieved (data) {
    console.info('********************onTextQuoteSelectorRecieved', data.textQuoteSelector)
    // when receiving this event, it's possible this is the first time we are seeing the word so
    // create the item in the word list if it doesn't exist
    let wordItem = this.getWordListItem(data.textQuoteSelector.languageCode, data.textQuoteSelector.normalizedText,true)
    wordItem.addContext(textQuoteSelector)
    WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'context'}})
    // emit a wordlist updated event too in case the wordlist was updated
    WordlistController.evt.WORDLIST_UPDATED.pub(this.getWordList(wordItem.languageCode))

  }

  /**
  * Update a wordlist item's important flag
  * @param {String} languageCode  the language of the item
  * @param {String} targetWord the word of the item
  * @param {Boolean} important true or false
  * Emits a WORDITEM_UPDATED event
  */
  updateWordItemImportant (languageCode, targetWord, important) {
    let wordItem = this.getWordListItem(languageCode, targetWord,false)
    if (wordItem) {
      wordItem.important = important
      WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'important'}})
    } else {
      console.error("Something went wrong: request to set important flag on non-existent item")
    }
  }

  /**
  * Update the important flag of all the items in a WordList
  * @param {String} languageCode  the language of the list
  * @param {Boolean} important true or false
  * Emits a WORDITEM_UPDATED event for each updated item
  */
  updateAllImportant (languageCode, important) {
    let wordList = this.getWordList(languageCode, false)
    this.wordList.values.forEach(wordItem => {
      wordItem.important = important
      WordlistController.evt.WORDITEM_UPDATED.pub({dataObj: wordItem, params: {segment: 'important'}})
    })
  }

  /**
  * Select an item in a word list
  * @param {String} languageCode  the language of the item
  * @param {String} targetWord the word of the item
  * Emits a WORDITEM_SELECTED event for the selected item
  */
  selectWordItem (languageCode, targetWord) {
    let wordItem = this.getWordListItem(languageCode, targetWord,false)
    this.evt.WORDITEM_SELECTED.pub(wordItem)
  }
}

WordlistController.evt = {
  /**
   * Published when a WordList was updated.
   * Data: {
   *  {wordLists} an Array with WordLists object
   * }
   */
  WORDLIST_UPDATED: new PsEvent('Wordlist updated', WordlistController),

  /**
   * Published when a WordList was created
   * Data: {
   *  {wordLists} an Array with WordLists object
   * }
   */
  WORDLIST_CREATED: new PsEvent('Wordlist created', WordlistController),


  /**
   * Published when a WordList was deleted
   * Data: {
   *  dataType: constructor name for the contained word list items
   *  params: parameters to identify the items to be deleted
   * }
   */
  WORDLIST_DELETED: new PsEvent('Wordlist deleted', WordlistController),

  /**
   * Published when a WordItem was selected.
   * Data: {
   *  dataObj: the selected WordItem
   * }
   */
  WORDITEM_SELECTED: new PsEvent('WordItem selected', WordlistController),

  /**
   * Published when a WordItem was updated
   * Data: {
   *   dataObj: the selected WordItem
   *   params: additional update parameters
   * }
   */
  WORDITEM_UPDATED: new PsEvent('WordItem updated', WordlistController),

  /**
   * Published when a WordItem was deleted
   * Data: {
   *   dataObj: the deleted WordItem
   * }
   */
  WORDITEM_DELETED: new PsEvent('WordItem deleted', WordlistController)

}
