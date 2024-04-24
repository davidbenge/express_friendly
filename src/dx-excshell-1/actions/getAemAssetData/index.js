/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const fetch = require('node-fetch')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs, contentInit, getAemServiceAccountToken } = require('../utils')
const { Core, State, Files, Logger } = require('@adobe/aio-sdk')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  const actionName = 'getAemAssetData'
  let debuggerOutput = null
  try{
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['aemHost','aemAssetPath']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }
    const content = contentInit(params)  

    content.aemHost = params.aemHost
    content.aemAssetPath = params.aemAssetPath

    moduleOutput = function(data){
      content.modules[actionName] = data
    }
  
    // log parameters, only if params.LOG_LEVEL === 'debug'
    if(params.LOG_LEVEL === 'debug'){
      if(typeof content.debug == 'undefined') {
        content.debug = {}
        content.debug[actionName] = []
      }
  
      debuggerOutput = function(message){
        content.debug[actionName].push(message)
      }
    }
    
    let aemAuthToken = await getAemServiceAccountToken(params,logger)
    
    // fetch content from external api endpoint
    const fetchUrl = params.aemHost + params.aemAssetPath + '.2.json'
    const res = await fetch(fetchUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + aemAuthToken,
        'Content-Type': 'application/json'
      }
    })
    debuggerOutput('response: ' + res)
    if (!res.ok) {
      throw new Error('request to ' + fetchUrl + ' failed with status code ' + res.status)
    }else{
      debuggerOutput('response ok')
      content.aemImageData = await res.json()
    }

    const response = {
      statusCode: 200,
      body: content
    }

    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
