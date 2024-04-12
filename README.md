# VizChat

This extension offers you a shortcut to use gpt-4-vision-preview model to analyse the opened web page.

## How to install

### Get the extension file

You can find the newest release version in a zip format in release tab.

OR you can clone the project locally and compile it by yourself using. You need to install npm and node.js to compile.
The author used npm in version 10.5.0 and node.js 21.7.2

`
npm install

npm run build
`

### Install the extension

After downloading, go to [your chrome extension page](chrome://extensions/). Enable developer mode on the top right corner. 
Then drag and drop zip file into this chrome extension page. 

If installed correctly, you can find it in extension list. Then click the 'Details' button, then toggle the 
'Pin to toolbar' to make the VizChat visible on your extension bar.

Before starting the chat, you need to add an openAI API key to access the model. The key is saved locally, so others would not 
have access to it. You can add the key in Advance option page. You can access it by right click the VizChat icon and click on
Option and click on Advanced tab.


Now you can go to a web page, refresh it, and click on the icon of VizChat to start a chat asking chatgpt questions
about the web page. 

## Feature

### Ask questions of a web page
You can click the icon on the extension tool bar. It should be on the top right corner of your chrome. Once click, a 
conversation box will appear and you can conversate with gpt-4-vision-preview about the web page that is visible to you
(without counting the conversation box of VizChat).

Be aware, this extension can only capture the part of the web page that is visible to you. You need
to make the part of webpage visible to before start the chat. 
If you want to ask question for another part of the same page, you need to close the conversation box and start a new chat.

### Refer to knowledge files
You can add knowledge file (currently can only receive pdf) and VizChat can save it in the local storage space of your 
chrome to use them as potential background knowledge. VizChat will retrieve the most relevant segment of these documents
as contextual knowledge based on your query. This means the document will be saved locally, but part of the document (the retrieved part) will be send together with your question.

The knowledge file can be added in the Advance option page. 

## Acknowledgement
This extension is developed based on: https://github.com/josStorer/chatGPTBox