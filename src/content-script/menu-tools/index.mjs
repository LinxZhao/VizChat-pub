import { getCoreContentText } from '../../utils/get-core-content-text'
import Browser from 'webextension-polyfill'
import { getUserConfig } from '../../config/index.mjs'
import { openUrl } from '../../utils/open-url'
import { ConstantValues } from '../../utils/MyConstant.js'

export const config = {
  newChat: {
    label: 'New Chat',
    genPrompt: async () => {
      return ''
    },
  },
  summarizePage: {
    label: 'Start VizChat',
    genPrompt: async () => {
      // return "I will always attach an image and ask question about in later conversations. I may call this image as page. For now, simply answer: 'Hi, I am VizChat. How can I help you today?'"
      return ConstantValues.initialPrompt
    },
  },
  // openConversationPage: {
  //   label: 'Open Conversation Page',
  //   action: async (fromBackground) => {
  //     console.debug('action is from background', fromBackground)
  //     if (fromBackground) {
  //       openUrl(Browser.runtime.getURL('IndependentPanel.html'))
  //     } else {
  //       Browser.runtime.sendMessage({
  //         type: 'OPEN_URL',
  //         data: {
  //           url: Browser.runtime.getURL('IndependentPanel.html'),
  //         },
  //       })
  //     }
  //   },
  // },
  // openConversationWindow: {
  //   label: 'Open Conversation Window',
  //   action: async (fromBackground) => {
  //     console.debug('action is from background', fromBackground)
  //     if (fromBackground) {
  //       const config = await getUserConfig()
  //       const url = Browser.runtime.getURL('IndependentPanel.html')
  //       const tabs = await Browser.tabs.query({ url: url, windowType: 'popup' })
  //       if (!config.alwaysCreateNewConversationWindow && tabs.length > 0)
  //         await Browser.windows.update(tabs[0].windowId, { focused: true })
  //       else
  //         await Browser.windows.create({
  //           url: url,
  //           type: 'popup',
  //           width: 500,
  //           height: 650,
  //         })
  //     } else {
  //       Browser.runtime.sendMessage({
  //         type: 'OPEN_CHAT_WINDOW',
  //         data: {},
  //       })
  //     }
  //   },
  // },
  // openSidePanel: {
  //   label: 'Open Side Panel',
  //   action: async (fromBackground, tab) => {
  //     console.debug('action is from background', fromBackground)
  //     if (fromBackground) {
  //       // eslint-disable-next-line no-undef
  //       chrome.sidePanel.open({ windowId: tab.windowId, tabId: tab.id })
  //     } else {
  //       // side panel is not supported
  //     }
  //   },
  // },
  closeAllChats: {
    label: 'Close All Chats In This Page',
    action: async (fromBackground) => {
      console.debug('action is from background', fromBackground)
      Browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        Browser.tabs.sendMessage(tabs[0].id, {
          type: 'CLOSE_CHATS',
          data: {},
        })
      })
    },
  },
}
