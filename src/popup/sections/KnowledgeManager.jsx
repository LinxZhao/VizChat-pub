import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
// // import pdfjs from '../../js/build/pdf.mjs'
// // import pdfjsWorker from
import * as pdfjs from '../../js/js/pdf.mjs'
// DO NOT delete this import of worker. We need it to load the pdf work js.
import worker from '../../js/js/pdf.worker.mjs'
import { useEffect, useState } from 'react'
import Browser from 'webextension-polyfill'
import { round } from 'lodash-es/math'
import { TokenTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Checkbox, message } from 'antd'
import { splitText, test } from '../../background/index.mjs'

KnowledgeManager.propTypes = {
  config: PropTypes.object.isRequired,
  updateConfig: PropTypes.func.isRequired,
}

export function KnowledgeManager({ config, updateConfig }) {
  const { t } = useTranslation()
  // pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;
  // console.log(__dirname);
  // console.log(worker)
  // const [inputText, setInputText] = useState('');
  const [storageUsage, setStorageUsage] = useState(0)
  const [docNameListLocal, setDocNameListLocal] = useState([])
  const [selectedCheckBox, setSelectedCheckBox] = useState([])
  // const [selectedCheckBoxValue, setSelectedCheckBoxValue] = useState([])

  const CheckboxGroup = Checkbox.Group

  // pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  pdfjs.GlobalWorkerOptions.workerSrc = '../pdf.js/src/pdf.worker.js'

  //initialisation
  useEffect(() => {
    checkUsageOfSpace()
    checkDocNameListLocal()

    // test()
    // registerStorageListener()
  }, [])

  //
  // handlers
  //
  const fileInputHandler = async (e) => {
    // process the uploaded knowledge file.
    //
    console.log(e.target.files[0])
    const file = e.target.files[0]
    const filename = file.name

    // check if fill exists in the local storage
    if (await isFileExistLocal(filename)) {
      message.error('Upload file already exists in the local storage', 3)
      return
    }

    console.log('filename: ' + filename)
    const fileReader = new FileReader()
    let fileContentList = []
    let fileText = ''

    fileReader.onload = (e) => {
      let rawArray = new Uint8Array(e.target.result)
      console.log(e)
      console.log('raw array ↓')
      console.log(rawArray)
      const pdfPromise = pdfjs.getDocument({ data: rawArray }).promise
      pdfPromise.then(async (pdfRes) => {
        for (let pageNum = 1; pageNum <= pdfRes.numPages; pageNum++) {
          const page = await pdfRes.getPage(pageNum)
          const text = await page.getTextContent()
          for (const itemsKey in text.items) {
            fileText += text.items[itemsKey].str
          }
          fileContentList.push(text)
        }
        console.log('text content ↓')
        console.log(fileContentList)
        console.log(fileText)
        // langchain embedding model tutorial: https://js.langchain.com/docs/modules/data_connection/text_embedding/
        // https://js.langchain.com/docs/integrations/text_embedding/openai
        // langchain tokenTextSplitter: https://js.langchain.com/docs/modules/data_connection/document_transformers/token_splitter
        // https://js.langchain.com/docs/get_started/quickstart
        // https://js.langchain.com/docs/modules/data_connection/retrievers/
        // embedding: https://platform.openai.com/docs/guides/embeddings/embedding-models
        // hnswlib-node: https://js.langchain.com/docs/integrations/vectorstores/hnswlib
        // !!! https://js.langchain.com/docs/modules/data_connection/vectorstores/

        await recordDocument(filename, fileText)
        checkDocNameListLocal()
        // const vectorStoreLocal = await Browser.storage.local.get("vectorStorage");
        //
        // if (Object.keys(vectorStoreLocal).length === 0) {
        //   // if no vectorStore, create it and save it
        //   const vectorStore = await MemoryVectorStore.fromDocuments(splittedDocuments, embeddings)
        //   const retriever = vectorStore.asRetriever(4);
        //   console.log(retriever.getRelevantDocuments("This is my thing"));
        //   await Browser.storage.local.set({ 'vectorStorage': vectorStore});
        // } else {
        //   // there is, load it, add it, save it again
        //   const vectorStore = vectorStoreLocal["vectorStorage"];
        //   console.log("vector storage local:")
        //   console.log(vectorStore)
        //   await vectorStore.addDocuments(splittedDocuments)
        //   const retriever = vectorStore.asRetriever(4);
        //   console.log(retriever.getRelevantDocuments("This is my thing"));
        //   await Browser.storage.local.set({ 'vectorStorage': vectorStore});
        // }
      })
    }

    // Entrance is over here
    fileReader.readAsArrayBuffer(file)
  }

  const checkUsageOfSpace = () => {
    Browser.storage.local.getBytesInUse().then((res) => {
      console.log('current space usage: ' + res)
      setStorageUsage(round(res / 1024 / 1024, 3))
    })
  }


  const isFileExistLocal = async (filename) => {
    const fileRecord = await Browser.storage.local.get(filename)
    console.log(fileRecord)
    return Object.keys(fileRecord).length > 0
  }
  const checkDocNameListLocal = () => {
    Browser.storage.local.get('docNameList').then((docNameList) => {
      // check existence
      if (Object.keys(docNameList).length === 0) return
      const actualDocNameList = docNameList['docNameList']
      const newDocNameList = []
      for (const actualDocNameListKey in actualDocNameList) {
        newDocNameList.push(actualDocNameList[actualDocNameListKey])
      }
      console.log('DocNameList updated after load doc↓')
      console.log(actualDocNameList)
      setDocNameListLocal(newDocNameList)
    })
  }
  const recordDocument = async (documentName, documentContent) => {

    const res = await splitText(documentContent, config)

    try {
      console.log('splitter res: ↓')
      console.log(res)
      const embeddings = new OpenAIEmbeddings({
        // openAIApiKey: config.apiKey, // In Node.js defaults to process.env.OPENAI_API_KEY
        openAIApiKey: config.apiKey, // In Node.js defaults to process.env.OPENAI_API_KEY
        batchSize: 512, // Default value if omitted is 512. Max is 2048
        modelName: 'text-embedding-3-small',
      })

      const docEmbedding = await embeddings.embedDocuments(res)

      const embeddingsToSave = {}
      embeddingsToSave[documentName] = {
        vector: docEmbedding,
        text: res,
      }
      let docNameList = await Browser.storage.local.get('docNameList')

      // adding the indexing
      if (Object.keys(docNameList).length === 0) {
        const docNameList = []
        docNameList.push(documentName)
        await Browser.storage.local.set({ docNameList: docNameList })
      } else {
        docNameList = docNameList['docNameList']
        docNameList.push(documentName)
        await Browser.storage.local.set({ docNameList: docNameList })
      }
      // set the data
      Browser.storage.local.set(embeddingsToSave).then(() => {
        checkUsageOfSpace()
      })

      // refresh the doc list
      setDocNameListLocal((prevState) => [...prevState, documentName])
    } catch (e) {
      message.error('Document recording failed, error: ' + e.toString())
    }


  }

  // const registerStorageListener = () => {
  //   // https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event
  //   window.addEventListener("storage", (e) => {
  //     console.log("storage event triggered")
  //     console.log(e)
  //     if (e.key === "docNameList") {
  //       console.log("storage event entered deeper")
  //       checkUsageOfSpace()
  //     }
  //   })
  //
  // }

  const deleteHandler = async (e) => {
    const docNameList = await Browser.storage.local.get('docNameList')
    const actualDocNameList = docNameList['docNameList'].slice()
    const updateList = []
    console.log(selectedCheckBox)
    for (let i = 0; i < actualDocNameList.length; i++) {
      if (!selectedCheckBox.includes(i)) updateList.push(actualDocNameList[i])
      else await Browser.storage.local.remove(actualDocNameList[i])
    }
    console.log(updateList)
    Browser.storage.local.set({ docNameList: updateList }).then(() => {
      checkUsageOfSpace()
    })
    setDocNameListLocal(updateList)
    setSelectedCheckBox([])
  }

  const chunkSizeHandler = (e) => {
    const value = e.target.value
    updateConfig({ chunkSize: value })
  }
  const conversationStarter = (e) => {
    const value = e.target.value
    updateConfig({ initialCallBack: value })
  }
  const uploadHandler = (e) => {
    console.log(e)
  }

  const onCheckBoxChange = (e) => {
    setSelectedCheckBox(e)
    console.log(e)
  }

  return (
    <>
      <label>
        {t('Conversation starter')}
        <input
          id="Conversation-starter"
          type="text"
          onChange={conversationStarter}
          value={config.initialCallBack}
        />
      </label>
      <div>
        Local storage usage: {storageUsage} MB
        <hr />
      </div>
      <label htmlFor="KnowledgeContextFileUploader">
        {t('Chunk size for splitting uploaded document')}
        <input
          id="ChunkSizeInputer"
          type="number"
          onChange={chunkSizeHandler}
          value={config.chunkSize}
        />
      </label>
      <label htmlFor="">
        {t('Upload a knowledge file (currently supporting PDF only)')}
        <input id="KnowledgeContextFileUploader" type="file" onChange={fileInputHandler} />
      </label>
      <form>
        <hr />

        <label>Saved knowledge files</label>

        <CheckboxGroup
          value={selectedCheckBox}
          options={docNameListLocal.map((x, i) => ({
            label: x,
            value: i,
          }))}
          onChange={onCheckBoxChange}
        />
        {/*{docNameListLocal.map((filename, index) => (*/}
        {/*  <label key={index}>*/}
        {/*    <input*/}
        {/*      type="checkbox"*/}
        {/*    />*/}
        {/*    {filename}*/}
        {/*  </label>*/}
        {/*))*/}
        {/*}*/}
        <hr />

        <button type="button" onClick={deleteHandler}>
          {t('Delete selected document')}
        </button>
        {/*</Modal>*/}
      </form>
      {/*{config.apiModes.map((modelName) => {*/}
      {/*  let desc*/}
      {/*  if (modelName.includes('-')) {*/}
      {/*    const splits = modelName.split('-')*/}
      {/*    if (splits[0] in Models)*/}
      {/*      desc = `${t(Models[splits[0]].desc)} (${t(ModelMode[splits[1]])})`*/}
      {/*  } else {*/}
      {/*    if (modelName in Models) desc = t(Models[modelName].desc)*/}
      {/*  }*/}
      {/*  if (desc)*/}
      {/*    return (*/}
      {/*      <label key={modelName}>*/}
      {/*        <input*/}
      {/*          type="checkbox"*/}
      {/*          checked={config.activeApiModes.includes(modelName)}*/}
      {/*          onChange={(e) => {*/}
      {/*            const checked = e.target.checked*/}
      {/*            const activeApiModes = config.activeApiModes.filter((i) => i !== modelName)*/}
      {/*            if (checked) activeApiModes.push(modelName)*/}
      {/*            updateConfig({ activeApiModes })*/}
      {/*          }}*/}
      {/*        />*/}
      {/*        {desc}*/}
      {/*      </label>*/}
      {/*    )*/}
      {/*})}*/}
    </>
  )
}
