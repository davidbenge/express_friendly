/* 
* <license header>
*/

/* This file exposes some common CSC related utilities for your actions */
const { getBearerToken } = require('./utils')
const { Core, State, Files } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')
const axios = require('axios')
const { AssetReportEngine } = require('./assetReport')
const { getAemAssetData, writeJsonExpressCompatibiltyReportToComment, addMetadataToAemAsset } = require('./aemCscUtils')
/**
 * Get Firefly services service account token
 * 
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {string} fireflyApiAuthToken
 */
async function getFireflyServicesServiceAccountToken(params,logger){
   //ff auth key from cache 
   logger.debug("getFireflyServicesServiceAccountToken getting token from state")
   //logger.debug(JSON.stringify(params, null, 2))
   let authToken
   const state = await State.init()
   const stateAuth = await state.get('firefly-service-auth-key')
   
   //get from store if it exists
  if(typeof stateAuth === 'undefined' || typeof stateAuth.value === 'undefined' || stateAuth.value === null){
    // build login form for getting auth
    const formBody = new URLSearchParams({
      "client_id":`${params.FIREFLY_SERVICES_CLIENT_ID}`,
      "client_secret":`${params.FIREFLY_SERVICES_CLIENT_SECRET}`,
      "grant_type":"client_credentials",
      "scope":`${params.FIREFLY_SERVICES_SCOPES}`
    })

    logger.debug("getFireflyServicesServiceAccountToken no existing token in state")
    const fetchUrl = 'https://ims-na1.adobelogin.com/ims/token/v3'
    const rec = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', 
        'Accept': 'application/json'
    },
      body: formBody
    })

    logger.debug(`getFireflyServicesServiceAccountToken made call to service ${fetchUrl} ${JSON.stringify(rec, null, 2)}`)

    if(rec.ok){
      let responseContent = await rec.json()
      // if not reqeust a new one and put it in the store
      logger.debug(`getFireflyServicesServiceAccountToken got new one from service and saving to state ${JSON.stringify(responseContent, null, 2)}`)
      authToken = responseContent.access_token
      
      await state.put('firefly-service-auth-key', authToken, { ttl: 79200 }) // -1 for max expiry (365 days), defaults to 86400 (24 hours) 79200 is 22 hours

      return authToken
    }else{
      logger.debug("getFireflyServicesServiceAccountToken no new token from service error")
      logger.debug(JSON.stringify(rec, null, 2))
      logger.error("Failed to get firefly services auth token")
      throw new Error('request to ' + fetchUrl + ' failed with status code ' + rec.status)
    }
  }else{
    //logger.debug(`getFireflyServicesServiceAccountToken got existing token from state ${JSON.stringify(stateAuth.value)}` )
    logger.debug(`getFireflyServicesServiceAccountToken GOOD existing token from state` )
    return stateAuth.value
  }
}

/****
 * Get Firefly services auth from right place
 */
async function getFireflyServicesAuth(params,logger){
  logger.debug("getFireflyServicesAuth")
  //logger.debug(stringParameters(params))
  if(params.FIREFLY_SERVICES_USE_PASSED_AUTH === 'true'){
    logger.debug("getFireflyServicesAuth Bearer Token")
    return getBearerToken(params)
  }else{
    logger.debug("getFireflyServicesAuth getting new token from state or service")
    return await getFireflyServicesServiceAccountToken(params,logger)
  }
}

/***
 * Get photoshop manifest
 * will fire IO Event when complete
 * 
 * @param {string} targetAssetPresignedUrl presigned url to the photoshop file
 * @param {string} psApiClientId photoshop api client id
 * @param {string} psApiAuthToken photoshop api auth token
 * @param {object} logger logger object
 * 
 */
async function getPhotoshopManifestForPresignedUrl(targetAssetPresignedUrl,params,logger){
  logger.debug("in getPhotoshopManifestForPresignedUrl")
  logger.debug(JSON.stringify(params, null, 2))
  logger.debug("in getPhotoshopManifestForPresignedUrl before getFireflyServicesAuth ")
  const fetchUrl = 'https://image.adobe.io/pie/psdService/documentManifest'
  const fireflyApiAuth = await getFireflyServicesAuth(params,logger)
  const psApiManifestBody = {
    "inputs": [
      {
        "href":`${targetAssetPresignedUrl}`,
        "storage":"external"
      }
    ]
  }

  let callHeaders = {
    'Authorization': `Bearer ${fireflyApiAuth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': `${params.FIREFLY_SERVICES_CLIENT_ID}`,
  }
  if(typeof params.throwIoEvent !== 'undefined' && params.throwIoEvent === 'true' || params.throwIoEvent === true){
    callHeaders['x-gw-ims-org-id'] = `${params.FIREFLY_SERVICES_ORG_ID}`
  }

  const config = {
    method: 'POST',
    url: fetchUrl,
    headers: callHeaders,
    data : psApiManifestBody
  }

  logger.debug("fireflyCscUtils:getPhotoshopManifest before fetch with this call config")
  logger.debug(JSON.stringify(config, null, 2))

  let response
  try {
    response = await axios.request(config)

    logger.debug(`in getPhotoshopManifestForPresignedUrl was successful ${JSON.stringify(response.data, null, 2)}`)
    return response.data

  } catch (error) {
    logger.error(`request to ${fetchUrl} failed ${JSON.stringify(error, null, 2)}`)
    if (error.response) {
      logger.error(`error.response.data ${error.response.data}`)
      logger.error(`error.response.status ${error.response.status}`)
      logger.error(`error.response.headers ${error.response.headers}`)
    } else if (error.request) {
      logger.error(`error.request ${error.request}`)
    } else {
      logger.error(`request to ${fetchUrl} failed ${error.message}`)
    }
    throw new Error(`request to ${fetchUrl} failed ${error.response}`)
  }

}

function sleepCscRequest(ms){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/***
 * Run the Express Report Process
 * 
 * @param {object} callParams action input parameters.
 * @param {object} callParams.manifest ps manifest object
 * @param {string} callParams.aemHost aem host https://www.aemhost.com
 * @param {string} callParams.aemAssetPath aem asset path /content/dam/asset.jpg
 * @param {object} callParams.jobSecodaryData job data from previous calls
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} response
 */
async function runExpressReport(callParams,params,logger) {
  logger.debug('manifest clean')
  let manifestClean
  if(typeof callParams.manifest !== "object") {
    logger.debug('manifest type string')
    throw new Error('manifest type is not an object')
  }else{
    logger.debug('manifest clean object')
    manifestClean = callParams.manifest
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
  logger.debug(`got new action report object`)

  // too many artboards?  #2
  //assetReport.setArtboardCount(manifestClean)
  assetReport.setReportValuesBasedOnManifest(manifestClean)

  if(typeof callParams.jobSecodaryData !== 'undefined'){
    assetReport.setReportValuesBasedOnSecondaryJobData(callParams.jobSecodaryData)
  }
  else{
    // Change this to the path of the image you want to check
    const aemImageData = await getAemAssetData(callParams.aemHost,callParams.aemAssetPath,params,logger)
    logger.debug('aemImageData')

    if(typeof aemImageData !== 'undefined' && typeof aemImageData.body !== 'undefined'){
      logger.debug("aem file got image data")
      assetReport.setValuesBasedOnAemAssetDataCall(aemImageData)
    }else{
      logger.error("Failed to get aem file data")
    }
  } 

  // Write the report to the asset comments in AEM Touch UI
  const assetReportJson = assetReport.getReportAsJson()
  await writeJsonExpressCompatibiltyReportToComment(callParams.aemHost,callParams.aemAssetPath,assetReportJson,params,logger)
  logger.debug("getAemFileExpressAudit done with writeJsonExpressCompatibiltyReportToComment")

  // Write the report to the asset comments in AEM Experience Shell UI
  //TODO: Write the report to the asset comments in AEM Experience Shell UI

  // Add metadata to the asset in AEM which has the status message for the Express users
  const metadataValue = assetReport.status === 'ok' ? 'Compatible_Editable' : 'Compatible_Linked'
  
  await addMetadataToAemAsset(callParams.aemHost,callParams.aemAssetPath,"/adobe-express-compatible",metadataValue,params,logger)
  logger.debug("getAemFileExpressAudit done with addMetadataToAemAsset")
  
  logger.debug(assetReport.getReportAsJson())
  logger.debug("getAemFileExpressAudit done with asset_report response object")

  // Mark job complete
  callParams.jobSecodaryData.processingComplete = true
  const state = await State.init()
  const jobData = await state.put(callParams.jobSecodaryData.psApiJobId,callParams.jobSecodaryData,{ ttl: 18000 })
  logger.debug("getAemFileExpressAudit finished the state update")

  /****
   * do we need to save a report?
   */
  let reportResult
  if(params.GENERATE_AUDIT_REPORT_LOG === 'true' || params.GENERATE_AUDIT_REPORT_LOG === true){
    reportResult = await assetReportEngine.saveCurrentAssetReport()
    //debuggerOutput(`getAemFileExpressAudit finished the report save ${JSON.stringify(reportResult, null, 2)}`)
    logger.debug(`getAemFileExpressAudit finished the report save`)
  }

  logger.debug("getAemFileExpressAudit ************************* DONE *************************")
  return assetReportJson
}

module.exports = {
  getFireflyServicesAuth,
  getPhotoshopManifestForPresignedUrl,
  getFireflyServicesServiceAccountToken,
  sleepCscRequest,
  runExpressReport
}
