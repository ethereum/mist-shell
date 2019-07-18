const { EventEmitter } = require('events')
const path = require('path')
const createRenderer = require('../electron-shell')
const WindowManager = require('../WindowManager')
const {
  AppManager: PackageManager
} = require('@philipplgh/electron-app-manager')

const { getUserConfig } = require('../Config')
const UserConfig = getUserConfig()

const is = require('../utils/main/is')

const gridUiManager = new PackageManager({
  repository: 'https://github.com/ethereum/grid-ui',
  auto: false,
  logger: require('debug')('GridPackageManager'),
  policy: {
    onlySigned: false
  }
})

const getGridUiUrl = async () => {
  const useHotLoading = false
  if (is.dev()) {
    let appUrl = 'http://localhost:3080/'
    return appUrl
  } else {
    if (useHotLoading) {
      return 'package://github.com/ethereum/grid-ui'
    }
    // else: use caching
    let packagePath = 'TODO'
    let appUrl = await gridUiManager.load(packagePath)
    console.log('app url: ' + appUrl)
    return appUrl
  }
}

class AppManager extends EventEmitter {
  constructor() {
    super()
  }
  async getAppsFromRegistries() {
    let apps = []
    try {
      const registries = UserConfig.getItem('registries', [])
      for (let index = 0; index < registries.length; index++) {
        const registry = registries[index]
        try {
          const result = await PackageManager.downloadJson(registry)
          apps = [...apps, ...result.apps]
        } catch (error) {
          console.log('could not load apps from registry:', registry, error)
        }
      }
    } catch (error) {
      console.log('could not load apps from registries', error)
    }
    return apps
  }
  getAppsFromAppsJson() {
    let apps = []
    try {
      const _apps = require('./apps.json')
      apps = [..._apps]
    } catch (error) {
      console.log('error: could not parse apps.json', error)
    }
    return apps
  }
  getAppsFromConfig() {
    let apps = []
    try {
      const _apps = UserConfig.getItem('apps', [])
      apps = [..._apps]
    } catch (error) {
      console.log('could not read user-defined apps', error)
    }
    return apps
  }
  // @deprecated
  getAvailableApps() {
    return this.getAppsFromAppsJson()
  }
  async getAllApps() {
    let apps = []
    const appsJson = await this.getAppsFromAppsJson()
    const appsConfig = await this.getAppsFromConfig()
    const appsRegistries = await this.getAppsFromRegistries()
    apps = [...appsJson, ...appsConfig, ...appsRegistries]
    return apps
  }
  async launch(app) {
    console.log('launch app: ', app.name)

    if (app.id) {
      const win = WindowManager.getById(app.id)
      if (win) {
        win.show()
        return win.id
      }
    }

    const { dependencies } = app
    if (dependencies) {
      for (const dependency of dependencies) {
        console.log('found dependency', dependency)
        const plugin = global.PluginHost.getPluginByName(dependency.name)
        console.log('plugin found?', plugin.name, plugin.isRunning)
        if (plugin.isRunning) {
          // ignore - good enough for now but not correct behavior
          console.log('nothing to do')
        } else {
          // const persistedFlags = (await Grid.Config.getItem('flags')) || {}
          // const flags = persistedFlags[this.client.plugin.name]
          console.log('request start')
          try {
            await plugin.requestStart(app)
          } catch (error) {
            // e.g. user cancelled
            console.log('error', error)
            return // do NOT start in this case
          }
        }
      }
    }

    if (app.name === 'grid-ui') {
      const { args } = app
      let appUrl = await getGridUiUrl()
      const { scope } = args
      const { client: clientName, component } = scope
      if (component === 'terminal') {
        appUrl = `file://${path.join(__dirname, '..', 'ui', 'terminal.html')}`
      }
      const clientDisplayName = 'Geth'
      let mainWindow = createRenderer(
        appUrl,
        {
          x: 400,
          y: 400,
          backgroundColor: component === 'terminal' ? '#1E1E1E' : '#202225'
        },
        {
          scope
        }
      )
      mainWindow.setMenu(null)
      /*
      mainWindow.webContents.openDevTools({
        mode: 'detach'
      })
      */
      mainWindow.setTitle('Ethereum Grid Terminal for ' + clientDisplayName)
      return mainWindow.id
    }

    let url = app.url || 'http://localhost:3000'
    const mainWindow = createRenderer(
      await getGridUiUrl(), // FIXME might be very inefficient. might load many grid-ui packages into memory!!
      {},
      {
        url,
        isApp: true,
        app
      }
    )
  }
  hide(windowId) {
    return WindowManager.hide(windowId)
  }
}

const registerGlobalAppManager = () => {
  global.AppManager = new AppManager()
  return global.AppManager
}

module.exports.registerGlobalAppManager = registerGlobalAppManager

module.exports.AppManager = AppManager
