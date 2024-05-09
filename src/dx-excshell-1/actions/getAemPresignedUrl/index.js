/*
* <license header>
*/

/**
 * This will expose a presigned url to map to an aem file
 */


const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { getAemAssetPresignedDownloadUrl } = require('../aemCscUtils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action get-presigned-url')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    //logger.debug(stringParameters(params))

    let outputContent = {}
     // check for missing request input parameters and headers
     const requiredParams = ['aemHost','aemAssetPath']
     const requiredHeaders = []
     const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
     if (errorMessage) {
       // return and log client errors
       return errorResponse(400, errorMessage, logger)
     }

    // get presigned url
    const presignedUrl = await getAemAssetPresignedDownloadUrl(params.aemHost,params.aemAssetPath,params,logger)

    outputContent.presignedUrl = presignedUrl
    outputContent.aemHost = params.aemHost
    outputContent.aemAssetPath = params.aemAssetPath

    let response = {
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