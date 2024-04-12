// This module is to save the screen capture.

let captured_screenshot = ''

function getCapturedBase64Screenshot() {
  return captured_screenshot
}

function setCapturedBase64Screenshot(newBase64Screenshot) {
  captured_screenshot = newBase64Screenshot
}

export { getCapturedBase64Screenshot, setCapturedBase64Screenshot }
