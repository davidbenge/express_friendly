/* 
* <license header>
*/

/* This file exposes some common CSC related utilities for your actions */
const { getBearerToken } = require('./utils')
const { Core, State, Files } = require('@adobe/aio-sdk')
const openwhisk = require("openwhisk")
const fetch = require('node-fetch')
const FormData = require('form-data')

/***
 * Get aem service account token
 * 
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {string} aemAuthToken
 */
async function getAemServiceAccountToken(params,logger){
  let ow = openwhisk()

  //AEM auth key from cache 
  let aemAuthToken
  const state = await State.init()
  const stateAuth = await state.get('aem-auth-key')

  logger.debug("getAemServiceAccountToken passed state key")
  //get from store if it exists
  if(typeof stateAuth === 'undefined' || typeof stateAuth.value === 'undefined' || stateAuth.value === null){
    const invokeParams = {
      "client_id":`${params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID}`,
      "technical_account_id":`${params.AEM_SERVICE_TECH_ACCOUNT_ID}`,
      "org_id":`${params.AEM_SERVICE_TECH_ACCOUNT_ORG_ID}`,
      "client_secret":`${params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_SECRET}`,
      "private_key":`${params.AEM_SERVICE_TECH_ACCOUNT_PRIVATE_KEY}`,
      "meta_scopes":`${params.AEM_SERVICE_TECH_ACCOUNT_META_SCOPES}`,
      "private_key_base64":true}

      logger.debug("dx-excshell-1/get-auth invoke")

    // call the other get-auth app builder action
    let invokeResult = await ow.actions.invoke({
      name: 'dx-excshell-1/get-auth', // the name of the action to invoke
      blocking: true, // this is the flag that instructs to execute the worker asynchronous
      result: true,
      params: invokeParams
      });

      logger.debug("dx-excshell-1/get-auth invokeResult: " + JSON.stringify(invokeResult))

      if(typeof invokeResult.body !== 'undefined' && typeof invokeResult.body.access_token !== 'undefined'){
        // if not reqeust a new one and put it in the store
        aemAuthToken = invokeResult.body.access_token
        await state.put('aem-auth-key', aemAuthToken, { ttl: 79200 }) // -1 for max expiry (365 days), defaults to 86400 (24 hours) 79200 is 22 hours
      }else{
        logger.error("Failed to get AEM auth token")
      }
  }else{
    logger.debug("getAemServiceAccountToken found a good state key")
    logger.debug("getAemServiceAccountToken state key value: " + stateAuth.value)
    aemAuthToken = stateAuth.value
  }

  return aemAuthToken
}

/***
 * Get aem asset data
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} resultData
 */
async function getAemAssetData(aemHost,aemAssetPath,params,logger){
  // fetch content from external api endpoint
  const fetchUrl = aemHost + aemAssetPath + '.3.json'
  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken,
      'Content-Type': 'application/json'
    }
  })
  
  if (!res.ok) {
    throw new Error('request to ' + fetchUrl + ' failed with status code ' + res.status)
  }else{
    return await res.json()
  }
}

/***
 * Get AEM Asset data from repo
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} resultData
 */
async function getAemAssetDataRapi(aemHost,aemAssetPath,params,logger){
  const fetchUrl = `${aemHost}/adobe/repository?path=${aemAssetPath}`
  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken,
      'Content-Type': 'application/json',
      'x-api-key': params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID
    }
  })
  
  if (!res.ok) {
    throw new Error('getAemAssetDataRapi request to ' + fetchUrl + ' failed with status code ' + res.status)
  }else{
    return await res.json()
  }
}

/***
 * Get AEM Asset presigned url
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {string} presigned dowload url
 */
async function getAemAssetPresignedDownloadUrl(aemHost,aemAssetPath,params,logger){
  // get repo data
  const assetRepoData = await getAemAssetDataRapi(aemHost,aemAssetPath,params,logger)

  //get download link  TODO
  const fetchUrl = assetRepoData['_links']['http://ns.adobe.com/adobecloud/rel/download'].href
  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken,
      'Content-Type': 'application/json',
      'x-api-key': params.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID
    }
  })
  
  if (!res.ok) {
    throw new Error('getAemAssetPresignedDownloadUrl request to ' + fetchUrl + ' failed with status code ' + res.status)
  }else{
    return await res.json().href
  }
}

/****
 * Write rendition to asset
 */
async function writeRenditionToAsset(aemHost,aemAssetPath,fileBinary,fileMimeType,params,logger){
  aemAssetPath = aemAssetPath.replace("/content/dam","/api/assets")
  if(aemAssetPath.indexOf("/api/assets") < 0){
    aemAssetPath = "/api/assets" + aemAssetPath
  }
  logger.debug("writeRenditionToAsset aemAssetPath: " + aemAssetPath)

  const fetchUrl = aemHost + aemAssetPath
  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken,
      'Content-Type': fileMimeType
    },
    body:fileBinary
  })
  
  if (!res.ok) {
    throw new Error('request to ' + fetchUrl + ' failed with status code ' + res.status)
  }else{
    return await res.json()
  }
}

/***
 * Write comment to asset
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {string} comment comment to write
 * @param {string} annotations annotations to write or empty object {} if none
 * @param {string} fileMimeType file mime type, default is 'image/vnd.adobe.photoshop' TODO put in a lookup based on file type
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} resultData
 */
async function writeCommentToAsset(aemHost,aemAssetPath,comment,annotations,params,logger){
  aemAssetPath = aemAssetPath.replace("/content/dam","/api/assets")
  if(aemAssetPath.indexOf("/api/assets") < 0){
    aemAssetPath = "/api/assets" + aemAssetPath
  }
  aemAssetPath = aemAssetPath + "/comments/*"

  logger.debug("writeCommentToAsset aemAssetPath path is : " + aemAssetPath +  " we are starting the form build")
  const form = new FormData()
  form.append('message', comment)

  //if(typeof annotations != null && typeof annotations === 'object' && Object.keys(annotations).length > 0){
  //  form.append('annotationData', annotations)
  //}

  const fetchUrl = aemHost + aemAssetPath
  logger.debug("writeCommentToAsset fetchUrl: " + fetchUrl)

  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken
    },
    body:form
  })
  logger.debug("writeCommentToAsset res: " + JSON.stringify(res)) 
  
  if (!res.ok) {
    throw new Error('request to ' + fetchUrl + ' writeCommentToAsset failed with status code ' + res.status)
  }else{
    return await res.json()
  }
}

/****
 * Write json express compatibility report to comment
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {object} jsonReport json report object
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} resultData
 */
async function writeJsonExpressCompatibiltyReportToComment(aemHost,aemAssetPath,jsonReport,params,logger){
  let myReport = `
    Artboard count: ${jsonReport.artboardCount}
    artboard count ok: ${jsonReport.artboardCountOk}
    bit depth: ${jsonReport.bitDepth}
    height: ${jsonReport.height}
    height ok: ${jsonReport.heightOk}
    icc profile name: ${jsonReport.iccProfileName}
    image mode: ${jsonReport.imageMode}
    status: ${jsonReport.status}
    width: ${jsonReport.width}
    width ok: ${jsonReport.widthOk}
  `

  let annotations
  let returnData = await writeCommentToAsset(aemHost,aemAssetPath, myReport,annotations,params,logger)

  return returnData
}

/****
 * Write a tag onto an asset
 * 
 * @param {string} aemHost aem host
 * @param {string} aemAssetPath aem asset path
 * @param {object} tag 
 * @param {object} params action input parameters.
 * @param {object} logger logger object
 * 
 * @returns {object} resultData
 * 
 * TODO: finsh
 */
async function aemAssetAddMetadata(aemHost,aemAssetPath,tag,params,logger){
  aemAssetPath = aemAssetPath.replace("/content/dam","/api/assets")
  if(aemAssetPath.indexOf("/api/assets") < 0){
    aemAssetPath = "/api/assets" + aemAssetPath
  }
  aemAssetPath = aemAssetPath + "/comments/*"

  logger.debug("writeCommentToAsset aemAssetPath path is : " + aemAssetPath +  " we are starting the form build")
  const form = new FormData()
  form.append('message', comment)

  //if(typeof annotations != null && typeof annotations === 'object' && Object.keys(annotations).length > 0){
  //  form.append('annotationData', annotations)
  //}

  const fetchUrl = aemHost + aemAssetPath
  logger.debug("writeCommentToAsset fetchUrl: " + fetchUrl)

  const aemAuthToken = await getAemAuth(params,logger)

  const res = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + aemAuthToken
    },
    body:form
  })
  logger.debug("writeCommentToAsset res: " + JSON.stringify(res)) 
  
  if (!res.ok) {
    throw new Error('request to ' + fetchUrl + ' writeCommentToAsset failed with status code ' + res.status)
  }else{
    return await res.json()
  }
}

/****
 * Get AEM auth from right place
 */
async function getAemAuth(params,logger){
  if(params.AEM_USE_PASSED_AUTH === 'true'){
    logger.debug("getAemAuth getBearerToken")
    return getBearerToken(params)
  }else{
    logger.debug("getAemAuth getAemServiceAccountToken")
    let aemAuthToken = await getAemServiceAccountToken(params,logger)
    return aemAuthToken
  }
}

module.exports = {
  getAemAuth,
  getAemAssetData,
  writeCommentToAsset,
  writeJsonExpressCompatibiltyReportToComment,
  getAemAssetDataRapi,
  getAemAssetPresignedDownloadUrl,
  aemAssetAddMetadata
}
