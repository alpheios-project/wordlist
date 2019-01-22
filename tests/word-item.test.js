/* eslint-env jest */
/* eslint-disable no-unused-vars */
import 'whatwg-fetch'

import WordItem from '@/lib/word-item';

describe('word-item.test.js', () => {
  console.error = function () {}
  console.log = function () {}
  console.warn = function () {}

  let testHomonymLatin, testHomonymGreek
  let testLanguageID = Constants.LANG_LATIN

  beforeAll(async () => {
    testHomonymLatin = {}
    testHomonymGreek = {}
  })

  beforeEach(() => {
    jest.spyOn(console, 'error')
    jest.spyOn(console, 'log')
    jest.spyOn(console, 'warn')
  })

  afterEach(() => {
    jest.resetModules()
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  it('1 WordItem - constructor throws error on missing props', () => {
    expect(function () {
      let wI = new WordItem({}}
    }).toThrowError(/Unable to construct/)
  })

  skip('2 WordItem - makeImportant method marks item as important', () => {
    let wI = new WordItem(testHomonymLatin)
    expect(wI.important).toBeFalsy()

    wI.makeImportant()
    expect(wI.important).toBeTruthy()
  })

  skip('3 WordItem - removeImportant method marks item as not important', () => {
    let wI = new WordItem(testHomonymLatin)

    wI.makeImportant()
    expect(wI.important).toBeTruthy()

    wI.removeImportant()
    expect(wI.important).toBeFalsy()
  })

})