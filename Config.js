const fs = require('fs')
const path = require('path')
const createRenderer = require('./electron-shell')
const { getUserDataPath } = require('./utils/main/util')

const INITIAL_CONFIG = {
  registries: [],
  plugins: [],
  apps: [],
  settings: {},
  flags: {}
}

class Config {
  constructor(filePath) {
    this.filePath = filePath
    if (!fs.existsSync(filePath)) {
      this.reset()
    }
  }

  reset(config) {
    fs.writeFileSync(this.filePath, JSON.stringify(config || INITIAL_CONFIG))
  }

  setConfig(newConfig) {
    if (newConfig === null) {
      return
    }
    if (newConfig.constructor.name !== 'Object') {
      console.log('config must be object literal')
      return
    }
    fs.writeFileSync(this.filePath, JSON.stringify(newConfig, null, 2))
  }

  setItem(key, value) {
    const config = this.getItem()
    config[key] = value
    this.setConfig(config)
  }

  getItem(key, default_val) {
    const config = JSON.parse(fs.readFileSync(this.filePath))
    if (!key) {
      return default_val || config
    }
    return config[key]
  }
}

const UserConfig = new Config(path.join(getUserDataPath(), 'config.json'))

const registerGlobalUserConfig = () => {
  global.UserConfig = UserConfig
}

const startConfigEditor = () => {
  const win = createRenderer(`file://${__dirname}/ui/json-editor.html`, {
    width: 800,
    height: 600
  })
  win.setMenu(null)
}

module.exports = {
  startConfigEditor,
  registerGlobalUserConfig,
  getUserConfig: () => UserConfig
}
