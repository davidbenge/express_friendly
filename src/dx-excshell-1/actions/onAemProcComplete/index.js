/**
 * onAemProcComplete
 *
 * Used to filter all events down to just the asset events we want to evaluate.  
 * After filtering we set state varibles to capture the AEM asset data.  We then request a presigned url for the target aem asset.  
 * The last step is we kick off a asynchronous request to get the target assets psd manifest data
 * 
 * we subscribe this action to the Assets processing complete event in Adobe IO developer console.
 * 
 */


const fetch = require('node-fetch')
const { Core, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { getAemAssetPresignedDownloadUrl } = require('../aemCscUtils')
const { getPhotoshopManifestForPresignedUrl, sleepCscRequest } = require('../fireflyCscUtils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the on AEM proc complete action')
    const actionName = 'onAemProcComplete'

    // handle IO webhook challenge
    if(params.challenge){
      const response = {
        statusCode: 200,
        body: {challenge: params.challenge}
      }
      return response
    }

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

    // log parameters, only if params.LOG_LEVEL === 'debug' dumps all the input params so i can see all the stuff I am passing in from the event and config bindinds
    //debuggerOutput(JSON.stringify(params, null, 2))

    // check for missing request input parameters and headers
    // this call can be called via a open web api OR you can map it in IO without it being exposed to the web
    const requiredParams = []
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    //IF not a asset processing complete event skip
    if(typeof params.type !== 'undefined' && params.type !== 'aem.assets.asset.processing_completed'){

      //IF not PSD skip
      if(typeof params.data.repositoryMetadata !== 'undefined' && params.data.repositoryMetadata['dc:format'] === 'image/vnd.adobe.photoshop'){
        // kick off request to get the psd manifest for an aem asset
        const aemImageMetadata = params.data.repositoryMetadata

        // get the aem asset path and repo id for next steps
        const aemAssetPath = aemImageMetadata['repo:path']
        const aemRepoId = aemImageMetadata['repo:repositoryId']

        if(typeof aemAssetPath === 'undefined' || typeof aemRepoId === 'undefined'){
          logger.error(`aemAssetPath or aemRepoId not found in metadata`)
          logger.debug(JSON.stringify(aemImageMetadata, null, 2))
          return errorResponse(404, "asset repo or path not found in metadata", logger)
        }

        // Put in request to kick off metadat processing
        let assetPresignedUrl
        try {
          debuggerOutput(`getting presigned url for https://${aemRepoId}${aemAssetPath}`)
          // Get presigned url for the image from AEM
          assetPresignedUrl = await getAemAssetPresignedDownloadUrl(`https://${aemRepoId}`,aemAssetPath,params,logger)
          debuggerOutput(`GOT presigned url ${assetPresignedUrl}`)

          //if presigned url is not returned, return 500
          if(typeof assetPresignedUrl === 'undefined'){
            logger.error('presigned url pull failure')
            return errorResponse(500, 'presigned url generation failure', logger)
          }
        } catch (error) {
          logger.error(`presigned url pull failure ${error.message}`)
          return errorResponse(500, `presigned url generation failure ${error.message}`, logger)
        }

        let submitManifestRequestCallResults
        try {
          debuggerOutput(`onAemProcComplete:getPhotoshopManifestForPresignedUrl ${assetPresignedUrl}`)
          //debuggerOutput(JSON.stringify(params, null, 2))
          params.throwIoEvent = true //throw an IO event for the manifest job completion
          await sleepCscRequest(5000) //sleep for 5 seconds to allow the presigned url to be active
          submitManifestRequestCallResults = await getPhotoshopManifestForPresignedUrl(assetPresignedUrl,params,logger)

          if(submitManifestRequestCallResults === undefined || submitManifestRequestCallResults === null){
            logger.error('onAemProcComplete:getPhotoshopManifestForPresignedUrl failure')
            return errorResponse(500, 'onAemProcComplete:getPhotoshopManifestForPresignedUrl ', logger)
          }
          debuggerOutput(`onAemProcComplete:getPhotoshopManifestForPresignedUrl complete ${submitManifestRequestCallResults['_links'].self.href}`)
          debuggerOutput(JSON.stringify(submitManifestRequestCallResults, null, 2))

        } catch (error) {
          logger.error('getPhotoshopManifestForPresignedUrl failure')
          logger.error(JSON.stringify(error))
          return errorResponse(500, 'getPhotoshopManifestForPresignedUrl failure', logger)
        }
        
        let psApiJobId
        try {
          debuggerOutput(`getting ps api job id from the submit for manifest ${JSON.stringify(submitManifestRequestCallResults, null, 2)}`)
          // log the jobId and asset data for mapping when the event returns
          psApiJobId = submitManifestRequestCallResults['_links'].self.href.split('/').pop() //get the job id from the self link
          debuggerOutput(`onAemProcComplete:submitManifestRequestCallResults complete psApiJobId = ${psApiJobId}`)
        } catch (error) {
          logger.error('preSignedCallResults failure')
          return errorResponse(500, 'preSignedCallResults failure', logger)
        }
        
        try {
          debuggerOutput(`Setting state for the jobid ${psApiJobId}`)
          const jobSecodaryData = {
            aemHost:`https://${aemRepoId}`,
            aemAssetPath: aemAssetPath,
            aemAssetPresignedDownloadPath: assetPresignedUrl,
            aemAssetSize: aemImageMetadata['repo:size'],
            aemAssetUuid: aemImageMetadata['repo:assetId'],
            aemAssetName: aemImageMetadata['repo:name'],
            aemAssetMetaData: aemImageMetadata,
            processPassCount:0,
            processingComplete:false,
            psApiJobId:psApiJobId
          }
          const stateJob = await State.init()
          const stateSave = await stateJob.put(psApiJobId,jobSecodaryData,{ ttl: 18000 }) //saved for 18 hours ish
          debuggerOutput(`SET the state for the jobid ${psApiJobId} ${stateSave}`)

          content.jobData = jobSecodaryData
          content.jobId = psApiJobId
          
        } catch (error) {
          logger.error('state save failure')
          return errorResponse(500, 'state save failure', logger)
        }

      }else{
        if(typeof params.data.repositoryMetadata === 'undefined'){
          debuggerOutput('No repository metadata found')
          content.status = 'skipped - no metadata found'
        }else if(params.data.repositoryMetadata['dc:format'] === 'image/vnd.adobe.photoshop'){
          debuggerOutput(`Not a psd file, skipping processing ${params.data.repositoryMetadata['dc:format']}`)
          content.status = `skipped - no metadata found ${params.data.repositoryMetadata['dc:format']}`
        }
      }
    }else{
      debuggerOutput('Not an asset processing complete event')
      content.status = 'skipped - not an asset processing complete event'
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