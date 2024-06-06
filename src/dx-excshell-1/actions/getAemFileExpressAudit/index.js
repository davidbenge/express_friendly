/**
 * getAemFileExpressAudit
 *
 * Using the aem repo path,  asset path and psd manifest passed into this function we evaluate the data and build a report.  
 * After we have completed the complete audit we write the results to the assets comments and IF the asset passed all checks we 
 * put a "express safe" metadata marker on the asset.
 * 
 * this main method requires the following parameters:
 * manifest - the manifest object from the photoshop file
 * aemHost - the aem host
 * aeAssetPath - the aem asset path
 * and optional jobSecodaryData - this is the data from the job that was processed before this action was called.  This avoids us having to hit aem again to get the asset size.
 * 
 * Change Log
 * 
 * 5-30-2024
 * Field Name: Adobe Express Compatible
 * Metadata property: adobe-express-compatible
 * Result: Compatible_Linked
 *
 * Field Name: Adobe Express Compatible
 * Metadata property: adobe-express-compatible
 * Result: Compatible_Editable
 * 
 */

const { errorResponse, checkMissingRequestInputs, contentInit } = require('../utils')
const { Core, State, Files, Logger } = require('@adobe/aio-sdk')
const { runExpressReport } = require('../aemCscUtils')
const { AssetReportEngine } = require('../assetReport')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  const content = contentInit(params) 
  //logger.debug(JSON.stringify(params, null, 2))

  const actionName = 'expressAudit'
  let debuggerOutput = null
  
  try {
    // 'info' is the default level if not set
    logger.info(`Calling the main ${actionName} manifest function`)

    // check for missing request input parameters and headers
    const requiredParams = ['manifest','aemHost','aemAssetPath']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    let invokeParams = {
      "manifest": params.manifest,
      "aemHost": params.aemHost,
      "aemAssetPath": params.aemAssetPath,
      "jobSecodaryData":params.jobSecodaryData || {}

    }
    outputContent = await runExpressReport(invokeParams,params,logger)

    debuggerOutput("getAemFileExpressAudit ************************* DONE *************************")
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
