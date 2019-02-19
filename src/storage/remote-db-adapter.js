import axios from 'axios'

export default class RemoteDBAdapter {
  constructor (dbDriver) {
    this.dbDriver = dbDriver
    this.available = this._checkRemoteDBAvailability()
    this.errors = []
  }

  _checkRemoteDBAvailability () {
    return Boolean(this.dbDriver.userID) && Boolean(this.dbDriver.requestsParams.headers)
  }

  async create(data) {
    try {
      let url = this.dbDriver.storageMap.post.url(data)
      let content = this.dbDriver.storageMap.post.serialize(data)

      let result = await axios.post(url, content, this.dbDriver.requestsParams)
      let updated = this.dbDriver.storageMap.post.checkResult(result)
      
      return updated
    } catch (error) {
      if (error) {
        this.errors.push(error)
      }
      return false
    }
  }

  async update(data) {
    try {
      let url = this.dbDriver.storageMap.put.url(data)
      let content = this.dbDriver.storageMap.put.serialize(data)

      let result = await axios.put(url, content, this.dbDriver.requestsParams)
      let updated = this.dbDriver.storageMap.put.checkResult(result)
      return updated
    } catch (error) {
      if (error) {
        this.errors.push(error)
      }
      return false
    }
  }

  async deleteOne(data) {
    try {
      let url = this.dbDriver.storageMap.deleteOne.url(data)
      let result = await axios.delete(url, this.dbDriver.requestsParams)
      let updated = this.dbDriver.storageMap.deleteOne.checkResult(result)
      return updated
    } catch (error) {
      if (error) {
        this.errors.push(error)
      }
      return false
    }
  }

  async deleteMany(data) {
    try {
      let url = this.dbDriver.storageMap.deleteMany.url(data)

      let result = await axios.delete(url, this.dbDriver.requestsParams)
      let updated = this.dbDriver.storageMap.deleteMany.checkResult(result)
      return updated
    } catch (error) {
      if (error) {
        this.errors.push(error)
      }
      return false
    }
  }

  async query(data) {
    try {
      let url = this.dbDriver.storageMap.get.url(data)
      let result = await axios.get(url, this.dbDriver.requestsParams)
      let updated = this.dbDriver.storageMap.get.checkResult(result)
      return updated
    } catch (error) {
      if (error) {
        this.errors.push(error)
      }
      return false
    }
  }
}
