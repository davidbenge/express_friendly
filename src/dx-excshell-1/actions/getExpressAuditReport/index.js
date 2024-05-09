/**
 * getExpressAuditReport
 *
 * 
 */


const fetch = require('node-fetch')
const { errorResponse, checkMissingRequestInputs, contentInit, stringParameters } = require('../utils')
const { Core, State, Files, Logger } = require('@adobe/aio-sdk')
const { getAemAssetData, writeJsonExpressCompatibiltyReportToComment, addMetadataToAemAsset } = require('../aemCscUtils')
const { AssetReportEngine } = require('../assetReport')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  //logger.debug(stringParameters(params))

  const actionName = 'getExpressAuditReport'
  /*********
   * Benge in line debugging hack
   * basicly i append onto the response object a property called debug and put all the output mesagest on there.  
   * This helps me get info back in real time.  Also the log can contain calls from other action calls.  I want to see the output of the
   * exact call that is being made.  This is a hack to get that info.
   * 
   * log parameters, only if params.LOG_LEVEL === 'debug'
   *
   */
  let content = {}
  if(params.LOG_LEVEL === 'debug'){
    if(typeof content.debug == 'undefined') {
      content.debug = {}
      content.debug[actionName] = []
    }
  }

  debuggerOutput = function(message){
    logger.debug(message)
    if(params.LOG_LEVEL === 'debug'){
      if(typeof message === 'string'){
        content.debug[actionName].push({"debugMessage":message})
      }else{
        content.debug[actionName].push(message)
      }
    }
  }

  try {
    // check for missing request input parameters and headers
    const requiredParams = []
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }


    /***
     * Main work start
     */

    let assetReportEngine = new AssetReportEngine()
    let assetReport = await assetReportEngine.getAssetReportData()

    debuggerOutput('assetReport')
    debuggerOutput(assetReport)
    debuggerOutput(assetReport.filename)
    content.assetReport = assetReport

    const response = {
      statusCode: 200,
      body: content
    }
    
    debuggerOutput(`************************* ${actionName} DONE *************************`)
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
