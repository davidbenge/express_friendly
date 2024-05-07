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
  const content = contentInit(params) 
  logger.debug(stringParameters(params))

  const actionName = 'expressAudit'
  let debuggerOutput = null
  
  try {
    // 'info' is the default level if not set
    logger.info('Calling the main check manifest function')

    // check for missing request input parameters and headers
    const requiredParams = ['manifest','aemHost','aemAssetPath']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // log parameters, only if params.LOG_LEVEL === 'debug'
    if(params.LOG_LEVEL === 'debug'){
      if(typeof content.debug == 'undefined') {
        content.debug = {}
        content.debug[actionName] = []
      }
    }

    debuggerOutput = function(message){
      if(params.LOG_LEVEL === 'debug'){
        if(typeof message === 'string'){
          logger.debug(message)
          content.debug[actionName].push({"debugMessage":message})
        }else{
          logger.debug(JSON.stringify(message, null, 2))
          content.debug[actionName].push(message)
        }
      }
    }

    content.artboardCount = 0
    debuggerOutput('manifest clean')
    let manifestClean
    if(typeof params.manifest !== "object") {
      debuggerOutput('manifest type string')
      return errorResponse(400, 'manifest type is not an json object', logger)
    }else{
      debuggerOutput('manifest clean object')
      manifestClean = params.manifest
    }
    
    //output params to output structure
    //debuggerOutput(params)

    /**** 
     * Checks logic 
     * 
     * 1. get size < 500mb
     * 2. Art board count
     * 3. Smart object with non rasterized layers
     * 4. Text layers with style
     * 5. width and height < 8k
     * 
     * */
    let assetReportEngine = new AssetReportEngine()
    let assetReport = assetReportEngine.getNewAssetReport()

    // too many artboards?  #2
    assetReport.setArtboardCount(manifestClean)
    assetReport.setReportValuesBasedOnManifest(manifestClean)
    /*
    content.artboardCount = numberOfArtBoardsInManifest(manifestClean)
    content.artboardCountOk = content.artboardCount > 1 ? false : true
    content.status = content.artboardCountOk ? 'ok' : 'error'
    content.bitDepth = manifestClean.outputs[0].document.bitDepth
    // 5. width and height < 8k
    content.width = manifestClean.outputs[0].document.width
    content.widthOk = content.width > 8000 ? false : true
    content.status = content.widthOk ? 'ok' : 'error'
    // 5. width and height < 8k
    content.height = manifestClean.outputs[0].document.height
    content.heightOk = content.height > 8000 ? false : true
    content.status = content.heightOk ? 'ok' : 'error'
    content.iccProfileName = manifestClean.outputs[0].document.iccProfileName
    content.imageMode = manifestClean.outputs[0].document.imageMode
    */

    //if the call was done after events collected all the needed aem data we can skip hitting aem again
    // 1. get size < 500mb
    if(typeof params.jobSecodaryData !== 'undefined'){
      //content.size = params.jobSecodaryData.aemAssetSize
      //content.sizeOk = content.size > 520093696 ? false : true
      //content.status = content.sizeOk ? 'ok' : 'error'
      assetReport.setReportValuesBasedOnSecondaryJobData(params.jobSecodaryData)
    }
    else{
      // Change this to the path of the image you want to check
      const aemImageData = await getAemAssetData(params.aemHost,params.aemAssetPath,params,logger)
      debuggerOutput('aemImageData')
      debuggerOutput(aemImageData)

      if(typeof aemImageData !== 'undefined' && typeof aemImageData.body !== 'undefined'){
        debuggerOutput("aem file got image data")
        debuggerOutput(aemImageData)
        assetReport.setValuesBasedOnAemAssetDataCall(aemImageData)
      }else{
        debuggerOutput(aemImageData)
        debuggerOutput("failed to get aem file data")
        logger.error("Failed to get aem file data")
      }
    } 

    // Write the report to the asset
    await writeJsonExpressCompatibiltyReportToComment(params.aemHost,params.aemAssetPath,assetReport.getReportAsJson(),params,logger)

    const metadataValue = assetReport.status === 'ok' ? true : false
    await addMetadataToAemAsset(params.aemHost,params.aemAssetPath,"/express-friendly",metadataValue,params,logger)
    
    debuggerOutput(assetReport.getReportAsJson())
    content["asset_report"] = assetReport.getReportAsJson()

    // Mark job complete
    params.jobSecodaryData.processingComplete = true
    const state = await State.init()
    const jobData = await state.put(params.jobSecodaryData.psApiJobId,params.jobSecodaryData,{ ttl: 18000 })

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
