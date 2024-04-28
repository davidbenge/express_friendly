/*
* <license header>
*/

/**
 * This will expose a presigned url to map to an aem file
 */


const fetch = require('node-fetch')
const { Core, State } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action get-presigned-url')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    let outputContent = {}

    // check for missing request input parameters and headers
    const requiredParams = ['aemHost','aemAssetPath']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // DO STUFF
    let aemAuthToken = await getAemServiceAccountToken(params,logger)
    let aemPresignedUrl = null
    // get asset 
    // fetch content from external api endpoint
    const fetchUrl = params.aemHost + '/adobe/repository?path='+params.aemAssetPath
    const res = await fetch(fetchUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + aemAuthToken,
        'Content-Type': 'application/json',
        'x-api-key': params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID
      }
    })
    if (!res.ok) {
      logger.error('request to ' + fetchUrl + ' failed with status code ' + res.status)
      throw new Error('request to ' + fetchUrl + ' failed with status code ' + res.status)
    }else{
      const resolverData = await res.json()
      //get a presigned url
      const fetchPresignedUrl = resolverData['_links']['http://ns.adobe.com/adobecloud/rel/download'].href
      const resPresigned = await fetch(fetchPresignedUrl, {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + aemAuthToken,
          'Content-Type': 'application/json',
          'x-api-key': params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID
        }
      })
      if (!resPresigned.ok) {
        logger.error('request to ' + fetchPresignedUrl + ' failed with status code ' + resPresigned.status)
        throw new Error('request to ' + fetchPresignedUrl + ' failed with status code ' + resPresigned.status)
      }else{
        const presignedData = await resPresigned.json()
        aemPresignedUrl = presignedData['data']['href']
      }
    }

    // make a request to get a manifest
    if(aemPresignedUrl === null){
      return errorResponse(500, 'unable to get presigned url', logger)
    }else{
      const psApiManifestUrl = 'https://image.adobe.io/pie/psdService/documentManifest'
      const psApiManifestBody = {
        "inputs": [
          {
            "storage": "external",
            "href": aemPresignedUrl
          }
        ],
        "options": {
          "thumbnails": {
            "type": "image/jpeg"
          }
        }
      }
    }

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