export default class UpgradeQueue {
  constructor () {
    this.count = 0
    this.targetWords = []

    this.currentWord = null
    this.methods = []
  }

  includeHomonym (homonym) {
    return this.targetWords.includes(homonym.targetWord)
  }

  addToQueue (homonym) {
    this.count = this.count + 1
    this.targetWords.push(homonym.targetWord)
  }

  addToMetods (method, args) {
    this.methods.push({ 
      method: method,
      args: args 
    })
  }

  setCurrentWord (wordItem) {
    this.currentWord = wordItem.targetWord
  }

  clearCurrentItem () {
    this.count = this.count - 1
    this.targetWords = this.targetWords.filter(item => item != this.currentWord)
    this.currentWord = null

    if (this.methods.length > 0) {
      this.methods[0].method(...this.methods[0].args)
      this.methods.splice(0, 1)
    }
    // console.info('**********************changeUpdateQueue', this.upgradeQueue)
  }
}