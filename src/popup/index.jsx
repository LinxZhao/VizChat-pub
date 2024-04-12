import { render } from 'preact'
import Popup from './Popup'
import '../_locales/i18n-react'
import { getUserConfig } from '../config/index.mjs'
import { config as menuConfig } from '../content-script/menu-tools/index.mjs'
import Browser from 'webextension-polyfill'
import { setCapturedBase64Screenshot } from '../background/screenshot.mjs'

getUserConfig().then(async (config) => {
  if (config.clickIconAction === 'popup' || (window.innerWidth > 100 && window.innerHeight > 100)) {
    render(<Popup />, document.getElementById('app'))
  } else {
    const message = {
      itemId: config.clickIconAction,
      selectionText: '',
      useMenuPosition: false,
    }
    console.debug('custom icon action triggered', message)

    if (config.clickIconAction in menuConfig) {
      const currentTab = (await Browser.tabs.query({ active: true, currentWindow: true }))[0]

      if (menuConfig[config.clickIconAction].action) {
        menuConfig[config.clickIconAction].action(false, currentTab)
      }

      if (menuConfig[config.clickIconAction].genPrompt) {
        console.log('popup send message clicked')
        console.log('current tab id: ' + currentTab.id)
        console.log(currentTab)
        Browser.tabs.captureVisibleTab(null, { format: 'png' }).then((result) => {
          console.log('initial screenshot captured: ', result)

          Browser.runtime
            .sendMessage({
              type: 'SAVE_IMAGE',
              imageUrl: result,
            })
            .then(() => {
              Browser.tabs.sendMessage(currentTab.id, {
                type: 'CREATE_CHAT',
                data: message,
                tabId: currentTab.id,
                // imageUrl: result
              })
            })
        })
        // Browser.tabs.sendMessage(currentTab.id, {
        //   type: 'CREATE_CHAT',
        //   data: message,
        //   tabId: currentTab.id
        // })
      }
    }
    window.close()
  }
})
