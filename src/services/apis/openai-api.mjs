// api version

import { Models, getContextInfo, getUserConfig } from '../../config/index.mjs'
import { fetchSSE } from '../../utils/fetch-sse.mjs'
import { getConversationPairs } from '../../utils/get-conversation-pairs.mjs'
import { isEmpty } from 'lodash-es'
import {
  getChatSystemPromptBase,
  getCompletionPromptBase,
  pushRecord,
  setAbortController,
} from './shared.mjs'
import Browser from 'webextension-polyfill'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Document } from 'langchain/document'
import { ConstantValues } from '../../utils/MyConstant.js'
/**
 * @param {Browser.Runtime.Port} port
 * @param {string} question
 * @param {Session} session
 * @param {string} apiKey
 * @param {string} modelName
 */
export async function generateAnswersWithGptCompletionApi(
  port,
  question,
  session,
  apiKey,
  modelName,
) {
  const { controller, messageListener, disconnectListener } = setAbortController(port)

  const config = await getUserConfig()
  const prompt =
    (await getCompletionPromptBase()) +
    getConversationPairs(
      session.conversationRecords.slice(-config.maxConversationContextLength),
      true,
    ) +
    `Human: ${question}\nAI: `
  const apiUrl = config.customOpenAiApiUrl

  let answer = ''
  await fetchSSE(`${apiUrl}/v1/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: prompt,
      model: Models[modelName].value,
      stream: true,
      max_tokens: config.maxResponseTokenLength,
      temperature: config.temperature,
      stop: '\nHuman',
    }),
    onMessage(message) {
      console.debug('sse message', message)
      if (message.trim() === '[DONE]') {
        pushRecord(session, question, answer)
        console.debug('conversation history', { content: session.conversationRecords })
        port.postMessage({ answer: null, done: true, session: session })
        return
      }
      let data
      try {
        data = JSON.parse(message)
      } catch (error) {
        console.debug('json error', error)
        return
      }
      answer += data.choices[0].text
      port.postMessage({ answer: answer, done: false, session: null })
    },
    async onStart() {},
    async onEnd() {
      port.postMessage({ done: true })
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
    },
    async onError(resp) {
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
      if (resp instanceof Error) throw resp
      const error = await resp.json().catch(() => ({}))
      throw new Error(!isEmpty(error) ? JSON.stringify(error) : `${resp.status} ${resp.statusText}`)
    },
  })
}

/**
 * @param {Browser.Runtime.Port} port
 * @param {string} question
 * @param {Session} session
 * @param {string} apiKey
 * @param {string} modelName
 */
export async function generateAnswersWithChatgptApi(port, question, session, apiKey, modelName) {
  const { controller, messageListener, disconnectListener } = setAbortController(port)

  const config = await getUserConfig()
  const prompt = getConversationPairs(
    session.conversationRecords.slice(-config.maxConversationContextLength),
    false,
  )
  prompt.unshift({ role: 'system', content: await getChatSystemPromptBase() })
  prompt.push({ role: 'user', content: question })
  const apiUrl = config.customOpenAiApiUrl

  let answer = ''
  await fetchSSE(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: prompt,
      model: Models[modelName].value,
      stream: true,
      max_tokens: config.maxResponseTokenLength,
      temperature: config.temperature,
    }),
    onMessage(message) {
      console.debug('sse message', message)
      if (message.trim() === '[DONE]') {
        pushRecord(session, question, answer)
        console.debug('conversation history', { content: session.conversationRecords })
        port.postMessage({ answer: null, done: true, session: session })
        return
      }
      let data
      try {
        data = JSON.parse(message)
      } catch (error) {
        console.debug('json error', error)
        return
      }
      answer +=
        data.choices[0]?.delta?.content ||
        data.choices[0]?.message?.content ||
        data.choices[0]?.text ||
        ''
      port.postMessage({ answer: answer, done: false, session: null })
    },
    async onStart() {},
    async onEnd() {
      port.postMessage({ done: true })
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
    },
    async onError(resp) {
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
      if (resp instanceof Error) throw resp
      const error = await resp.json().catch(() => ({}))
      throw new Error(!isEmpty(error) ? JSON.stringify(error) : `${resp.status} ${resp.statusText}`)
    },
  })
}

// load the locally stored knowledge files
async function getKnowledgeFiles(question, topN, userConfig) {
  const docNameList = await Browser.storage.local.get("docNameList")
  if (Object.keys(docNameList).length === 0) return '';
  console.log("docNameList loading finished----")
  console.log(docNameList)
  const actualDocNameList = docNameList["docNameList"]
  const embeddings = new OpenAIEmbeddings({
    // openAIApiKey: config.apiKey, // In Node.js defaults to process.env.OPENAI_API_KEY
    openAIApiKey: userConfig.apiKey, // In Node.js defaults to process.env.OPENAI_API_KEY
    modelName: 'text-embedding-3-small',
  })
  const vectorStore = new MemoryVectorStore(embeddings)
  for (let i = 0; i < actualDocNameList.length; i++) {
    const aDocument = await Browser.storage.local.get(actualDocNameList[i])
    const actualDocument = aDocument[actualDocNameList[i]]
    await vectorStore.addVectors(actualDocument["vector"], arrayToDocList(actualDocument["text"]))

  }
  const retriver = await vectorStore.asRetriever(topN)
  const retrievedDoc = await retriver.getRelevantDocuments(question)

  let resStr = "Here is context document may help: ";
  for (let i = 0; i < retrievedDoc.length; i++) {
    resStr += ((i + 1) + ". " +retrievedDoc[i].pageContent + ". ")
  }
  return resStr
}

function arrayToDocList(stringArray) {
  const returnList = []
  for (let i = 0; i < stringArray.length; i++) {
    returnList.push(new Document({pageContent: stringArray[i]}))
  }
  // console.log(returnList)
  return returnList
}

// This is the new api for chatgpt4v
export async function generateAnswersWithChatgpt4vApi(port, question, session, apiKey, modelName) {
  const { controller, messageListener, disconnectListener } = setAbortController(port)

  const config = await getUserConfig()
  const prompt = getConversationPairs(
    session.conversationRecords.slice(-config.maxConversationContextLength),
    false,
  )
  // question = await getContextInfo() + ". " + question
  let OrgQuestion = question;
  // console.log(config)
  if (question.includes(ConstantValues.initialPrompt)){
    console.log(config.initialCallBack)
    OrgQuestion = question + "'" + config.initialCallBack + "'";
  }
  else
    OrgQuestion = (await getKnowledgeFiles(question, 1, config)) +'\n\n' + (await getContextInfo()) + '. \n\nMy question is: ' + question;

  console.log('generateAnswersWithGptCompletionApi called')
  console.log('question is: ', OrgQuestion)
  console.log('model is: ', Models[modelName].value)
  console.log('prompt initial: ', prompt)

  prompt.unshift({ role: 'system', content: await getChatSystemPromptBase() })
  console.log('prompt after unshift: ', prompt)
  // todo: This part should be updated with variable. It is hardcoded for testing for now.
  prompt.push({
    role: 'user',
    content: [
      {
        type: 'text',
        // text: "What’s in this image?"
        text: OrgQuestion,
      },
      {
        type: 'image_url',
        image_url: {
          url: session.image_url,
        },
      },
    ],
  })
  console.log('prompt after push: ', prompt)
  const apiUrl = config.customOpenAiApiUrl
  // port.postMessage({ answer: "gpt4v function called", done: true, session: session })
  let answer = ''
  await fetchSSE(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: prompt,
      model: Models[modelName].value,
      stream: true,
      max_tokens: config.maxResponseTokenLength,
      temperature: config.temperature,
    }),
    onMessage(message) {
      console.debug('sse message', message)
      if (message.trim() === '[DONE]') {
        pushRecord(session, OrgQuestion, answer)
        console.debug('conversation history', { content: session.conversationRecords })
        port.postMessage({ answer: null, done: true, session: session })
        return
      }
      let data
      try {
        data = JSON.parse(message)
      } catch (error) {
        console.debug('json error', error)
        return
      }
      answer +=
        data.choices[0]?.delta?.content ||
        data.choices[0]?.message?.content ||
        data.choices[0]?.text ||
        ''
      port.postMessage({ answer: answer, done: false, session: null })
    },
    async onStart() {},
    async onEnd() {
      port.postMessage({ done: true })
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
    },
    async onError(resp) {
      port.onMessage.removeListener(messageListener)
      port.onDisconnect.removeListener(disconnectListener)
      if (resp instanceof Error) throw resp
      const error = await resp.json().catch(() => ({}))
      throw new Error(!isEmpty(error) ? JSON.stringify(error) : `${resp.status} ${resp.statusText}`)
    },
  })
}
