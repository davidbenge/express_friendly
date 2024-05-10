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

    debuggerOutput('manifest clean')
    let manifestClean
    if(typeof params.manifest !== "object") {
      debuggerOutput('manifest type string')
      return errorResponse(400, 'manifest type is not an json object', logger)
    }else{
      debuggerOutput('manifest clean object')
      manifestClean = params.manifest
    }
    
    /**** 
     * Checks logic - via Ryan Mulvaney 5-24
     * 
     * 1. Filesize is greater than 500 MB +
     * 2. image size is greater than 8k by 8k +
     * 3. Color space equals sRGB (can't be CMKY)
     * 4. File has more than one artboard +
     * 5. File has Less than 10 photoshop layers (this one I'm kind of making up.  There's no real guidance here so maybe skip but anything with more than 10 layers just seems like a lot to handle in Express for a non creative)
     * 6. A layer contains a Smart Object
     * 7. A Text layer has a layer style applied
     * 8. A non Adobe Font is used (There is not an existing list of all Adobe Fonts so I'm not sure how this would flag in the manifest but the photoshop file does flag if a font is missing when opened.  I should show you an example with one of the Pfizer files if needed) (edited) 
     * 
     * */
    let assetReportEngine = new AssetReportEngine()
    let assetReport = assetReportEngine.getNewAssetReport()
    debuggerOutput(`${actionName} got new action report object`)

    // too many artboards?  #2
    //assetReport.setArtboardCount(manifestClean)
    assetReport.setReportValuesBasedOnManifest(manifestClean)

    if(typeof params.jobSecodaryData !== 'undefined'){
      assetReport.setReportValuesBasedOnSecondaryJobData(params.jobSecodaryData)
    }
    else{
      // Change this to the path of the image you want to check
      const aemImageData = await getAemAssetData(params.aemHost,params.aemAssetPath,params,logger)
      debuggerOutput('aemImageData')
      //debuggerOutput(aemImageData)

      if(typeof aemImageData !== 'undefined' && typeof aemImageData.body !== 'undefined'){
        debuggerOutput("aem file got image data")
        //debuggerOutput(aemImageData)
        assetReport.setValuesBasedOnAemAssetDataCall(aemImageData)
      }else{
        //debuggerOutput(aemImageData)
        debuggerOutput("failed to get aem file data")
        logger.error("Failed to get aem file data")
      }
    } 

    // Write the report to the asset
    await writeJsonExpressCompatibiltyReportToComment(params.aemHost,params.aemAssetPath,assetReport.getReportAsJson(),params,logger)
    debuggerOutput("getAemFileExpressAudit done with writeJsonExpressCompatibiltyReportToComment")

    const metadataValue = assetReport.status === 'ok' ? 'should work' : 'will require work'
    await addMetadataToAemAsset(params.aemHost,params.aemAssetPath,"/express-friendly",metadataValue,params,logger)
    debuggerOutput("getAemFileExpressAudit done with addMetadataToAemAsset")
    
    debuggerOutput(assetReport.getReportAsJson())
    content["asset_report"] = assetReport.getReportAsJson()
    debuggerOutput("getAemFileExpressAudit done with asset_report response object")

    // Mark job complete
    params.jobSecodaryData.processingComplete = true
    const state = await State.init()
    const jobData = await state.put(params.jobSecodaryData.psApiJobId,params.jobSecodaryData,{ ttl: 18000 })
    debuggerOutput("getAemFileExpressAudit finished the state update")

    const response = {
      statusCode: 200,
      body: content
    }

    /****
     * do we need to save a report?
     */
    let reportResult
    if(params.GENERATE_AUDIT_REPORT_LOG === 'true' || params.GENERATE_AUDIT_REPORT_LOG === true){
      reportResult = await assetReportEngine.saveCurrentAssetReport()
      //debuggerOutput(`getAemFileExpressAudit finished the report save ${JSON.stringify(reportResult, null, 2)}`)
      debuggerOutput(`getAemFileExpressAudit finished the report save`)
    }

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
