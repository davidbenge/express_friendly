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
const { Core, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { getAemAssetPresignedDownloadUrl } = require('../aemCscUtils')
const { getPhotoshopManifestForPresignedUrl } = require('../fireflyCscUtils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the on AEM proc complete action')
    let outputContent = {}

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(JSON.stringify(params, null, 2))

    // handle IO webhook challenge
    if(params.challenge){
      const response = {
        statusCode: 200,
        body: {challenge: params.challenge}
      }
      return response
    }

    // check for missing request input parameters and headers
    const requiredParams = []
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    //IF not PSD skip
    if(typeof params.data.repositoryMetadata !== 'undefined' && params.data.repositoryMetadata['dc:format'] === 'image/vnd.adobe.photoshop'){
      // kick off request to get the psd manifest for an aem asset
      const aemImageMetadata = params.data.repositoryMetadata
      if(aemImageMetadata['repo:size'] > 520093696){
        logger.info('Image size is greater than 500MB, skipping processing')
      }else{
        return {
          statusCode: 204,
          body: "asset too large for express"
        }
      }

      const aemAssetPath = aemImageMetadata['repo:path']
      const aemRepoId = aemImageMetadata['repo:repositoryId']
      //set downstream params
      params.LOG_LEVEL = 'debug'

      // Put in request to kick off metadat processing
      let assetPresignedUrl
      try {
        // Get presigned url for the image from AEM
        assetPresignedUrl = await getAemAssetPresignedDownloadUrl(`https://${aemRepoId}`,aemAssetPath,params,logger)
      } catch (error) {
        logger.error('presigned url pull failure')
        return errorResponse(500, 'presigned url pull failure', logger)
      }

      let preSignedCallResults
      try {
        //await getPhotoshopManifest(aemRepoPath, aemImagePath, params, logger)
        logger.debug(`getPhotoshopManifestForPresignedUrl ${assetPresignedUrl}`)
        logger.debug(JSON.stringify(params, null, 2))
        logger.debug(`type of logger is ${typeof logger}`)
        logger.debug('getPhotoshopManifestForPresignedUrl')
        params.throwIoEvent = true //throw an IO event for the manifest job completion
        preSignedCallResults = await getPhotoshopManifestForPresignedUrl(assetPresignedUrl,params,logger)
      } catch (error) {
        logger.error('getPhotoshopManifestForPresignedUrl failure')
        logger.error(JSON.stringify(error))
        return errorResponse(500, 'getPhotoshopManifestForPresignedUrl failure', logger)
      }
      
      let psApiJobId
      try {
        // log the jobId and asset data for mapping when the event returns
        psApiJobId = preSignedCallResults['_links'].self.href
      } catch (error) {
        logger.error('preSignedCallResults failure')
        return errorResponse(500, 'preSignedCallResults failure', logger)
      }
      
      try {
        const jobSecodaryData = {
          aemHost:`https://${aemRepoId}`,
          aemAssetPath: aemAssetPath,
          aemAssetPresignedDownloadPath: assetPresignedUrl,
          aemAssetSize: aemImageMetadata['repo:size'],
          aemAssetMetaData: aemImageMetadata
        }
        const state = await State.init()
        await state.put(psApiJobId,jobSecodaryData,{ ttl: 18000 }) //saved for 18 hours ish
  
        outputContent.jobData = jobSecodaryData
        outputContent.jobId = psApiJobId
        
      } catch (error) {
        logger.error('state save failure')
        return errorResponse(500, 'state save failure', logger)
      }

    }else{
      if(typeof params.data.repositoryMetadata === 'undefined'){
        logger.debug('No repository metadata found')
        outputContent.status = 'skipped - no metadata found'
      }else if(params.data.repositoryMetadata['dc:format'] === 'image/vnd.adobe.photoshop'){
        logger.debug(`Not a psd file, skipping processing ${params.data.repositoryMetadata['dc:format']}`)
        outputContent.status = `skipped - no metadata found ${params.data.repositoryMetadata['dc:format']}`
      }
    }

    const response = {
      statusCode: 200,
      body: outputContent
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
